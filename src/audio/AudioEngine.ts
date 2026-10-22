// Audio-Engine: kennt keine Oberfläche. Meldet nur Änderungen über onChange.
import { EQ_FREQS, isFlat, type Fx, type ReverbSize } from "../model/fx";
import { clampRegion } from "../model/region";
import { generateIR } from "./reverbIR";

/** start/end in Sekunden (nicht destruktiv). fadeIn/fadeOut in Sekunden. Fehlen start und end, läuft das ganze Sample. */
export interface PlayOptions {
  volume: number; loop: boolean; start?: number; end?: number; stopIds?: string[];
  fadeIn?: number; fadeOut?: number;
  fx?: Fx; // EQ und Hall; fehlt oder alles aus = keine zusätzlichen Audio-Knoten
  forceChain?: boolean; // Effektkette auch bei "alles aus" aufbauen (Probehören: spätere Änderungen ohne Umbau)
}
interface Voice {
  src: AudioBufferSourceNode; gain: GainNode;
  fadeOutSec: number;  // Ausblendzeit beim Stoppen
  autoFadeSec: number; // Ausblendzeit am natürlichen Ende (nur One-Shot), bereits begrenzt
  t0: number; len: number; loop: boolean; endAt?: number;
  chain?: Chain;
}
/** Effektkette eines Pads: Gain -> Tiefen -> Mitten -> Höhen -> Dry -> Master, plus Send -> Hall-Bus. */
interface Chain { low: BiquadFilterNode; mid: BiquadFilterNode; high: BiquadFilterNode; dry: GainNode; send: GainNode; size: ReverbSize; connected: boolean }

