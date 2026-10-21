// Tastaturkürzel (KeyboardEvent.code, unabhängig vom Tastaturlayout) und Konflikt-Erkennung.
import type { PadConfig } from "../storage/db";

/** Erlaubt: Buchstaben, Ziffern, Ziffernblock. Bewusst nicht: Esc (STOP ALL), Tab, Enter, Leertaste, F-Tasten. */
export const isAssignableKey = (code: string): boolean => /^(Key[A-Z]|Digit[0-9]|Numpad[0-9])$/.test(code);

export function keyLabel(code: string): string {
  return code.replace(/^Key|^Digit/, "").replace(/^Numpad/, "Num ");
}
/** Findet ein anderes Pad derselben Bank mit gleicher Taste bzw. MIDI-Note. */
export function findConflict(
  pads: PadConfig[], padId: string, field: "key" | "midiNote", value: string | number | undefined,
): PadConfig | null {
  if (value === undefined) return null;
  return pads.find((p) => p.id !== padId && p[field] === value) ?? null;
}
