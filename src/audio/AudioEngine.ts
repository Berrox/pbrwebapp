// Audio-Engine: kennt keine Oberfläche. Meldet nur Änderungen über onChange.
import { clampRegion } from "../model/region";

/** start/end in Sekunden (nicht destruktiv). fadeIn/fadeOut in Sekunden. Fehlen start und end, läuft das ganze Sample. */
export interface PlayOptions {
  volume: number; loop: boolean; start?: number; end?: number; stopIds?: string[];
  fadeIn?: number; fadeOut?: number;
}
interface Voice {
  src: AudioBufferSourceNode; gain: GainNode;
  fadeOutSec: number;  // Ausblendzeit beim Stoppen
  autoFadeSec: number; // Ausblendzeit am natürlichen Ende (nur One-Shot), bereits begrenzt
  t0: number; len: number; loop: boolean; endAt?: number;
}

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
    src.connect(gain).connect(this.master!);

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
    src.onended = () => {
      src.disconnect(); gain.disconnect();
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

  /** STOP ALL: global, sofort (kurz ausgeblendet), erfasst auch Pads, die gerade ausblenden. */
  stopAll(): void {
    if (!this.ctx) return;
    const all = [...this.voices.values(), ...this.fading];
    this.voices.clear();
    all.forEach((v) => this.fadeOut(v, FADE_SECONDS));
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
