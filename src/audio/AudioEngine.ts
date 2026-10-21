// Audio-Engine: kennt keine Oberfläche. Meldet nur Änderungen über onChange.
import { clampRegion } from "../model/region";

/** start/end in Sekunden (nicht destruktiv). Fehlen beide, läuft das ganze Sample. */
export interface PlayOptions { volume: number; loop: boolean; start?: number; end?: number; stopIds?: string[] }
interface Voice { src: AudioBufferSourceNode; gain: GainNode }

const FADE_SECONDS = 0.03; // kurzes Ausblenden gegen Klickgeräusche

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private voices = new Map<string, Voice>(); // genau eine aktive Wiedergabe pro Pad
  private listeners = new Set<() => void>();

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
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

  play(padId: string, buffer: AudioBuffer, o: PlayOptions): void {
    const ctx = this.getCtx();
    if (ctx.state !== "running") void ctx.resume().catch(() => { /* egal */ });
    for (const id of o.stopIds ?? []) if (id !== padId) this.stop(id); // Stop-Regeln des Pads, einmal pro Start
    this.killNow(padId); // nie doppelt: alte Wiedergabe sofort beenden
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    src.loop = o.loop;
    gain.gain.value = Math.min(1, Math.max(0, o.volume));
    src.connect(gain).connect(ctx.destination);
    const voice: Voice = { src, gain };
    this.voices.set(padId, voice);
    src.onended = () => {
      src.disconnect(); gain.disconnect();
      if (this.voices.get(padId) === voice) { this.voices.delete(padId); this.emit(); }
    };
    if (o.start !== undefined || o.end !== undefined) {
      const r = clampRegion(o.start, o.end, buffer.duration); // ungültige Grenzen werden korrigiert
      if (o.loop) { src.loopStart = r.start; src.loopEnd = r.end; src.start(0, r.start); }
      else src.start(0, r.start, r.end - r.start);
    } else src.start();
    this.emit();
  }

  /** Stoppt ein Pad mit kurzem Fade-out. Status wird sofort zurückgesetzt. */
  stop(padId: string): void {
    const v = this.voices.get(padId);
    if (!v || !this.ctx) return;
    this.voices.delete(padId);
    this.fadeOut(v);
    this.emit();
  }

  /** Ändert die Lautstärke eines laufenden Pads sofort und weich (ohne Knacken). Andere Pads bleiben unberührt. */
  setVolume(padId: string, volume: number): void {
    const v = this.voices.get(padId);
    if (!v || !this.ctx) return;
    const t = this.ctx.currentTime;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setTargetAtTime(Math.min(1, Math.max(0, volume)), t, 0.01);
  }

  /** STOP ALL: global, unabhängig von Bank und Ansicht. */
  stopAll(): void {
    if (!this.ctx) return;
    const all = [...this.voices.values()];
    this.voices.clear();
    all.forEach((v) => this.fadeOut(v));
    this.emit();
  }

  private fadeOut(v: Voice): void {
    const t = this.ctx!.currentTime;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setValueAtTime(v.gain.gain.value, t);
    v.gain.gain.linearRampToValueAtTime(0, t + FADE_SECONDS);
    v.src.loop = false;
    try { v.src.stop(t + FADE_SECONDS + 0.005); } catch { /* schon beendet */ }
  }
  private killNow(padId: string): void {
    const v = this.voices.get(padId);
    if (!v) return;
    this.voices.delete(padId);
    try { v.src.stop(); } catch { /* schon beendet */ }
  }
}
