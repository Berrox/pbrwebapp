import { describe, expect, it } from "vitest";
import {
  CHORUS_OFF, DISTORTION_OFF, ECHO_OFF, FILTER_OFF, KINDS, LOFI_OFF, PRESETS, RADIO_OFF, TAPE_OFF, VINYL_OFF,
  activeKinds, applyPreset, applyRadioPreset, applyTapePreset, chorusAudio, defaultEffects, defaultParams, defaultProfile,
  distortionAudio, echoAudio, filterAudio, hasActiveEffects, lofiAudio, parseGlobalEffects, parseProfile, radioAudio,
  resolveProfile, tapeAudio, vinylAudio, type EffectProfile, type Kind, type Params,
} from "../src/model/effects";
import { generateCrackle, generateNoise } from "../src/audio/effectsChain";
import { summarizeEffects } from "../src/model/padSummary";

const only = (kind: Kind, preset: string): EffectProfile => {
  const p = defaultProfile() as unknown as Record<Kind, Params>;
  p[kind] = { ...applyPreset(kind, p[kind], preset), on: true };
  return p as unknown as EffectProfile;
};
const allOn = (): EffectProfile => {
  const p = defaultProfile() as unknown as Record<Kind, Params>;
  for (const k of KINDS) p[k] = { ...p[k], on: true };
  return p as unknown as EffectProfile;
};

describe("Effekte: Aufbau und Presets", () => {
  it("jeder Effekt hat Standardwerte (aus) und mindestens drei Presets mit gültigem Standard-Preset", () => {
    expect(KINDS).toHaveLength(8);
    for (const k of KINDS) {
      expect(defaultParams(k).on).toBe(false);
      expect(Object.keys(PRESETS[k]).length).toBeGreaterThan(2);
      expect(PRESETS[k][String(defaultParams(k).preset)] !== undefined).toBe(true);
    }
    expect(hasActiveEffects(defaultProfile())).toBe(false);
  });
  it("Preset übernimmt die Werte und behält den Schalter; unbekannte Namen ändern nichts", () => {
    const worn = applyTapePreset({ ...defaultProfile().tape, on: true }, "worn");
    expect(worn).toMatchObject({ on: true, preset: "worn", intensity: 90, highLoss: 70, clicks: 15 });
    expect(applyTapePreset(worn, "gibtsnicht")).toBe(worn);
    expect(applyRadioPreset(defaultProfile().radio, "phone")).toMatchObject({ preset: "phone", mono: true });
    expect(activeKinds(allOn())).toEqual(KINDS);
  });
  it("Auswahl pro Pad: keine, global (nur wenn eingeschaltet) oder eigene Effekte", () => {
    const g = { enabled: true, profile: allOn() };
    expect(resolveProfile({}, g)).toBe(null);
    expect(resolveProfile({ fxMode: "off", fxOwn: allOn() }, g)).toBe(null);
    expect(resolveProfile({ fxMode: "global" }, g)).toBe(g.profile);
    expect(resolveProfile({ fxMode: "global" }, { ...g, enabled: false })).toBe(null);
    const own = allOn();
    expect(resolveProfile({ fxMode: "own", fxOwn: own }, { ...g, enabled: false })).toBe(own);
    expect(hasActiveEffects(resolveProfile({ fxMode: "own" }, g)!)).toBe(false);
  });
  it("Kurzfassung im Pad-Dialog nennt die aktiven Effekte in fester Reihenfolge", () => {
    const g = { enabled: true, profile: only("tape", "old") };
    expect(summarizeEffects("off", defaultProfile(), g)).toBe("Keine (Original)");
    expect(summarizeEffects("global", defaultProfile(), g)).toBe("Global: Tape");
    expect(summarizeEffects("global", defaultProfile(), { ...g, enabled: false })).toBe("Global (aus): Tape");
    expect(summarizeEffects("own", allOn(), g)).toBe("Eigene: Tape + Vinyl + Radio + Filter + Verzerrung + Chorus + Lo-Fi + Echo");
    expect(summarizeEffects("own", defaultProfile(), g)).toBe("Eigene: nichts aktiv");
  });
});

