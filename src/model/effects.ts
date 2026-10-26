// Soundeffekte & Filter. Reine Logik, ohne Browser. Alle Regler laufen von 0 bis 100 (Prozent).
// Jeder Effekt ("Kind") hat: on, intensity, preset und eigene Regler. Neue Effekte: Eintrag in KINDS, PRESETS, SCHEMA,
// eine Umrechnung (xxxAudio), einen Baustein in audio/effectModules.ts und eine Karte in ui/effectCards.ts.

export type Kind = "tape" | "vinyl" | "radio" | "filter" | "distortion" | "chorus" | "lofi" | "echo";
/** Reihenfolge der Kette und der Karten. */
export const KINDS: Kind[] = ["tape", "vinyl", "radio", "filter", "distortion", "chorus", "lofi", "echo"];
export const KIND_SHORT: Record<Kind, string> = { tape: "Tape", vinyl: "Vinyl", radio: "Radio", filter: "Filter", distortion: "Verzerrung", chorus: "Chorus", lofi: "Lo-Fi", echo: "Echo" };

interface Base { on: boolean; intensity: number; preset: string }
export interface TapeParams extends Base { highLoss: number; noise: number; wow: number; saturation: number; clicks: number }
export interface VinylParams extends Base { noise: number; crackle: number; highLoss: number; wobble: number }
export interface RadioParams extends Base { lows: number; highs: number; mid: number; mono: boolean }
export interface FilterParams extends Base { lowpass: number; highpass: number }
export interface DistortionParams extends Base { drive: number; tone: number }
export interface ChorusParams extends Base { rate: number; depth: number }
export interface LofiParams extends Base { crush: number; tone: number }
export interface EchoParams extends Base { time: number; feedback: number }
export interface EffectProfile {
  tape: TapeParams; vinyl: VinylParams; radio: RadioParams; filter: FilterParams;
  distortion: DistortionParams; chorus: ChorusParams; lofi: LofiParams; echo: EchoParams;
}
export interface EffectsSettings { enabled: boolean; profile: EffectProfile } // globale Effekte: Schnellschalter + Einstellungen

/** Pad-Modus: keine Effekte (Original), globale Effekte übernehmen, eigene Effekte. */
export type FxMode = "off" | "global" | "own";
export const FX_MODES: FxMode[] = ["off", "global", "own"];
export const isFxMode = (v: unknown): v is FxMode => typeof v === "string" && (FX_MODES as string[]).includes(v);

export type Params = Record<string, number | boolean | string>;
interface Preset { label: string; values: Record<string, number | boolean> }
export const PRESETS: Record<Kind, Record<string, Preset>> = {
  tape: {
    clean: { label: "Saubere Kassette", values: { intensity: 40, highLoss: 15, noise: 5, wow: 8, saturation: 10, clicks: 0 } },
    old: { label: "Alte Kassette", values: { intensity: 65, highLoss: 40, noise: 15, wow: 20, saturation: 25, clicks: 0 } },
    worn: { label: "Stark abgenutztes Tape", values: { intensity: 90, highLoss: 70, noise: 35, wow: 55, saturation: 45, clicks: 15 } },
  },
  vinyl: {
    clean: { label: "Saubere Schallplatte", values: { intensity: 40, noise: 8, crackle: 5, highLoss: 10, wobble: 5 } },
    old: { label: "Alte Schallplatte", values: { intensity: 65, noise: 25, crackle: 35, highLoss: 30, wobble: 20 } },
    heavy: { label: "Starkes Vinyl-Knistern", values: { intensity: 90, noise: 45, crackle: 80, highLoss: 55, wobble: 35 } },
  },
  radio: {
    oldRadio: { label: "Altes Radio", values: { intensity: 80, lows: 65, highs: 80, mid: 40, mono: false } },
    phone: { label: "Telefon", values: { intensity: 100, lows: 80, highs: 85, mid: 60, mono: true } },
    kitchen: { label: "Kleines Küchenradio", values: { intensity: 90, lows: 75, highs: 85, mid: 55, mono: true } },
  },
  filter: {
    dull: { label: "Dumpf (Tiefpass)", values: { intensity: 100, lowpass: 60, highpass: 0 } },
    thin: { label: "Dünn (Hochpass)", values: { intensity: 100, lowpass: 0, highpass: 50 } },
    band: { label: "Bandpass", values: { intensity: 100, lowpass: 55, highpass: 45 } },
  },
  distortion: {
    warm: { label: "Warm", values: { intensity: 40, drive: 30, tone: 60 } },
    crunch: { label: "Crunch", values: { intensity: 70, drive: 55, tone: 55 } },
    fuzz: { label: "Fuzz", values: { intensity: 100, drive: 90, tone: 40 } },
  },
  chorus: {
    light: { label: "Dezent", values: { intensity: 40, rate: 30, depth: 30 } },
    wide: { label: "Breit", values: { intensity: 70, rate: 45, depth: 60 } },
    seasick: { label: "Seekrank", values: { intensity: 100, rate: 25, depth: 90 } },
  },
  lofi: {
    mild: { label: "Leicht", values: { intensity: 50, crush: 25, tone: 30 } },
    crunchy: { label: "Knusprig", values: { intensity: 80, crush: 55, tone: 55 } },
    extreme: { label: "Extrem", values: { intensity: 100, crush: 85, tone: 75 } },
  },
  echo: {
    slap: { label: "Slapback", values: { intensity: 35, time: 12, feedback: 10 } },
    classic: { label: "Klassisches Echo", values: { intensity: 45, time: 35, feedback: 40 } },
    dub: { label: "Dub-Echo", values: { intensity: 60, time: 55, feedback: 65 } },
  },
};
export const DEFAULT_PRESET: Record<Kind, string> = { tape: "old", vinyl: "old", radio: "oldRadio", filter: "dull", distortion: "warm", chorus: "light", lofi: "mild", echo: "classic" };
export const TAPE_PRESETS = PRESETS.tape;
export const RADIO_PRESETS = PRESETS.radio;

