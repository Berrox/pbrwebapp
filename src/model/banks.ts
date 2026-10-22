// Reine Logik für Bänke und Pads (ohne Browser, daher gut testbar).
import type { PadConfig } from "../storage/db";
import { uuid } from "./ids";

export interface Bank { id: string; name: string; columns: number; padCount: number; color?: string }

export const padPrefix = (bankId: string): string => `${bankId}:`;
export const padId = (bankId: string, index: number): string => `${bankId}:${index}`;

export function clampInt(v: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
}
export function newBank(name: string): Bank {
  return { id: uuid(), name, columns: 4, padCount: 12 };
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

export const MAX_PADS = 48; // größte einstellbare Pad-Anzahl pro Bank
/** Pad ohne jeden eigenen Inhalt (entspricht einem neuen, leeren Pad). */
export function isBlankPad(p: PadConfig): boolean {
  const d = defaultPad(p.id);
  return !p.soundId && !p.name && !p.note && !p.key && p.midiNote === undefined && !p.playMode && !p.groupId
    && !p.stopTargets?.length && !p.fadeIn && !p.fadeOut && p.start === undefined && p.end === undefined
    && p.color === d.color && p.volume === d.volume && p.loop === d.loop;
}

/** Gedeckte Farben für die Streifen der Bank-Tabs. */
export const BANK_PALETTE = ["#60a5fa", "#f59e0b", "#a78bfa", "#2dd4bf", "#f472b6", "#4ade80", "#fb923c", "#94a3b8"];
/** Eigene Farbe der Bank, sonst eine feste Farbe aus der Palette (stabil über die Bank-ID, unabhängig von der Reihenfolge). */
export function bankColor(b: Bank): string {
  if (b.color) return b.color;
  let h = 0;
  for (const ch of b.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return BANK_PALETTE[h % BANK_PALETTE.length];
}
