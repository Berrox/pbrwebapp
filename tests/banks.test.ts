import { describe, expect, it } from "vitest";
import { clampInt, defaultPad, makePads, migrateLegacy, moveBank, type Bank } from "../src/model/banks";
import type { PadConfig } from "../src/storage/db";

const bank = (id: string, padCount = 3): Bank => ({ id, name: id, columns: 4, padCount });

describe("Bänke", () => {
  it("Bankwechsel (erneutes Abrufen der Pads) verändert keine Konfiguration", () => {
    const store = new Map<string, PadConfig>();
    const a = bank("A"), b = bank("B");
    const first = makePads(a, store);
    first[0].name = "Jingle"; first[0].volume = 0.3;
    makePads(b, store);
    const again = makePads(a, store);
    expect(again[0]).toBe(first[0]);
    expect(again[0].name).toBe("Jingle");
    expect(again[0].volume).toBe(0.3);
  });
  it("mehr Pads behalten die vorhandenen Einstellungen", () => {
    const store = new Map<string, PadConfig>();
    const a = bank("A", 2);
    makePads(a, store)[1].name = "Intro";
    a.padCount = 5;
    const pads = makePads(a, store);
    expect(pads).toHaveLength(5);
    expect(pads[1].name).toBe("Intro");
  });
  it("Pad-IDs sind bankübergreifend eindeutig", () => {
    const store = new Map<string, PadConfig>();
    const ids = [...makePads(bank("A"), store), ...makePads(bank("B"), store)].map((p) => p.id);
    expect(new Set(ids).size).toBe(6);
  });
  it("Reihenfolge ändern und Grenzen beachten", () => {
    const list = [bank("A"), bank("B"), bank("C")];
    expect(moveBank(list, 0, -1).index).toBe(0);
    const r = moveBank(list, 0, 1);
    expect(r.banks.map((x) => x.id)).toEqual(["B", "A", "C"]);
    expect(r.index).toBe(1);
  });
  it("übernimmt Pads aus Version M1", () => {
    const old = [defaultPad("pad-3"), defaultPad("A:1")];
    const m = migrateLegacy(old, "bank-1");
    expect(m).toHaveLength(1);
    expect(m[0].pad.id).toBe("bank-1:3");
  });
  it("clampInt begrenzt Eingaben", () => {
    expect(clampInt(99, 1, 8, 4)).toBe(8);
    expect(clampInt(0, 1, 8, 4)).toBe(1);
    expect(clampInt(NaN, 1, 8, 4)).toBe(4);
  });
});