export const defaultParams = (kind: Kind): Params => ({ on: false, preset: DEFAULT_PRESET[kind], ...PRESETS[kind][DEFAULT_PRESET[kind]].values });
/** Preset übernehmen (Schalter bleibt). Unbekannte Preset-Namen ändern nichts. */
export const applyPreset = (kind: Kind, p: Params, id: string): Params => (PRESETS[kind][id] ? { ...p, ...PRESETS[kind][id].values, preset: id } : p);
export const defaultProfile = (): EffectProfile => Object.fromEntries(KINDS.map((k) => [k, defaultParams(k)])) as unknown as EffectProfile;
export const defaultEffects = (): EffectsSettings => ({ enabled: false, profile: defaultProfile() });
export const defaultTape = (): TapeParams => defaultParams("tape") as unknown as TapeParams;
export const defaultRadio = (): RadioParams => defaultParams("radio") as unknown as RadioParams;
export const applyTapePreset = (p: TapeParams, id: string): TapeParams => applyPreset("tape", p as unknown as Params, id) as unknown as TapeParams;
export const applyRadioPreset = (p: RadioParams, id: string): RadioParams => applyPreset("radio", p as unknown as Params, id) as unknown as RadioParams;

export const activeKinds = (p: EffectProfile): Kind[] => KINDS.filter((k) => p[k].on);
export const hasActiveEffects = (p: EffectProfile): boolean => activeKinds(p).length > 0;

/** Welches Profil gilt für ein Pad? null = Original ohne Effekte. */
export function resolveProfile(pad: { fxMode?: FxMode; fxOwn?: EffectProfile }, global: EffectsSettings): EffectProfile | null {
  if (pad.fxMode === "own") return pad.fxOwn ?? defaultProfile();
  if (pad.fxMode === "global") return global.enabled ? global.profile : null;
  return null;
}

// ---- Umrechnung der Regler in Audio-Werte (ausgeschaltet = neutral) ----
const u = (v: number): number => Math.min(1, Math.max(0, v / 100));
const expo = (from: number, to: number, t: number): number => from * Math.pow(to / from, t); // gleichmäßig nach Gehör (logarithmisch)

