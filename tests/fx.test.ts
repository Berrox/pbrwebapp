import { describe, expect, it } from "vitest";
import { fxFromPad, isFlat, normalizeEq, normalizeReverb } from "../src/model/fx";
import { IR_SECONDS, generateIR } from "../src/audio/reverbIR";

const meanAbs = (a: Float32Array, from: number, to: number): number => {
  let s = 0;
  for (let i = from; i < to; i++) s += Math.abs(a[i]);
  return s / (to - from);
};

describe("Klang: Werte", () => {
  it("erkennt Pads ohne EQ und Hall", () => {
    expect(isFlat({ low: 0, mid: 0, high: 0, reverb: 0, size: "hall" })).toBe(true);
    expect(isFlat({ low: 1, mid: 0, high: 0, reverb: 0, size: "room" })).toBe(false);
    expect(isFlat({ low: 0, mid: 0, high: 0, reverb: 0.05, size: "room" })).toBe(false);
  });
  it("begrenzt EQ auf ganze dB zwischen -12 und +12, 0 bedeutet aus", () => {
    expect(normalizeEq(3.4)).toBe(3);
    expect(normalizeEq(99)).toBe(12);
    expect(normalizeEq(-99)).toBe(-12);
    expect(normalizeEq(0)).toBe(undefined);
    expect(normalizeEq(0.4)).toBe(undefined);
    expect(normalizeEq(NaN)).toBe(undefined);
  });
  it("rundet die Hall-Menge auf 5-%-Schritte, 0 bedeutet aus", () => {
    expect(normalizeReverb(0.42)).toBe(0.4);
    expect(normalizeReverb(1.5)).toBe(1);
    expect(normalizeReverb(0.03)).toBe(0.05);
    expect(normalizeReverb(0)).toBe(undefined);
    expect(normalizeReverb(-1)).toBe(undefined);
  });
  it("füllt fehlende Werte älterer Pads mit Standard (aus, Größe Raum)", () => {
    expect(fxFromPad({})).toEqual({ low: 0, mid: 0, high: 0, reverb: 0, size: "room" });
    expect(fxFromPad({ eqHigh: 4, reverb: 0.3, reverbSize: "church" })).toEqual({ low: 0, mid: 0, high: 4, reverb: 0.3, size: "church" });
  });
});

describe("Hall-Raum", () => {
  it("hat die richtige Länge, ist immer gleich und links und rechts verschieden", () => {
    const a = generateIR(8000, "hall"), b = generateIR(8000, "hall");
    expect(a.left.length).toBe(Math.round(8000 * IR_SECONDS.hall));
    expect(Array.from(a.left.slice(0, 40))).toEqual(Array.from(b.left.slice(0, 40)));
    expect(Array.from(a.left.slice(0, 40))).not.toEqual(Array.from(a.right.slice(0, 40)));
  });
  it("klingt aus und wird mit der Größe länger", () => {
    const ir = generateIR(8000, "church"), n = ir.left.length;
    expect(meanAbs(ir.left, 0, n / 10)).toBeGreaterThan(meanAbs(ir.left, n - n / 10, n) * 5);
    expect(generateIR(8000, "hall").left.length).toBeGreaterThan(generateIR(8000, "room").left.length);
    expect(n).toBeGreaterThan(generateIR(8000, "hall").left.length);
  });
});
