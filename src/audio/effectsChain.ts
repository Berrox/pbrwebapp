// Audio-Kette für Soundeffekte & Filter (Web Audio). Pro Wiedergabe eine eigene Kette, die mit ihr endet.
import { KINDS, activeKinds, type EffectProfile, type Kind } from "../model/effects";
import { BUILDERS } from "./effectModules";

export interface FxChain {
  input: AudioNode; output: AudioNode;
  modules: ReadonlySet<Kind>; // welche Effekte gebaut sind
  update(p: EffectProfile): void;
  tail(): number; // Sekunden, die das Echo nach dem Ende noch ausklingt
  release(): void; // Rauschen, Knistern, Schwingungen beenden (Echo-Nachhall bleibt)
  dispose(): void; // alles beenden und trennen
}

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
/** Rosa Rauschen (Bandrauschen klingt weicher als weißes), fest geseedet, auf ±1 normalisiert. */
export function generateNoise(sampleRate: number, seconds = 2): Float32Array {
  const n = Math.max(1, Math.round(sampleRate * seconds));
  const out = new Float32Array(n), r = rng(7);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, peak = 0;
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    const p = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
    out[i] = p;
    peak = Math.max(peak, Math.abs(p));
  }
  for (let i = 0; i < n; i++) out[i] /= peak || 1;
  return out;
}
/** Knistern und Knackser: seltene, kurze Impulse (meist leise, wenige laut), fest geseedet, auf ±1 normalisiert. */
export function generateCrackle(sampleRate: number, seconds = 6): Float32Array {
  const n = Math.max(1, Math.round(sampleRate * seconds)), out = new Float32Array(n), r = rng(11);
  const rate = 28 / sampleRate; // etwa 28 Knackser pro Sekunde
  const len = Math.max(2, Math.round(sampleRate * 0.004)), tau = Math.max(1, sampleRate * 0.0008);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    if (r() >= rate) continue;
    const a = (r() < 0.5 ? -1 : 1) * (0.1 + 0.9 * Math.pow(r(), 3));
    for (let j = 0; j < len && i + j < n; j++) {
      out[i + j] += a * Math.exp(-j / tau) * (j % 2 === 0 ? 1 : -0.6);
      peak = Math.max(peak, Math.abs(out[i + j]));
    }
  }
  for (let i = 0; i < n; i++) out[i] /= peak || 1;
  return out;
}

/**
 * Kette: input -> [nur die gebauten Effekte in fester Reihenfolge] -> output.
 * Rauschen und Knistern speisen `feed` (die Lautstärke des Pads) und folgen so Lautstärke und Ausblenden.
 * Ausgeschaltete, aber gebaute Effekte sind neutral. dispose() beendet alle Quellen.
 */
export function createFxChain(ctx: AudioContext, p: EffectProfile, feed: AudioNode, res: { noise: AudioBuffer; crackle: AudioBuffer }, kinds: Kind[] = activeKinds(p)): FxChain {
  const input = ctx.createGain(), output = ctx.createGain();
  const mods = KINDS.filter((k) => kinds.includes(k)).map((k) => ({ k, m: BUILDERS[k]({ ctx, feed, ...res }) }));
  let prev: AudioNode = input;
  for (const { m } of mods) { prev.connect(m.input); prev = m.output; }
  prev.connect(output);
  let current = p;
  const apply = (prof: EffectProfile, immediate: boolean) => { current = prof; for (const { m } of mods) m.update(prof, immediate); };
  apply(p, true);
  return {
    input, output, modules: new Set(mods.map((x) => x.k)),
    update: (prof) => apply(prof, false),
    tail: () => Math.max(0, ...mods.map(({ m }) => m.tail(current))),
    release: () => mods.forEach(({ m }) => m.stop()),
    dispose() {
      mods.forEach(({ m }) => m.stop());
      for (const n of [input, output, ...mods.flatMap(({ m }) => m.nodes)]) { try { n.disconnect(); } catch { /* egal */ } }
    },
  };
}