export const TAPE_OFF = { lowpassHz: 20000, noiseGain: 0, wowDepth: 0, flutterDepth: 0, satWet: 0, clickGain: 0 };
export function tapeAudio(p: TapeParams): typeof TAPE_OFF {
  if (!p.on) return TAPE_OFF;
  const k = u(p.intensity); // Intensität skaliert alle Anteile
  return {
    lowpassHz: expo(20000, 3000, u(p.highLoss) * k), noiseGain: 0.08 * u(p.noise) * k,
    wowDepth: 0.003 * u(p.wow) * k, flutterDepth: 0.0001 * u(p.wow) * k, // Sekunden Verzögerung: langsam (Wow), schnell (Flutter)
    satWet: u(p.saturation) * k, clickGain: 0.25 * u(p.clicks ?? 0) * k,
  };
}
export const VINYL_OFF = { lowpassHz: 20000, noiseGain: 0, crackleGain: 0, wobbleDepth: 0 };
export function vinylAudio(p: VinylParams): typeof VINYL_OFF {
  if (!p.on) return VINYL_OFF;
  const k = u(p.intensity);
  return { lowpassHz: expo(20000, 4000, u(p.highLoss) * k), noiseGain: 0.05 * u(p.noise) * k, crackleGain: 0.35 * u(p.crackle) * k, wobbleDepth: 0.002 * u(p.wobble) * k };
}
export const RADIO_OFF = { hpHz: 20, lpHz: 20000, midDb: 0, mono: false };
export function radioAudio(p: RadioParams): typeof RADIO_OFF {
  if (!p.on) return RADIO_OFF;
  const k = u(p.intensity);
  return { hpHz: expo(20, 600, u(p.lows) * k), lpHz: expo(20000, 2500, u(p.highs) * k), midDb: 12 * u(p.mid) * k, mono: p.mono };
}
export const FILTER_OFF = { hpHz: 20, lpHz: 20000 };
export function filterAudio(p: FilterParams): typeof FILTER_OFF {
  if (!p.on) return FILTER_OFF;
  const k = u(p.intensity);
  return { hpHz: expo(20, 2000, u(p.highpass) * k), lpHz: expo(20000, 200, u(p.lowpass) * k) };
}
export const DISTORTION_OFF = { drive: 1, wet: 0, toneHz: 20000, post: 1 };
export function distortionAudio(p: DistortionParams): typeof DISTORTION_OFF {
  if (!p.on) return DISTORTION_OFF;
  const drive = 1 + 5 * u(p.drive);
  return { drive, wet: u(p.intensity), toneHz: expo(1500, 20000, u(p.tone)), post: 0.9 / Math.sqrt(drive) };
}
export const CHORUS_OFF = { wet: 0, rateHz: 0.8, depth: 0 };
export function chorusAudio(p: ChorusParams): typeof CHORUS_OFF {
  if (!p.on) return CHORUS_OFF;
  return { wet: 0.7 * u(p.intensity), rateHz: 0.2 + 3.8 * u(p.rate), depth: 0.004 * u(p.depth) };
}
export const LOFI_OFF = { bits: 16, toneHz: 20000, wet: 0 };
export function lofiAudio(p: LofiParams): typeof LOFI_OFF {
  if (!p.on) return LOFI_OFF;
  return { bits: Math.round(12 - 9 * u(p.crush)), toneHz: expo(20000, 2000, u(p.tone)), wet: u(p.intensity) };
}
export const ECHO_OFF = { timeSec: 0.3, feedback: 0, wet: 0 };
export function echoAudio(p: EchoParams): typeof ECHO_OFF {
  if (!p.on) return ECHO_OFF;
  return { timeSec: 0.06 + 0.84 * u(p.time), feedback: 0.85 * u(p.feedback), wet: 0.8 * u(p.intensity) };
}

// ---- Prüfung gespeicherter oder importierter Werte ----
const SCHEMA: Record<Kind, { nums: string[]; bools: string[]; optional?: string[] }> = {
  tape: { nums: ["intensity", "highLoss", "noise", "wow", "saturation"], bools: [], optional: ["clicks"] },
  vinyl: { nums: ["intensity", "noise", "crackle", "highLoss", "wobble"], bools: [] },
  radio: { nums: ["intensity", "lows", "highs", "mid"], bools: ["mono"] },
  filter: { nums: ["intensity", "lowpass", "highpass"], bools: [] },
  distortion: { nums: ["intensity", "drive", "tone"], bools: [] },
  chorus: { nums: ["intensity", "rate", "depth"], bools: [] },
  lofi: { nums: ["intensity", "crush", "tone"], bools: [] },
  echo: { nums: ["intensity", "time", "feedback"], bools: [] },
};
const pct = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;

/** Streng prüfen. Fehlende Effekte (z. B. aus Projekten vor Version 10) werden mit Standardwerten (aus) ergänzt, Ungültiges ergibt null. */
export function parseProfile(raw: unknown): EffectProfile | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>, out = defaultProfile() as unknown as Record<Kind, Params>;
  for (const kind of KINDS) {
    const t = r[kind];
    if (t === undefined) continue;
    if (typeof t !== "object" || t === null || Array.isArray(t)) return null;
    const o = t as Record<string, unknown>, s = SCHEMA[kind], res: Params = { ...defaultParams(kind) };
    if (typeof o.on !== "boolean" || typeof o.preset !== "string" || o.preset.length > 20) return null;
    res.on = o.on; res.preset = o.preset;
    for (const k of s.nums) { if (!pct(o[k])) return null; res[k] = o[k]; }
    for (const k of s.optional ?? []) if (o[k] !== undefined) { if (!pct(o[k])) return null; res[k] = o[k] as number; }
    for (const k of s.bools) { if (typeof o[k] !== "boolean") return null; res[k] = o[k]; }
    out[kind] = res;
  }
  return out as unknown as EffectProfile;
}
export function parseGlobalEffects(raw: unknown): EffectsSettings | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const profile = r.profile === undefined ? defaultProfile() : parseProfile(r.profile);
  return typeof r.enabled === "boolean" && profile ? { enabled: r.enabled, profile } : null;
}
