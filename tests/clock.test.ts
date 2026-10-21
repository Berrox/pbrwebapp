import { describe, expect, it } from "vitest";
import { formatClock, formatElapsed, formatRemaining, parseStopwatch, swElapsed, swInitial, swReset, swStart, swStop } from "../src/model/clock";

describe("Uhr, Stoppuhr, Restzeit", () => {
  it("formatiert die Uhrzeit mit führenden Nullen", () => {
    expect(formatClock(new Date(2026, 9, 22, 8, 5, 9))).toBe("08:05:09");
    expect(formatClock(new Date(2026, 9, 22, 23, 59, 0))).toBe("23:59:00");
  });
  it("formatiert die Restzeit: unter 10 s mit Zehntel, sonst Minuten:Sekunden aufgerundet", () => {
    expect(formatRemaining(9.44)).toBe("9,4 s");
    expect(formatRemaining(0)).toBe("0,0 s");
    expect(formatRemaining(10)).toBe("0:10");
    expect(formatRemaining(61.2)).toBe("1:02");
    expect(formatRemaining(-3)).toBe("0,0 s");
  });
  it("formatiert die Stoppuhr, ab einer Stunde mit Stunden", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(75_000)).toBe("01:15");
    expect(formatElapsed(3_725_000)).toBe("1:02:05");
  });
  it("Stoppuhr: starten, anhalten, weiterzählen, zurücksetzen", () => {
    let s = swStart(swInitial(), 1000);
    expect(swElapsed(s, 4000)).toBe(3000);
    s = swStop(s, 4000);
    expect(swElapsed(s, 99_000)).toBe(3000); // steht still
    s = swStart(s, 10_000);
    expect(swElapsed(s, 12_000)).toBe(5000); // zählt weiter
    expect(swStart(s, 11_000)).toBe(s); // doppeltes Starten ändert nichts
    expect(swReset()).toEqual({ accMs: 0, since: null });
  });
  it("liest gespeicherte Zustände und verwirft ungültige", () => {
    expect(parseStopwatch({ accMs: 5000, since: 123 })).toEqual({ accMs: 5000, since: 123 });
    expect(parseStopwatch({ accMs: 5000, since: null })).toEqual({ accMs: 5000, since: null });
    expect(parseStopwatch({ accMs: -1, since: null })).toEqual({ accMs: 0, since: null });
    expect(parseStopwatch("x")).toEqual({ accMs: 0, since: null });
    expect(parseStopwatch(null)).toEqual({ accMs: 0, since: null });
  });
});
