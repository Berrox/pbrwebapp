import { beforeEach, describe, expect, it } from "vitest";
import { AudioEngine } from "../src/audio/AudioEngine";
import { quantCurve } from "../src/audio/effectModules";
import { createFxChain } from "../src/audio/effectsChain";
import {
  KINDS, applyPreset, chorusAudio, defaultProfile, distortionAudio, echoAudio, filterAudio, lofiAudio, radioAudio,
  tapeAudio, vinylAudio, type EffectProfile, type Kind, type Params,
} from "../src/model/effects";

class P {
  value = 0; events: [string, number][] = [];
  cancelScheduledValues() {}
  setValueAtTime(v: number) { this.events.push(["set", v]); }
  linearRampToValueAtTime(v: number) { this.events.push(["ramp", v]); }
  setTargetAtTime(v: number) { this.events.push(["target", v]); this.value = v; }
}
class N { connections: unknown[] = []; disconnected = 0; connect(n: unknown) { this.connections.push(n); return n; } disconnect() { this.disconnected++; this.connections = []; } }
class Gain extends N { gain = new P(); channelCount = 2; channelCountMode = "max"; channelInterpretation = "speakers"; }
class Filter extends N { type = ""; frequency = new P(); Q = new P(); gain = new P(); }
class Osc extends N { frequency = new P(); started = 0; stopped = 0; start() { this.started++; } stop() { this.stopped++; } }
class Delay extends N { delayTime = new P(); max = 0; }
class Shaper extends N { curve: Float32Array | null = null; oversample = ""; }
class Src extends N { buffer: unknown = null; loop = false; started = 0; stopped = 0; onended: (() => void) | null = null; start() { this.started++; } stop() { this.stopped++; } }

let gains: Gain[], filters: Filter[], oscs: Osc[], sources: Src[], delays: Delay[], shapers: Shaper[];
class Ctx {
  state = "running"; currentTime = 10; sampleRate = 8000; destination = {};
  resume() { return Promise.resolve(); }
  createGain() { const g = new Gain(); gains.push(g); return g; }
  createBiquadFilter() { const f = new Filter(); filters.push(f); return f; }
  createOscillator() { const o = new Osc(); oscs.push(o); return o; }
  createDelay(max: number) { const d = new Delay(); d.max = max; delays.push(d); return d; }
  createWaveShaper() { const s = new Shaper(); shapers.push(s); return s; }
  createBufferSource() { const s = new Src(); sources.push(s); return s; }
  createConvolver() { return new N(); }
  createBuffer(ch: number, length: number) { return { numberOfChannels: ch, length, copyToChannel() {} }; }
}
const buf = { duration: 30 } as AudioBuffer;
const prof = (...specs: [Kind, string][]): EffectProfile => {
  const p = defaultProfile() as unknown as Record<Kind, Params>;
  for (const [k, id] of specs) p[k] = { ...applyPreset(k, p[k], id), on: true };
  return p as unknown as EffectProfile;
};
const res = { noise: {} as AudioBuffer, crackle: {} as AudioBuffer };
const make = (p: EffectProfile, kinds?: Kind[]) => {
  const feed = new Gain();
  const chain = createFxChain(new Ctx() as unknown as AudioContext, p, feed as unknown as AudioNode, res, kinds);
  return { chain, feed };
};
const feeders = (feed: unknown) => gains.filter((g) => g.connections.includes(feed));
const filt = (type: string) => filters.filter((f) => f.type === type);
let engine: AudioEngine;

beforeEach(() => {
  gains = []; filters = []; oscs = []; sources = []; delays = []; shapers = [];
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = Ctx;
  engine = new AudioEngine();
});

