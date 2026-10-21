// Reine Hilfsfunktionen für die Soundbibliothek.
import type { PadConfig } from "../storage/db";

export const isSupportedAudioName = (name: string): boolean => /\.(wav|mp3)$/i.test(name);
export const isValidSoundName = (name: string): boolean => name.trim().length >= 1 && name.trim().length <= 200;

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1).replace(".", ",")} MB`;
}
export function formatDuration(sec?: number): string {
  if (sec === undefined || !Number.isFinite(sec)) return "–";
  if (sec < 60) return `${sec.toFixed(1).replace(".", ",")} s`;
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")} min`;
}
export function padsUsingSound(store: Map<string, PadConfig>, soundId: string): PadConfig[] {
  return [...store.values()].filter((p) => p.soundId === soundId);
}
