// Kleine Hilfen für Pad-Lautstärke und Pad-Notizen (reine Logik).
export const PAD_NOTE_MAX = 500;

/** Leere oder nur aus Leerzeichen bestehende Notizen werden nicht gespeichert (undefined). */
export function normalizeNote(text: string): string | undefined {
  const t = text.trim().slice(0, PAD_NOTE_MAX);
  return t ? t : undefined;
}
/** 0 bis 1 als Prozentanzeige, z. B. 0.75 -> "75 %". */
export function volumePercent(v: number): string {
  const c = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
  return `${Math.round(c * 100)} %`;
}