const FADE_SECONDS = 0.03; // kurzes Ausblenden gegen Klickgeräusche
const MAX_FADE = 30;
const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const clampFade = (v: number | undefined): number => (v !== undefined && Number.isFinite(v) ? Math.min(MAX_FADE, Math.max(0, v)) : 0);

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private masterVol = 1;
  private voices = new Map<string, Voice>(); // genau eine aktive Wiedergabe pro Pad
  private fading = new Set<Voice>();         // gestoppte Pads, die noch ausblenden (STOP ALL erfasst sie)
  private buses = new Map<ReverbSize, { conv: ConvolverNode; out: GainNode }>(); // gemeinsamer Hall je Größe
  private listeners = new Set<() => void>();

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain(); // Master-Lautstärke: alle Pads laufen darüber
      this.master.gain.value = this.masterVol;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }
  /** Aus einer Benutzeraktion aufrufen. Wartet bewusst nicht: auf iOS kann resume() lange hängen. */
  unlock(): void {
    const c = this.getCtx();
    if (c.state !== "running") void c.resume().catch(() => { /* wird beim nächsten Tippen erneut versucht */ });
  }
  /** Bei jeder Berührung/Taste aufrufen: iOS erlaubt das Fortsetzen nach Standby oft erst bei touchend/click. */
  gestureResume(): void {
    if (this.ctx && this.ctx.state !== "running") void this.ctx.resume().catch(() => { /* egal */ });
  }
  get running(): boolean { return this.ctx?.state === "running"; }
  decode(data: ArrayBuffer): Promise<AudioBuffer> {
    return this.getCtx().decodeAudioData(data);
  }
  onChange(fn: () => void): void { this.listeners.add(fn); }
  private emit(): void { this.listeners.forEach((fn) => fn()); }

  isPlaying(padId: string): boolean { return this.voices.has(padId); }
  playingIds(): string[] { return [...this.voices.keys()]; }

  get masterVolume(): number { return this.masterVol; }
  /** Master-Lautstärke 0 bis 1, wirkt sofort auf alles, auch auf ausblendende Sounds. */
  setMasterVolume(v: number): void {
    this.masterVol = clamp01(v);
    if (this.master && this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.masterVol, t, 0.01);
    }
  }

  /** Fortschritt eines laufenden Pads in Sekunden (total ist bei Loops unbekannt/unendlich). */
  progress(padId: string): { elapsed: number; total: number; loop: boolean } | null {
    const v = this.voices.get(padId);
    if (!v || !this.ctx) return null;
    return { elapsed: Math.max(0, this.ctx.currentTime - v.t0), total: v.len, loop: v.loop };
  }

  play(padId: string, buffer: AudioBuffer, o: PlayOptions): void {
    const ctx = this.getCtx();
    if (ctx.state !== "running") void ctx.resume().catch(() => { /* egal */ });
    for (const id of o.stopIds ?? []) if (id !== padId) this.stop(id); // Stop-Regeln des Pads, einmal pro Start
    this.killNow(padId); // nie doppelt: alte Wiedergabe sofort beenden
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    src.loop = o.loop;
    src.connect(gain);

    const region = o.start !== undefined || o.end !== undefined ? clampRegion(o.start, o.end, buffer.duration) : null;
    const len = region ? region.end - region.start : buffer.duration;
    const known = !o.loop && Number.isFinite(len);
    const t0 = ctx.currentTime;
    const vol = clamp01(o.volume);
    let fadeIn = clampFade(o.fadeIn);
    const fadeOut = clampFade(o.fadeOut);
    const autoOut = known ? Math.min(fadeOut, len / 2) : 0; // One-Shot: Ein- und Ausblenden überlappen nie
    if (known) fadeIn = Math.min(fadeIn, len / 2);
    const g = gain.gain;
    if (fadeIn > 0) { g.setValueAtTime(0, t0); g.linearRampToValueAtTime(vol, t0 + fadeIn); } else g.value = vol;
    const endAt = known ? t0 + len : undefined;
    if (endAt !== undefined && autoOut > 0) {
      g.setValueAtTime(vol, Math.max(t0 + fadeIn, endAt - autoOut));
      g.linearRampToValueAtTime(0, endAt);
    }

    const voice: Voice = { src, gain, fadeOutSec: fadeOut, autoFadeSec: autoOut, t0, len: Number.isFinite(len) ? len : NaN, loop: o.loop, endAt };
    this.voices.set(padId, voice);
    if (o.fx && (o.forceChain || !isFlat(o.fx))) this.buildChain(voice, o.fx);
    else gain.connect(this.master!); // ohne Effekte direkt zum Master, wie bisher
    src.onended = () => {
      src.disconnect(); gain.disconnect();
      if (voice.chain) for (const n of [voice.chain.low, voice.chain.mid, voice.chain.high, voice.chain.dry, voice.chain.send]) n.disconnect();
      this.fading.delete(voice);
      if (this.voices.get(padId) === voice) { this.voices.delete(padId); this.emit(); }
    };
    if (region) {
      if (o.loop) { src.loopStart = region.start; src.loopEnd = region.end; src.start(0, region.start); }
      else src.start(0, region.start, region.end - region.start);
    } else src.start();
    this.emit();
  }

  /** Stoppt ein Pad (mit seiner Ausblendzeit, mindestens kurz). Der Status wird sofort zurückgesetzt. */
  stop(padId: string): void {
    const v = this.voices.get(padId);
    if (!v || !this.ctx) return;
    this.voices.delete(padId);
    this.fadeOut(v, Math.max(FADE_SECONDS, v.fadeOutSec));
    this.emit();
  }

  /** Ändert die Lautstärke eines laufenden Pads sofort und weich (ohne Knacken). Andere Pads bleiben unberührt. */
  setVolume(padId: string, volume: number): void {
    const v = this.voices.get(padId);
    if (!v || !this.ctx) return;
    const t = this.ctx.currentTime;
    const vol = clamp01(volume);
    const g = v.gain.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(vol, t, 0.01);
    if (v.endAt !== undefined && v.autoFadeSec > 0) { // Ausblenden am Ende mit neuer Lautstärke neu planen
      const s = Math.max(t + 0.05, v.endAt - v.autoFadeSec);
      if (s < v.endAt) { g.setValueAtTime(vol, s); g.linearRampToValueAtTime(0, v.endAt); }
    }
  }

  /** EQ und Hall eines laufenden Pads ändern (weich). Hat es noch keine Effektkette, wird sie bei Bedarf eingebaut. */
  setEffects(padId: string, fx: Fx): void {
    const v = this.voices.get(padId);
    if (!v || !this.ctx) return;
    if (v.chain) this.applyFx(v, fx);
    else if (!isFlat(fx)) this.buildChain(v, fx);
  }
  private buildChain(v: Voice, fx: Fx): void {
    const ctx = this.ctx!;
    v.gain.disconnect(); // Direktverbindung zum Master lösen (nur beim nachträglichen Einbau relevant)
    const filter = (type: BiquadFilterType, freq: number, db: number, q: number) => {
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q; f.gain.value = db;
      return f;
    };
    const low = filter("lowshelf", EQ_FREQS.low, fx.low, 0.7);
    const mid = filter("peaking", EQ_FREQS.mid, fx.mid, 0.8);
    const high = filter("highshelf", EQ_FREQS.high, fx.high, 0.7);
    const dry = ctx.createGain(), send = ctx.createGain();
    send.gain.value = fx.reverb;
    v.gain.connect(low); low.connect(mid); mid.connect(high); high.connect(dry); dry.connect(this.master!);
    high.connect(send);
    const chain: Chain = { low, mid, high, dry, send, size: fx.size, connected: false };
    if (fx.reverb > 0) { send.connect(this.bus(fx.size).conv); chain.connected = true; } // Hall-Bus nur bei Bedarf
    v.chain = chain;
  }
  private applyFx(v: Voice, fx: Fx): void {
    const c = v.chain!, t = this.ctx!.currentTime;
    const set = (p: AudioParam, val: number) => { p.cancelScheduledValues(t); p.setTargetAtTime(val, t, 0.02); };
    set(c.low.gain, fx.low); set(c.mid.gain, fx.mid); set(c.high.gain, fx.high); set(c.send.gain, fx.reverb);
    if (fx.reverb <= 0 && c.connected) { c.send.disconnect(); c.connected = false; }
    else if (fx.reverb > 0 && (!c.connected || fx.size !== c.size)) {
      if (c.connected) c.send.disconnect();
      c.send.connect(this.bus(fx.size).conv);
      c.connected = true;
    }
    c.size = fx.size;
  }
  /** Gemeinsamer Hall-Raum je Größe, wird beim ersten Bedarf erzeugt. */
  private bus(size: ReverbSize): { conv: ConvolverNode; out: GainNode } {
    let b = this.buses.get(size);
    if (!b) {
      const ctx = this.ctx!;
      const ir = generateIR(ctx.sampleRate, size);
      const buf = ctx.createBuffer(2, ir.left.length, ctx.sampleRate);
      buf.copyToChannel(ir.left, 0);
      buf.copyToChannel(ir.right, 1);
      const conv = ctx.createConvolver();
      conv.buffer = buf;
      const out = ctx.createGain();
      conv.connect(out); out.connect(this.master!);
      b = { conv, out };
      this.buses.set(size, b);
    }
    return b;
  }

  /** STOP ALL: global, sofort (kurz ausgeblendet), erfasst auch Pads, die gerade ausblenden. */
  stopAll(): void {
    if (!this.ctx) return;
    const all = [...this.voices.values(), ...this.fading];
    this.voices.clear();
    all.forEach((v) => this.fadeOut(v, FADE_SECONDS));
    const t = this.ctx.currentTime;
    for (const b of this.buses.values()) { // Hallfahne sofort abschalten: Bus ausblenden und beim nächsten Start neu aufbauen
      b.out.gain.cancelScheduledValues(t);
      b.out.gain.setValueAtTime(b.out.gain.value, t);
      b.out.gain.linearRampToValueAtTime(0, t + FADE_SECONDS);
      setTimeout(() => { try { b.conv.disconnect(); b.out.disconnect(); } catch { /* egal */ } }, 250);
    }
    this.buses.clear();
    this.emit();
  }

  private fadeOut(v: Voice, seconds: number): void {
    const t = this.ctx!.currentTime;
    const g = v.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + seconds);
    v.src.loop = false;
    this.fading.add(v);
    try { v.src.stop(t + seconds + 0.005); } catch { /* schon beendet */ }
  }
  private killNow(padId: string): void {
    const v = this.voices.get(padId);
    if (!v) return;
    this.voices.delete(padId);
    try { v.src.stop(); } catch { /* schon beendet */ }
  }
}
