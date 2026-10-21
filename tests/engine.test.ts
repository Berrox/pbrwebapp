import { beforeEach, describe, expect, it } from "vitest";
import { AudioEngine } from "../src/audio/AudioEngine";

class MockParam { value = 1; cancelScheduledValues() {} setValueAtTime() {} linearRampToValueAtTime() {} setTargetAtTime(v: number) { this.value = v; } }
class MockGain { gain = new MockParam(); connect(n: unknown) { return n; } disconnect() {} }
class MockSource {
  buffer: unknown = null; loop = false; stopped = false; started = false;
  onended: (() => void) | null = null;
  connect(n: unknown) { return n; } disconnect() {}
  startArgs: unknown[] = []; loopStart = 0; loopEnd = 0;
  start(...a: unknown[]) { this.started = true; this.startArgs = a; }
  stop() { this.stopped = true; }
  end() { this.onended?.(); } // simuliert das natürliche Ende
}
let sources: MockSource[]; let gains: MockGain[];
class MockCtx {
  static last: MockCtx;
  state = "running"; currentTime = 0; destination = {}; resumeCalls = 0; hang = false;
  constructor() { MockCtx.last = this; }
  resume() { this.resumeCalls++; return this.hang ? new Promise<void>(() => {}) : Promise.resolve(); }
  createBufferSource() { const s = new MockSource(); sources.push(s); return s; }
  createGain() { const g = new MockGain(); gains.push(g); return g; }
}
const buf = {} as AudioBuffer;
let engine: AudioEngine;

beforeEach(() => {
  sources = []; gains = [];
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = MockCtx;
  engine = new AudioEngine();
});