describe("Effekte: Umrechnung in Audio-Werte", () => {
  it("ausgeschaltet ist jeder Effekt neutral", () => {
    const d = defaultProfile();
    expect(tapeAudio(d.tape)).toEqual(TAPE_OFF);
    expect(vinylAudio(d.vinyl)).toEqual(VINYL_OFF);
    expect(radioAudio(d.radio)).toEqual(RADIO_OFF);
    expect(filterAudio(d.filter)).toEqual(FILTER_OFF);
    expect(distortionAudio(d.distortion)).toEqual(DISTORTION_OFF);
    expect(chorusAudio(d.chorus)).toEqual(CHORUS_OFF);
    expect(lofiAudio(d.lofi)).toEqual(LOFI_OFF);
    expect(echoAudio(d.echo)).toEqual(ECHO_OFF);
    expect(tapeAudio({ ...d.tape, on: true, intensity: 0 })).toEqual(TAPE_OFF); // Intensität 0 = neutral
  });
  it("Tape: stärkere Presets klingen stärker, Knackser nur beim abgenutzten Tape", () => {
    const base = { ...defaultProfile().tape, on: true };
    const clean = tapeAudio(applyTapePreset(base, "clean")), worn = tapeAudio(applyTapePreset(base, "worn"));
    expect(worn.lowpassHz).toBeLessThan(clean.lowpassHz);
    expect(worn.noiseGain).toBeGreaterThan(clean.noiseGain);
    expect(worn.wowDepth).toBeGreaterThan(clean.wowDepth);
    expect(worn.satWet).toBeGreaterThan(clean.satWet);
    expect(clean.clickGain).toBe(0);
    expect(worn.clickGain).toBeGreaterThan(0);
  });
  it("Vinyl: Preset-Stufen werden lauter und dumpfer", () => {
    const c = vinylAudio(only("vinyl", "clean").vinyl), h = vinylAudio(only("vinyl", "heavy").vinyl);
    expect(h.crackleGain).toBeGreaterThan(c.crackleGain);
    expect(h.noiseGain).toBeGreaterThan(c.noiseGain);
    expect(h.lowpassHz).toBeLessThan(c.lowpassHz);
    expect(h.wobbleDepth).toBeGreaterThan(c.wobbleDepth);
  });
  it("Radio: Telefon liegt bei etwa 300 bis 3400 Hz und ist mono", () => {
    const phone = radioAudio(only("radio", "phone").radio);
    expect(phone.hpHz).toBeGreaterThan(280);
    expect(phone.hpHz).toBeLessThan(330);
    expect(phone.lpHz).toBeGreaterThan(3200);
    expect(phone.lpHz).toBeLessThan(3600);
    expect(phone.mono).toBe(true);
    expect(radioAudio(only("radio", "oldRadio").radio).mono).toBe(false);
  });
  it("Filter: Tiefpass bis etwa 200 Hz, Hochpass bis etwa 2 kHz", () => {
    const p = only("filter", "dull").filter;
    expect(filterAudio({ ...p, lowpass: 100, highpass: 0 }).lpHz).toBeCloseTo(200, 0);
    expect(filterAudio({ ...p, lowpass: 0, highpass: 100 }).hpHz).toBeCloseTo(2000, 0);
    expect(filterAudio({ ...p, lowpass: 0, highpass: 0 })).toEqual(FILTER_OFF);
  });
  it("Verzerrung, Chorus, Lo-Fi und Echo bleiben in sinnvollen Bereichen", () => {
    const d = only("distortion", "fuzz").distortion;
    expect(distortionAudio({ ...d, drive: 100 }).drive).toBe(6);
    expect(distortionAudio({ ...d, drive: 0 }).drive).toBe(1);
    const c = chorusAudio({ ...only("chorus", "wide").chorus, rate: 100, depth: 100, intensity: 100 });
    expect(c.rateHz).toBeCloseTo(4, 5);
    expect(c.depth).toBeLessThan(0.0201 / 5); // bleibt unter der Basisverzögerung von 20 ms
    expect(lofiAudio({ ...only("lofi", "mild").lofi, crush: 0 }).bits).toBe(12);
    expect(lofiAudio({ ...only("lofi", "mild").lofi, crush: 100 }).bits).toBe(3);
    const e = echoAudio({ ...only("echo", "dub").echo, time: 100, feedback: 100 });
    expect(e.timeSec).toBeLessThan(1.5);
    expect(e.feedback).toBeLessThan(0.9); // Rückkopplung bleibt stabil
  });
});

