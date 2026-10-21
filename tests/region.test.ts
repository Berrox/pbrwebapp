import { describe, expect, it } from "vitest";
import { MIN_REGION, clampRegion, setEnd, setStart } from "../src/model/region";
import { computePeaks } from "../src/audio/waveform";

describe("Schnittbereich", () => {
  it("ohne Angaben: ganzes Sample", () => {
    expect(clampRegion(undefined, undefined, 10)).toEqual({ start: 0, end: 10 });
  });
  it("vertauschte Grenzen werden getauscht", () => {
    expect(clampRegion(8, 3, 10)).toEqual({ start: 3, end: 8 });
  });
  it("Werte außerhalb der Datei werden begrenzt", () => {
    expect(clampRegion(-5, 99, 10)).toEqual({ start: 0, end: 10 });
  });
  it("zu kurze Bereiche werden auf die Mindestlänge gebracht", () => {
    const r = clampRegion(5, 5, 10);
    expect(r.end - r.start).toBeCloseTo(MIN_REGION);
  });
  it("Startlinie kann nicht hinter die Endlinie", () => {
    const r = setStart({ start: 1, end: 4 }, 9);
    expect(r.start).toBeLessThan(r.end);
    expect(setStart({ start: 1, end: 4 }, -3).start).toBe(0);
  });
  it("Endlinie kann nicht vor den Start oder hinter das Dateiende", () => {
    expect(setEnd({ start: 2, end: 4 }, 0, 10).end).toBeGreaterThan(2);
    expect(setEnd({ start: 2, end: 4 }, 50, 10).end).toBe(10);
  });
});

describe("Wellenform", () => {
  it("liefert je Spalte den größten Betrag über alle Kanäle", () => {
    const l = new Float32Array([0, 0.5, 0, -0.25]);
    const r = new Float32Array([0, 0, -0.75, 0]);
    expect(Array.from(computePeaks([l, r], 2))).toEqual([0.5, 0.75]);
  });
  it("leere Daten ergeben Stille", () => {
    expect(Array.from(computePeaks([new Float32Array(0)], 3))).toEqual([0, 0, 0]);
  });
});
