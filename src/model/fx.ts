// Klang pro Pad: 3-Band-EQ und Hall. Reine Logik, ohne Browser.
import type { PadConfig } from "../storage/db";

export type ReverbSize = "room" | "hall" | "church";
export const REVERB_SIZES: ReverbSize[] = ["room", "hall", "church"];
export const isReverbSize = (v: unknown): v is ReverbSize => typeof v === "string" && (REVERB_SIZES as string[]).includes(v);

/** EQ in dB (-12 bis +12), Hall-Menge 0 bis 1. */
export interface Fx { low: number; mid: number; high: number; reverb: number; size: ReverbSize }
export const EQ_FREQS = { low: 120, mid: 1000, high: 6000 } as const; // Hz, fest
export const EQ_MAX = 12;

/** Ohne EQ und ohne Hall: das Pad bekommt keine zusätzlichen Audio-Knoten. */
export const isFlat = (fx: Fx): boolean => fx.low === 0 && fx.mid === 0 && fx.high === 0 && fx.reverb <= 0;

/** EQ-Wert auf ganze dB begrenzt; 0 oder ungültig = aus (undefined). */
export function normalizeEq(v: number): number | undefined {
  if (!Number.isFinite(v)) return undefined;
  const r = Math.round(Math.max(-EQ_MAX, Math.min(EQ_MAX, v)));
  return r === 0 ? undefined : r;
}
/** Hall-Menge in 5-%-Schritten; 0 oder ungültig = aus (undefined). */
export function normalizeReverb(v: number): number | undefined {
  if (!Number.isFinite(v) || v <= 0) return undefined;
  return Math.round(Math.min(1, v) * 20) / 20;
}
export function fxFromPad(p: Pick<PadConfig, "eqLow" | "eqMid" | "eqHigh" | "reverb" | "reverbSize">): Fx {
  return { low: p.eqLow ?? 0, mid: p.eqMid ?? 0, high: p.eqHigh ?? 0, reverb: p.reverb ?? 0, size: p.reverbSize ?? "room" };
}