describe("Effekte: Prüfung gespeicherter Werte", () => {
  it("gültige Profile bleiben gleich, ältere Profile (nur Tape und Radio, ohne Knackser) werden ergänzt", () => {
    const p = allOn();
    expect(parseProfile(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(parseProfile({})).toEqual(defaultProfile());
    const v9 = { tape: { on: true, intensity: 50, highLoss: 20, noise: 10, wow: 10, saturation: 10, preset: "old" }, radio: defaultProfile().radio };
    const r = parseProfile(v9)!;
    expect(r.tape).toMatchObject({ on: true, intensity: 50, clicks: 0 });
    expect(r.vinyl).toEqual(defaultProfile().vinyl);
    expect(r.echo.on).toBe(false);
  });
  it("ungültige Werte werden abgelehnt", () => {
    const p = allOn();
    expect(parseProfile(null)).toBe(null);
    expect(parseProfile([])).toBe(null);
    expect(parseProfile({ tape: { ...p.tape, intensity: 120 } })).toBe(null);
    expect(parseProfile({ vinyl: { ...p.vinyl, crackle: -1 } })).toBe(null);
    expect(parseProfile({ echo: { ...p.echo, feedback: "viel" } })).toBe(null);
    expect(parseProfile({ lofi: { ...p.lofi, on: "ja" } })).toBe(null);
    expect(parseProfile({ chorus: { ...p.chorus, preset: "x".repeat(30) } })).toBe(null);
    expect(parseProfile({ radio: { ...p.radio, mono: 1 } })).toBe(null);
    expect(parseProfile({ filter: [] })).toBe(null);
    expect(parseGlobalEffects({ enabled: "an" })).toBe(null);
    expect(parseGlobalEffects({ enabled: true })).toEqual({ enabled: true, profile: defaultProfile() });
    expect(parseGlobalEffects(defaultEffects())).toEqual(defaultEffects());
  });
});

describe("Rauschen und Knistern", () => {
  it("Bandrauschen: richtige Länge, immer gleich, normalisiert und mittelwertfrei", () => {
    const a = generateNoise(8000, 2), b = generateNoise(8000, 2);
    expect(a.length).toBe(16000);
    expect(Array.from(a.slice(0, 50))).toEqual(Array.from(b.slice(0, 50)));
    let peak = 0, sum = 0;
    for (const v of a) { peak = Math.max(peak, Math.abs(v)); sum += v; }
    expect(peak).toBeCloseTo(1, 5);
    expect(Math.abs(sum / a.length)).toBeLessThan(0.1);
  });
  it("Knistern: selten, immer gleich, normalisiert und mit einigen deutlichen Knacksern", () => {
    const a = generateCrackle(8000, 6), b = generateCrackle(8000, 6);
    expect(a.length).toBe(48000);
    expect(Array.from(a.slice(0, 2000))).toEqual(Array.from(b.slice(0, 2000)));
    let peak = 0, active = 0, loud = 0;
    for (const v of a) { peak = Math.max(peak, Math.abs(v)); if (Math.abs(v) > 0.01) active++; if (Math.abs(v) > 0.5) loud++; }
    expect(peak).toBeCloseTo(1, 5);
    expect(active / a.length).toBeLessThan(0.25); // meist Stille zwischen den Knacksern
    expect(loud).toBeGreaterThan(0);
  });
});