describe("Effekt-Bausteine", () => {
  it("Tape: Tiefpass, Sättigung, Wow/Flutter, Rauschen und Knackser", () => {
    const p = prof(["tape", "worn"]), t = tapeAudio(p.tape), { feed } = make(p);
    expect(filt("lowpass")[0].frequency.value).toBe(t.lowpassHz);
    expect(oscs).toHaveLength(3);
    expect(oscs.every((o) => o.started === 1)).toBe(true);
    expect(sources).toHaveLength(2);
    expect(sources.every((s) => s.started === 1 && s.loop)).toBe(true);
    expect(feeders(feed).map((g) => g.gain.value).sort()).toEqual([t.clickGain, t.noiseGain].sort());
    expect(shapers[0].curve).not.toBe(null);
    expect(delays[0].delayTime.value).toBe(0.01);
  });
  it("Radio: Telefon setzt Hoch- und Tiefpass, Mitten und Mono; keine Quellen", () => {
    const p = prof(["radio", "phone"]), r = radioAudio(p.radio);
    make(p);
    expect(filt("highpass")[0].frequency.value).toBe(r.hpHz);
    expect(filt("lowpass")[0].frequency.value).toBe(r.lpHz);
    expect(filt("peaking")[0].gain.value).toBe(r.midDb);
    expect(gains.find((g) => g.channelCountMode === "explicit")!.channelCount).toBe(1);
    expect(oscs).toHaveLength(0);
    expect(sources).toHaveLength(0);
  });
  it("Vinyl: Tiefpass, Plattenteller-Schwankung (33 U/min), Rauschen und Knistern", () => {
    const p = prof(["vinyl", "heavy"]), t = vinylAudio(p.vinyl), { feed } = make(p);
    expect(filt("lowpass")[0].frequency.value).toBe(t.lowpassHz);
    expect(oscs).toHaveLength(1);
    expect(oscs[0].frequency.value).toBe(0.555);
    expect(sources).toHaveLength(2);
    expect(feeders(feed).map((g) => g.gain.value).sort()).toEqual([t.crackleGain, t.noiseGain].sort());
    expect(gains.some((g) => g.gain.value === t.wobbleDepth)).toBe(true);
  });
  it("Filter: Hoch- und Tiefpass", () => {
    const p = prof(["filter", "band"]), t = filterAudio(p.filter);
    make(p);
    expect(filt("highpass")[0].frequency.value).toBe(t.hpHz);
    expect(filt("lowpass")[0].frequency.value).toBe(t.lpHz);
  });
  it("Verzerrung: Vorverstärkung, Klangregler und Anteil", () => {
    const p = prof(["distortion", "fuzz"]), t = distortionAudio(p.distortion);
    make(p);
    expect(shapers[0].curve).not.toBe(null);
    expect(gains.some((g) => g.gain.value === t.drive)).toBe(true);
    expect(gains.some((g) => g.gain.value === t.wet * t.post)).toBe(true);
    expect(filt("lowpass")[0].frequency.value).toBe(t.toneHz);
  });
  it("Chorus: verzögerte Kopie mit Schwingung in der eingestellten Geschwindigkeit", () => {
    const p = prof(["chorus", "wide"]), t = chorusAudio(p.chorus);
    make(p);
    expect(delays[0].delayTime.value).toBe(0.02);
    expect(oscs[0].frequency.value).toBe(t.rateHz);
    expect(gains.some((g) => g.gain.value === t.wet)).toBe(true);
  });
  it("Lo-Fi: Treppenkurve mit der passenden Anzahl Stufen, ausgeschaltet keine Kurve", () => {
    const p = prof(["lofi", "extreme"]), bits = lofiAudio(p.lofi).bits;
    make(p);
    expect(new Set(Array.from(shapers[0].curve!)).size).toBe(Math.pow(2, bits) + 1);
    expect(new Set(Array.from(quantCurve(3))).size).toBe(9);
    shapers.length = 0;
    make(defaultProfile(), ["lofi"]);
    expect(shapers[0].curve).toBe(null);
  });
  it("Echo: Verzögerung, Rückkopplung, Nachhallzeit nur bei eingeschaltetem Echo", () => {
    const p = prof(["echo", "classic"]), t = echoAudio(p.echo);
    const { chain } = make(p);
    expect(delays[0].max).toBe(1.5);
    expect(delays[0].delayTime.value).toBe(t.timeSec);
    expect(gains.some((g) => g.gain.value === t.feedback)).toBe(true);
    expect(chain.tail()).toBeGreaterThan(0);
    expect(chain.tail()).toBeLessThan(6.01);
    expect(make(defaultProfile(), ["echo"]).chain.tail()).toBe(0);
  });
  it("gebaut werden nur die eingeschalteten Effekte", () => {
    make(prof(["tape", "old"]));
    expect(oscs).toHaveLength(3);
    expect(filters).toHaveLength(1);
    expect(delays).toHaveLength(1);
    const { chain } = make(prof(["radio", "phone"]));
    expect([...chain.modules]).toEqual(["radio"]);
    expect(oscs).toHaveLength(3); // unverändert, Radio hat keine Schwingungen
  });
  it("update ändert weich ohne neue Knoten; ausgeschaltet ist alles neutral", () => {
    const { chain, feed } = make(prof(["tape", "worn"], ["vinyl", "heavy"], ["radio", "phone"], ["echo", "dub"]), [...KINDS]);
    const count = gains.length + filters.length + oscs.length;
    chain.update(defaultProfile());
    expect(gains.length + filters.length + oscs.length).toBe(count);
    expect(filters[0].frequency.events.some((e) => e[0] === "target" && e[1] === 20000)).toBe(true);
    expect(feeders(feed).every((g) => g.gain.value === 0)).toBe(true); // alles Rauschen und Knistern aus
    expect(gains.find((g) => g.channelCountMode === "explicit")!.channelCount).toBe(2);
    expect(chain.tail()).toBe(0);
  });
  it("release beendet Rauschen und Schwingungen, das Echo bleibt verbunden; dispose trennt alles", () => {
    const { chain } = make(prof(["tape", "old"], ["echo", "dub"]));
    chain.release();
    expect(oscs.every((o) => o.stopped > 0)).toBe(true);
    expect(sources.every((s) => s.stopped > 0)).toBe(true);
    expect(delays.every((d) => d.disconnected === 0)).toBe(true);
    chain.dispose();
    expect(delays.every((d) => d.disconnected > 0)).toBe(true);
    expect(gains.every((g) => g.disconnected > 0)).toBe(true);
  });
});

