// Hall-Raum (Impulsantwort) im Programm erzeugt: abklingendes Rauschen, fest geseedet, daher immer gleich.
import type { ReverbSize } from "../model/fx";

export const IR_SECONDS: Record<ReverbSize, number> = { room: 0.7, hall: 2.0, church: 3.5 };
const SEED: Record<ReverbSize, number> = { room: 11, hall: 22, church: 33 };

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function generateIR(sampleRate: number, size: ReverbSize): { left: Float32Array; right: Float32Array } {
  const n = Math.max(1, Math.round(sampleRate * IR_SECONDS[size]));
  const channel = (seed: number) => {
    const r = rng(seed), out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = (r() * 2 - 1) * Math.pow(1 - i / n, 2.5);
    return out;
  };
  return { left: channel(SEED[size]), right: channel(SEED[size] + 1000) };
}
