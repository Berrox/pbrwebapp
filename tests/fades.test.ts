import { beforeEach, describe, expect, it } from "vitest";
import { AudioEngine } from "../src/audio/AudioEngine";

type Ev = [string, number, number?];
class Param {
  value = 1; events: Ev[] = [];
  cancelScheduledValues(t: number) { this.events.push(["cancel", t]); }
  setValueAtTime(v: number, t: number) { this.events.push(["set", v, t]); }
  linearRampToValueAtTime(v: number, t: number) { this.events.push(["ramp", v, t]); }
  setTargetAtTime(v: number, t: number) { this.events.push(["target", v, t]); this.value = v; }
}
class Gain { gain = new Param(); target: unknown = null; connect(n: unknown) { this.target = n; return n; } disconnect() {} }
class Source {
  buffer: unknown = null; loop = false; stopped = false; stopAt: number | undefined; onended: (() => void) | null = null;
  connect(n: unknown) { return n; } disconnect() {} start() {} stop(when?: number) { this.stopped = true; this.stopAt = when; }
}
let gains: Gain[], sources: Source[], ctx: Ctx;
class Ctx {
  state = "running"; currentTime = 10; destination = {};
  constructor() { ctx = this; }
  resume() { return Promise.resolve(); }
  createBufferSource() { const s = new Source(); sources.push(s); return s; }
  createGain() { const g = new Gain(); gains.push(g); return g; }
}
const buf = (duration: number) => ({ duration }) as AudioBuffer;
let engine: AudioEngine;
const master = () => gains[0];
const pad = (i: number) => gains[i + 1]; // gains[0] ist der Master
const lastRamp = (g: Gain) => [...g.gain.events].reverse().find((e) => e[0] === "ramp");

beforeEach(() => {
  gains = []; sources = [];
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = Ctx;
  engine = new AudioEngine();
});

describe("Einblenden und Ausblenden", () => {
  it("Einblenden: Lautstärke steigt von 0 auf den Wert", () => {
    engine.play("a", buf(10), { volume: 0.8, loop: false, fadeIn: 2 });
    expect(pad(0).gain.events).toContainEqual(["set", 0, 10]);
    expect(pad(0).gain.events).toContainEqual(["ramp", 0.8, 12]);
  });
  it("ohne Fade bleibt es bei direkter Lautstärke und es gibt keine Rampen", () => {
    engine.play("a", buf(10), { volume: 0.8, loop: false });
    expect(pad(0).gain.value).toBe(0.8);
    expect(pad(0).gain.events.filter((e) => e[0] === "ramp")).toEqual([]);
  });
  it("One-Shot blendet am Ende automatisch aus", () => {
    engine.play("a", buf(10), { volume: 0.8, loop: false, fadeOut: 3 });
    expect(pad(0).gain.events).toContainEqual(["set", 0.8, 17]);
    expect(lastRamp(pad(0))).toEqual(["ramp", 0, 20]);
  });
  it("bei kurzem One-Shot überlappen Ein- und Ausblenden nicht", () => {
    engine.play("a", buf(4), { volume: 1, loop: false, fadeIn: 10, fadeOut: 10 });
    expect(pad(0).gain.events).toContainEqual(["ramp", 1, 12]);
    expect(pad(0).gain.events).toContainEqual(["set", 1, 12]);
    expect(lastRamp(pad(0))).toEqual(["ramp", 0, 14]);
  });
  it("Loop: Einblenden ja, kein automatisches Ausblenden am Ende", () => {
    engine.play("a", buf(4), { volume: 1, loop: true, fadeIn: 1, fadeOut: 2 });
    expect(pad(0).gain.events).toContainEqual(["ramp", 1, 11]);
    expect(lastRamp(pad(0))).toEqual(["ramp", 1, 11]);
  });
  it("Stoppen blendet mit der Ausblendzeit des Pads aus, Status ist sofort zurückgesetzt", () => {
    engine.play("a", buf(30), { volume: 1, loop: true, fadeOut: 2 });
    engine.stop("a");
    expect(engine.isPlaying("a")).toBe(false);
    expect(lastRamp(pad(0))).toEqual(["ramp", 0, 12]);
    expect(sources[0].stopAt).toBeCloseTo(12.005);
  });
  it("Stoppen ohne Ausblendzeit bleibt kurz (gegen Knacken)", () => {
    engine.play("a", buf(30), { volume: 1, loop: true });
    engine.stop("a");
    expect(lastRamp(pad(0))![2]).toBeCloseTo(10.03);
  });
  it("STOP ALL kürzt ein laufendes langes Ausblenden ab", () => {
    engine.play("a", buf(30), { volume: 1, loop: true, fadeOut: 5 });
    engine.stop("a");
    expect(lastRamp(pad(0))![2]).toBeCloseTo(15);
    engine.stopAll();
    expect(lastRamp(pad(0))![2]).toBeCloseTo(10.03);
  });
  it("Stop-Regel blendet das Ziel-Pad mit dessen Ausblendzeit aus (Crossfade)", () => {
    engine.play("a", buf(30), { volume: 1, loop: true, fadeOut: 2 });
    engine.play("b", buf(30), { volume: 1, loop: false, stopIds: ["a"] });
    expect(lastRamp(pad(0))).toEqual(["ramp", 0, 12]);
    expect(engine.isPlaying("a")).toBe(false);
    expect(engine.isPlaying("b")).toBe(true);
  });
  it("Lautstärkeänderung plant das Ausblenden am Ende neu", () => {
    engine.play("a", buf(10), { volume: 1, loop: false, fadeOut: 3 });
    ctx.currentTime = 12;
    engine.setVolume("a", 0.5);
    expect(pad(0).gain.events).toContainEqual(["set", 0.5, 17]);
    expect(lastRamp(pad(0))).toEqual(["ramp", 0, 20]);
  });
});

describe("Fortschritt / Restzeit", () => {
  it("meldet Fortschritt eines One-Shots, mit Schnitt die Länge des Ausschnitts", () => {
    engine.play("a", buf(10), { volume: 1, loop: false });
    ctx.currentTime = 14;
    expect(engine.progress("a")).toEqual({ elapsed: 4, total: 10, loop: false });
    ctx.currentTime = 10;
    engine.play("b", buf(10), { volume: 1, loop: false, start: 2, end: 5 });
    expect(engine.progress("b")?.total).toBe(3);
  });
  it("Loops sind als Loop erkennbar, nicht laufende Pads liefern nichts", () => {
    engine.play("a", buf(4), { volume: 1, loop: true });
    expect(engine.progress("a")?.loop).toBe(true);
    expect(engine.progress("x")).toBeNull();
  });
});

describe("Master-Lautstärke", () => {
  it("gilt auch, wenn sie vor dem ersten Ton eingestellt wird, und ist auf 0 bis 1 begrenzt", () => {
    engine.setMasterVolume(0.4);
    engine.play("a", buf(4), { volume: 1, loop: false });
    expect(master().gain.value).toBe(0.4);
    engine.setMasterVolume(7);
    expect(engine.masterVolume).toBe(1);
    engine.setMasterVolume(-1);
    expect(engine.masterVolume).toBe(0);
    expect(master().gain.value).toBe(0);
  });
  it("Pads laufen über den Master, die Pad-Lautstärke bleibt unabhängig", () => {
    engine.play("a", buf(4), { volume: 0.6, loop: false });
    expect(pad(0).target).toBe(master());
    engine.setMasterVolume(0.2);
    expect(pad(0).gain.value).toBe(0.6);
  });
});
