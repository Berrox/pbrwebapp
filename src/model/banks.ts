// Reine Logik für Bänke und Pads (ohne Browser, daher gut testbar).
import type { PadConfig } from "../storage/db";

export interface Bank { id: string; name: string; columns: number; padCount: number }

export const padPrefix = (bankId: string): string => `${bankId}:`;
export const padId = (bankId: string, index: number): string => `${bankId}:${index}`;

export function clampInt(v: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
}
export function newBank(name: string): Bank {
  return { id: crypto.randomUUID(), name, columns: 4, padCount: 12 };
}
export function defaultPad(id: string): PadConfig {
  return { id, name: "", color: "#2563eb", volume: 0.9, loop: false, soundId: null };
}
/** Liefert die Pads einer Bank. Fehlende werden angelegt, vorhandene bleiben unverändert. */
export function makePads(bank: Bank, store: Map<string, PadConfig>): PadConfig[] {
  return Array.from({ length: bank.padCount }, (_, i) => {
    const id = padId(bank.id, i);
    let p = store.get(id);
    if (!p) { p = defaultPad(id); store.set(id, p); }
    return p;
  });
}
export function moveBank(banks: Bank[], index: number, dir: -1 | 1): { banks: Bank[]; index: number } {
  const j = index + dir;
  if (j < 0 || j >= banks.length) return { banks, index };
  const copy = [...banks];
  [copy[index], copy[j]] = [copy[j], copy[index]];
  return { banks: copy, index: j };
}
/** M1-Pads hießen "pad-0" usw. Sie werden in die erste Bank übernommen. */
export function migrateLegacy(pads: PadConfig[], bankId: string): { oldId: string; pad: PadConfig }[] {
  const out: { oldId: string; pad: PadConfig }[] = [];
  for (const p of pads) {
    const m = /^pad-(\d+)$/.exec(p.id);
    if (m) out.push({ oldId: p.id, pad: { ...p, id: padId(bankId, Number(m[1])) } });
  }
  return out;
}
