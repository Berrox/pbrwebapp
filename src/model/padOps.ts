// Pad kopieren und tauschen, Ein-/Ausblendzeit. Reine Logik.
import type { PadConfig } from "../storage/db";

export const MAX_FADE = 10;

/** Ein-/Ausblendzeit in Sekunden auf 0,1 genau; 0 oder ungültig = aus (undefined). */
export function normalizeFade(v: number): number | undefined {
  if (!Number.isFinite(v) || v <= 0) return undefined;
  return Math.round(Math.min(MAX_FADE, v) * 10) / 10;
}

/** Inhalt eines Pads. Taste und MIDI-Note gehören zur Position (Slot) und bleiben, wo sie sind. */
const CONTENT = ["name", "color", "volume", "loop", "soundId", "start", "end", "playMode", "groupId", "stopTargets", "note", "fadeIn", "fadeOut", "eqLow", "eqMid", "eqHigh", "reverb", "reverbSize", "fxMode", "fxOwn"] as const;
type Content = Record<(typeof CONTENT)[number], unknown>;

function readContent(p: PadConfig): Content {
  const rec = p as unknown as Content;
  const out = {} as Content;
  for (const k of CONTENT) out[k] = k === "stopTargets" && p.stopTargets ? [...p.stopTargets] : k === "fxOwn" && p.fxOwn ? structuredClone(p.fxOwn) : rec[k];
  return out;
}
function writeContent(p: PadConfig, c: Content): void {
  const rec = p as unknown as Content;
  for (const k of CONTENT) rec[k] = c[k];
}
const withoutSelf = (targets: string[] | undefined, id: string): string[] | undefined => {
  const t = (targets ?? []).filter((x) => x !== id);
  return t.length ? t : undefined;
};

/** Kopiert den Inhalt von `fromId` auf `toId` (das Ziel wird ersetzt). Liefert die geänderten Pad-IDs. */
export function copyPad(store: Map<string, PadConfig>, fromId: string, toId: string): string[] {
  const a = store.get(fromId), b = store.get(toId);
  if (!a || !b || fromId === toId) return [];
  writeContent(b, readContent(a));
  b.stopTargets = withoutSelf(b.stopTargets, toId);
  return [toId];
}

/** Tauscht die Inhalte zweier Pads. Stop-Ziele anderer Pads folgen dem Inhalt. Liefert alle geänderten Pad-IDs. */
export function swapPads(store: Map<string, PadConfig>, idA: string, idB: string): string[] {
  const a = store.get(idA), b = store.get(idB);
  if (!a || !b || idA === idB) return [];
  const ca = readContent(a), cb = readContent(b);
  writeContent(a, cb);
  writeContent(b, ca);
  const changed = new Set([idA, idB]);
  const map = (t: string) => (t === idA ? idB : t === idB ? idA : t);
  for (const p of store.values()) {
    if (!p.stopTargets) continue;
    const next = p.stopTargets.map(map);
    if (next.some((t, i) => t !== p.stopTargets![i])) { p.stopTargets = next; changed.add(p.id); }
  }
  for (const id of [idA, idB]) { const p = store.get(id)!; p.stopTargets = withoutSelf(p.stopTargets, id); }
  return [...changed];
}
