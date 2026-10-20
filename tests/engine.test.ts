import { beforeEach, describe, expect, it } from "vitest";
import { AudioEngine } from "../src/audio/AudioEngine";

class MockParam { value = 1; cancelScheduledValues() {} setValueAtTime() {} linearRampToValueAtTime() {} }
class MockGain { gain = new MockParam(); connect(n: unknown) { return n; } disconnect() {} }
class MockSource {
  buffer: unknown = null; loop = false; stopped = false; started = false;
  onended: (() => void) | null = null;
  connect(n: unknown) { return n; } disconnect() {}
  start() { this.started = true; }
  stop() { this.stopped = true; }
  end() { this.onended?.(); } // simuliert das natürliche Ende
}
let sources: MockSource[]; let gains: MockGain[];
class MockCtx {
  state = "running"; currentTime = 0; destination = {};
  resume() { return Promise.resolve(); }
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
});