describe("Effekte in der Engine", () => {
  // gains: [0] Master, [1] Pad-Lautstärke, [2] Eingang und [3] Ausgang der Effektkette.
  it("ohne Profil oder mit allem aus entstehen keine zusätzlichen Knoten", () => {
    engine.play("a", buf, { volume: 1, loop: false });
    engine.play("b", buf, { volume: 1, loop: false, fxProfile: defaultProfile() });
    expect(oscs).toHaveLength(0);
    expect(filters).toHaveLength(0);
    expect(sources).toHaveLength(2);
    expect(gains[1].connections[0]).toBe(gains[0]);
  });
  it("Pad -> Effekte -> Master, Rauschen und Knackser laufen durch die Pad-Lautstärke", () => {
    engine.play("a", buf, { volume: 0.8, loop: true, fxProfile: prof(["tape", "worn"]) });
    expect(gains[1].connections[0]).toBe(gains[2]);
    expect(gains[2].connections[0]).toBe(filters[0]);
    expect(gains[3].connections[0]).toBe(gains[0]);
    expect(feeders(gains[1])).toHaveLength(2);
    expect(sources[1].started).toBe(1);
  });
  it("mit EQ: Pad -> Effekte -> EQ -> Master", () => {
    engine.play("a", buf, { volume: 1, loop: true, fxProfile: prof(["tape", "old"]), fx: { low: 3, mid: 0, high: 0, reverb: 0, size: "room" } });
    expect(gains[1].connections).toHaveLength(1);
    expect(gains[3].connections[0]).toBe(filters[1]); // erster EQ-Filter nach dem Tape-Tiefpass
  });
  it("Ende der Wiedergabe beendet Rauschen, Knistern und Schwingungen", () => {
    engine.play("a", buf, { volume: 1, loop: false, fxProfile: prof(["tape", "old"], ["vinyl", "old"]) });
    sources[0].onended!();
    expect(engine.isPlaying("a")).toBe(false);
    expect(sources.slice(1).every((s) => s.stopped > 0)).toBe(true);
    expect(oscs.every((o) => o.stopped > 0)).toBe(true);
  });
  it("Echo klingt nach dem Ende noch aus, STOP ALL beendet es sofort", () => {
    engine.play("a", buf, { volume: 1, loop: false, fxProfile: prof(["echo", "dub"]) });
    sources[0].onended!();
    expect(delays[0].disconnected).toBe(0);
    engine.stopAll();
    expect(delays[0].disconnected).toBeGreaterThan(0);
  });
  it("Stoppen und STOP ALL: danach laufen keine Rausch- oder Schwingungsquellen weiter", () => {
    engine.play("a", buf, { volume: 1, loop: true, fxProfile: prof(["tape", "old"]) });
    engine.play("b", buf, { volume: 1, loop: true, fxProfile: prof(["vinyl", "old"], ["chorus", "wide"]) });
    engine.stop("a");
    engine.stopAll();
    expect(engine.playingIds()).toHaveLength(0);
    sources.filter((s) => s.onended).forEach((s) => s.onended!());
    expect(sources.slice(1).filter((s) => s.stopped === 0)).toHaveLength(0);
    expect(oscs.every((o) => o.stopped > 0)).toBe(true);
  });
  it("laufendes Pad: ein weiterer Effekt wird eingeschaltet, die Kette wird einmal neu aufgebaut", () => {
    engine.play("a", buf, { volume: 1, loop: true, fxProfile: prof(["tape", "old"]) });
    const oldInput = gains[2];
    engine.setProfile("a", prof(["tape", "old"], ["radio", "phone"]));
    expect(gains[1].connections).toHaveLength(1);
    expect(gains[1].connections[0]).not.toBe(oldInput);
    expect(oldInput.disconnected).toBeGreaterThan(0);
    expect(oscs.slice(0, 3).every((o) => o.stopped > 0)).toBe(true); // alte Schwingungen beendet
    expect(filt("highpass")).toHaveLength(1);
    expect(engine.isPlaying("a")).toBe(true);
  });
  it("vorhandene Effekte ein- und ausschalten baut nichts um, auch bei schnellem Wechsel", () => {
    engine.play("a", buf, { volume: 1, loop: true, fxProfile: prof(["tape", "old"]) });
    for (let i = 0; i < 20; i++) engine.setProfile("a", i % 2 ? prof(["tape", "worn"]) : null);
    expect(oscs).toHaveLength(3);
    expect(sources).toHaveLength(3);
  });
  it("A/B-Vorschau: alle Effekte stehen bereit, Umschalten und Einschalten baut nichts um", () => {
    engine.play("p", buf, { volume: 1, loop: true, fxProfile: defaultProfile(), forceFx: true });
    expect(oscs).toHaveLength(5); // Tape (3) + Vinyl (1) + Chorus (1)
    const input = gains[2];
    for (const p of [prof(["tape", "old"]), null, prof(["echo", "dub"], ["vinyl", "old"]), defaultProfile()]) engine.setProfile("p", p);
    expect(oscs).toHaveLength(5);
    expect(gains[1].connections[0]).toBe(input);
  });
  it("zwei Pads mit verschiedenen Effekten beeinflussen sich nicht", () => {
    engine.play("a", buf, { volume: 1, loop: true, fxProfile: prof(["tape", "worn"]) });
    engine.play("b", buf, { volume: 1, loop: true, fxProfile: prof(["radio", "phone"]) });
    const hp = filt("highpass")[0].frequency.value;
    engine.setProfile("a", null);
    expect(filt("highpass")[0].frequency.value).toBe(hp);
    engine.stop("a");
    expect(engine.isPlaying("b")).toBe(true);
    expect(() => engine.setProfile("gibtsnicht", prof(["tape", "old"]))).not.toThrow();
  });
});
