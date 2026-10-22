import { beforeEach, describe, expect, it } from "vitest";
import { AudioEngine } from "../src/audio/AudioEngine";
import type { Fx } from "../src/model/fx";

class P {
  value = 1; events: [string, number][] = [];
  cancelScheduledValues(_t: number) { this.events.push(["cancel", 0]); }
  setValueAtTime(v: number, _t: number) { this.events.push(["set", v]); }
  linearRampToValueAtTime(v: number, _t: number) { this.events.push(["ramp", v]); }
  setTargetAtTime(v: number, _t: number, _c: number) { this.events.push(["target", v]); this.value = v; }
}
class N {
  connections: unknown[] = []; disconnected = 0;
  connect(n: unknown) { this.connections.push(n); return n; }
  disconnect() { this.disconnected++; this.connections = []; }
}
class Gain extends N { gain = new P(); }
class Filter extends N { type = ""; frequency = { value: 0 }; Q = { value: 0 }; gain = new P(); }
class Conv extends N { buffer: unknown = null; }
class Src extends N { buffer: unknown = null; loop = false; stopped = false; onended: (() => void) | null = null; start() {} stop() { this.stopped = true; } }

let gains: Gain[], filters: Filter[], convs: Conv[], sources: Src[];
class Ctx {
  state = "running"; currentTime = 10; sampleRate = 8000; destination = {};
  resume() { return Promise.resolve(); }
  createGain() { const g = new Gain(); gains.push(g); return g; }
  createBiquadFilter() { const f = new Filter(); filters.push(f); return f; }
  createConvolver() { const c = new Conv(); convs.push(c); return c; }
  createBufferSource() { const s = new Src(); sources.push(s); return s; }
  createBuffer(ch: number, length: number) { return { numberOfChannels: ch, length, copyToChannel() {} }; }
}
const buf = { duration: 30 } as AudioBuffer;
const flat: Fx = { low: 0, mid: 0, high: 0, reverb: 0, size: "room" };
const withReverb = (reverb: number, size: Fx["size"] = "room"): Fx => ({ ...flat, reverb, size });
let engine: AudioEngine;

beforeEach(() => {
  gains = []; filters = []; convs = []; sources = [];
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = Ctx;
  engine = new AudioEngine();
});