describe("AudioEngine", () => {
  it("startet ein Sample und meldet es als laufend", () => {
    engine.play("a", buf, { volume: 1, loop: false });
    expect(sources[0].started).toBe(true);
    expect(engine.isPlaying("a")).toBe(true);
  });
  it("One-Shot setzt den Status am Ende zurück", () => {
    engine.play("a", buf, { volume: 1, loop: false });
    sources[0].end();
    expect(engine.isPlaying("a")).toBe(false);
  });
  it("Loop läuft bis zum Stopp", () => {
    engine.play("a", buf, { volume: 1, loop: true });
    expect(sources[0].loop).toBe(true);
    expect(engine.isPlaying("a")).toBe(true);
    engine.stop("a");
    expect(engine.isPlaying("a")).toBe(false);
    expect(sources[0].stopped).toBe(true);
  });
  it("STOP ALL beendet alle Samples, auch Loops", () => {
    engine.play("a", buf, { volume: 1, loop: true });
    engine.play("b", buf, { volume: 1, loop: false });
    engine.play("c", buf, { volume: 1, loop: true });
    engine.stopAll();
    expect(engine.playingIds()).toEqual([]);
    expect(sources.every((s) => s.stopped)).toBe(true);
  });
  it("berücksichtigt die Lautstärke (begrenzt auf 0 bis 1)", () => {
    engine.play("a", buf, { volume: 0.4, loop: false });
    engine.play("b", buf, { volume: 5, loop: false });
    expect(gains[0].gain.value).toBe(0.4);
    expect(gains[1].gain.value).toBe(1);
  });
  it("schnelles Wiederholen erzeugt keine doppelte Wiedergabe", () => {
    for (let i = 0; i < 5; i++) engine.play("a", buf, { volume: 1, loop: false });
    expect(engine.playingIds()).toEqual(["a"]);
    expect(sources.slice(0, 4).every((s) => s.stopped)).toBe(true);
    expect(sources[4].stopped).toBe(false);
  });
  it("spätes Ende einer alten Wiedergabe setzt die neue nicht zurück", () => {
    engine.play("a", buf, { volume: 1, loop: false });
    engine.play("a", buf, { volume: 1, loop: false });
    sources[0].end();
    expect(engine.isPlaying("a")).toBe(true);
  });
  it("Stopp eines nicht laufenden Pads ist harmlos", () => {
    expect(() => engine.stop("x")).not.toThrow();
    expect(() => engine.stopAll()).not.toThrow();
  });
  describe("Schnittpunkte", () => {
    const buf10 = { duration: 10 } as AudioBuffer;
    it("One-Shot spielt nur den Ausschnitt", () => {
      engine.play("a", buf10, { volume: 1, loop: false, start: 2, end: 5 });
      expect(sources[0].startArgs).toEqual([0, 2, 3]);
    });
    it("Loop läuft nur zwischen Start und Ende", () => {
      engine.play("a", buf10, { volume: 1, loop: true, start: 2, end: 5 });
      expect(sources[0].loop).toBe(true);
      expect([sources[0].loopStart, sources[0].loopEnd]).toEqual([2, 5]);
      expect(sources[0].startArgs).toEqual([0, 2]);
    });
    it("vertauschte und ungültige Grenzen werden korrigiert", () => {
      engine.play("a", buf10, { volume: 1, loop: false, start: 8, end: 3 });
      engine.play("b", buf10, { volume: 1, loop: false, start: -5, end: 99 });
      expect(sources[0].startArgs).toEqual([0, 3, 5]);
      expect(sources[1].startArgs).toEqual([0, 0, 10]);
    });
    it("ohne Schnitt läuft das ganze Sample", () => {
      engine.play("a", buf10, { volume: 1, loop: false });
      expect(sources[0].startArgs).toEqual([]);
    });
    it("STOP ALL beendet auch die Editor-Vorschau", () => {
      engine.play("__preview__", buf10, { volume: 1, loop: false, start: 1, end: 2 });
      engine.stopAll();
      expect(engine.isPlaying("__preview__")).toBe(false);
    });
  });
  describe("Standby und Wiederaufnahme (iOS)", () => {
    it("unlock wartet nicht auf ein hängendes resume()", () => {
      engine.unlock();
      const ctx = MockCtx.last;
      ctx.state = "interrupted"; ctx.hang = true;
      engine.unlock(); // kehrt sofort zurück, obwohl resume() nie fertig wird
      expect(ctx.resumeCalls).toBe(1);
      expect(engine.running).toBe(false);
    });
    it("gestureResume setzt nur fort, wenn der Kontext nicht läuft", () => {
      engine.unlock();
      const ctx = MockCtx.last;
      engine.gestureResume();
      expect(ctx.resumeCalls).toBe(0);
      ctx.state = "interrupted";
      engine.gestureResume();
      expect(ctx.resumeCalls).toBe(1);
    });
    it("play auf nicht laufendem Kontext merkt das Pad vor und fordert resume an", () => {
      engine.unlock();
      const ctx = MockCtx.last;
      ctx.state = "suspended";
      engine.play("a", {} as AudioBuffer, { volume: 1, loop: false });
      expect(ctx.resumeCalls).toBeGreaterThan(0);
      expect(engine.isPlaying("a")).toBe(true);
    });
  });
  describe("Lautstärke laufender Pads", () => {
    it("ändert die Lautstärke sofort und begrenzt auf 0 bis 1", () => {
      engine.play("a", {} as AudioBuffer, { volume: 1, loop: false });
      engine.setVolume("a", 0.25);
      expect(gains[0].gain.value).toBe(0.25);
      engine.setVolume("a", 7);
      expect(gains[0].gain.value).toBe(1);
      engine.setVolume("a", -1);
      expect(gains[0].gain.value).toBe(0);
    });
    it("verändert andere Pads nicht", () => {
      engine.play("a", {} as AudioBuffer, { volume: 0.5, loop: true });
      engine.play("b", {} as AudioBuffer, { volume: 0.8, loop: false });
      engine.setVolume("a", 0.3);
      expect(gains[0].gain.value).toBe(0.3);
      expect(gains[1].gain.value).toBe(0.8);
    });
    it("ignoriert Pads, die nicht laufen", () => {
      expect(() => engine.setVolume("x", 0.5)).not.toThrow();
    });
  });
});