// Reihenfolge der Gain-Knoten: [0] Master, dann je Pad: Pad-Gain, Dry, Send; Hall-Bus (Ausgang) beim ersten Bedarf.
describe("EQ und Hall", () => {
  it("ohne Effekte: keine zusätzlichen Knoten, das Pad läuft direkt zum Master", () => {
    engine.play("a", buf, { volume: 1, loop: false });
    engine.play("b", buf, { volume: 1, loop: false, fx: flat });
    expect(filters).toHaveLength(0);
    expect(convs).toHaveLength(0);
    expect(gains[1].connections[0]).toBe(gains[0]);
    expect(gains[2].connections[0]).toBe(gains[0]);
  });
  it("EQ: drei Filter in der richtigen Reihenfolge mit den eingestellten Werten, ohne Hall kein Hall-Bus", () => {
    engine.play("a", buf, { volume: 1, loop: false, fx: { low: 3, mid: -2, high: 6, reverb: 0, size: "room" } });
    expect(filters.map((f) => f.type)).toEqual(["lowshelf", "peaking", "highshelf"]);
    expect(filters.map((f) => f.frequency.value)).toEqual([120, 1000, 6000]);
    expect(filters.map((f) => f.gain.value)).toEqual([3, -2, 6]);
    const [master, pad, dry, send] = gains;
    expect(pad.connections[0]).toBe(filters[0]);
    expect(filters[0].connections[0]).toBe(filters[1]);
    expect(filters[1].connections[0]).toBe(filters[2]);
    expect(filters[2].connections).toContain(dry);
    expect(dry.connections[0]).toBe(master);
    expect(convs).toHaveLength(0);
    expect(send.connections).toHaveLength(0);
  });
  it("Hall: Menge, Weg über den gemeinsamen Hall-Raum zum Master; gleiche Größe teilt sich einen Raum", () => {
    engine.play("a", buf, { volume: 1, loop: false, fx: withReverb(0.4, "hall") });
    const [master, , , send, out] = gains;
    expect(send.gain.value).toBe(0.4);
    expect(convs).toHaveLength(1);
    expect(send.connections[0]).toBe(convs[0]);
    expect(convs[0].connections[0]).toBe(out);
    expect(out.connections[0]).toBe(master);
    engine.play("b", buf, { volume: 1, loop: false, fx: withReverb(0.2, "hall") });
    expect(convs).toHaveLength(1);
    engine.play("c", buf, { volume: 1, loop: false, fx: withReverb(0.2, "church") });
    expect(convs).toHaveLength(2);
  });
  it("laufendes Pad: Effekte werden bei Bedarf eingebaut und danach nur noch angepasst", () => {
    engine.play("a", buf, { volume: 1, loop: false });
    engine.setEffects("a", flat);
    expect(filters).toHaveLength(0);
    engine.setEffects("a", { ...flat, low: 4 });
    expect(filters).toHaveLength(3);
    expect(gains[1].disconnected).toBeGreaterThan(0);
    expect(gains[1].connections[0]).toBe(filters[0]);
    engine.setEffects("a", { ...flat, low: -5 });
    expect(filters).toHaveLength(3);
    expect(filters[0].gain.value).toBe(-5);
  });
  it("laufendes Pad: Hall-Größe wechseln und Hall abschalten", () => {
    engine.play("a", buf, { volume: 1, loop: false, fx: withReverb(0.5, "room") });
    const send = gains[3];
    engine.setEffects("a", withReverb(0.5, "church"));
    expect(convs).toHaveLength(2);
    expect(send.connections[0]).toBe(convs[1]);
    engine.setEffects("a", withReverb(0, "church"));
    expect(send.connections).toHaveLength(0);
  });
  it("normales Stoppen schneidet den Hall nicht ab", () => {
    engine.play("a", buf, { volume: 1, loop: true, fx: withReverb(0.5) });
    const out = gains[4];
    engine.stop("a");
    expect(out.gain.events.filter((e) => e[0] === "ramp")).toHaveLength(0);
  });
  it("STOP ALL schaltet den Hall sofort ab und baut ihn beim nächsten Start neu auf", () => {
    engine.play("a", buf, { volume: 1, loop: true, fx: withReverb(0.5) });
    const out = gains[4];
    engine.stopAll();
    expect(out.gain.events.some((e) => e[0] === "ramp" && e[1] === 0)).toBe(true);
    expect(sources[0].stopped).toBe(true);
    expect(engine.isPlaying("a")).toBe(false);
    engine.play("b", buf, { volume: 1, loop: false, fx: withReverb(0.5) });
    expect(convs).toHaveLength(2);
  });
  it("am natürlichen Ende werden die Effekt-Knoten getrennt", () => {
    engine.play("a", buf, { volume: 1, loop: false, fx: { low: 2, mid: 0, high: 0, reverb: 0.3, size: "room" } });
    sources[0].onended!();
    expect(filters.every((f) => f.disconnected > 0)).toBe(true);
    expect(gains[3].disconnected).toBeGreaterThan(0);
    expect(engine.isPlaying("a")).toBe(false);
  });
  it("mehrere Pads mit verschiedenen Effekten beeinflussen sich nicht", () => {
    engine.play("a", buf, { volume: 1, loop: true, fx: { low: 5, mid: 0, high: 0, reverb: 0, size: "room" } });
    engine.play("b", buf, { volume: 1, loop: true, fx: { low: -3, mid: 0, high: 0, reverb: 0, size: "room" } });
    expect(filters.map((f) => f.gain.value).filter((_, i) => i % 3 === 0)).toEqual([5, -3]);
    engine.setEffects("a", { ...flat, low: 9 });
    expect(filters[0].gain.value).toBe(9);
    expect(filters[3].gain.value).toBe(-3);
  });
  it("Probehören: Effektkette wird auch bei Klang aus aufgebaut, spätere Änderungen bauen nichts mehr um", () => {
    engine.play("p", buf, { volume: 1, loop: true, fx: flat, forceChain: true });
    expect(filters).toHaveLength(3);
    expect(convs).toHaveLength(0);
    const padGain = gains[1];
    expect(padGain.connections[0]).toBe(filters[0]);
    const before = padGain.disconnected;
    engine.setEffects("p", { ...flat, low: 6 });
    expect(filters).toHaveLength(3);
    expect(padGain.disconnected).toBe(before);
    expect(filters[0].gain.value).toBe(6);
  });
});
