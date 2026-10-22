import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { copyPad } from "../src/model/padOps";
import { defaultPad } from "../src/model/banks";
import { ProjectError, buildProjectZip, parseProjectZip, resolveImport } from "../src/model/projectFormat";
import type { PadConfig } from "../src/storage/db";

const bank = { id: "b", name: "B", columns: 4, padCount: 2 };

describe("Klang im Projekt", () => {
  it("EQ und Hall bleiben nach Export und Import erhalten", () => {
    const store = new Map<string, PadConfig>([["b:0", { ...defaultPad("b:0"), eqLow: 3, eqMid: -4, eqHigh: 12, reverb: 0.35, reverbSize: "church" }]]);
    const r = resolveImport(parseProjectZip(buildProjectZip("T", [bank], store, [])));
    expect(r.pads[0]).toMatchObject({ eqLow: 3, eqMid: -4, eqHigh: 12, reverb: 0.35, reverbSize: "church" });
  });
  it("lehnt ungültige Klang-Werte ab, ältere Projekte importieren ohne Klang", () => {
    const zip = (extra: object) => zipSync({ "project.json": strToU8(JSON.stringify({ format: "sampler-project", version: 8, name: "T", exportedAt: "x", sounds: [], banks: [{ ...bank, pads: [{ index: 0, name: "P", color: "#000000", volume: 1, loop: false, soundId: null, ...extra }] }] })) });
    expect(() => parseProjectZip(zip({ eqLow: 99 }))).toThrow(ProjectError);
    expect(() => parseProjectZip(zip({ reverb: 2 }))).toThrow(ProjectError);
    expect(() => parseProjectZip(zip({ reverbSize: "kathedrale" }))).toThrow(ProjectError);
    expect(() => parseProjectZip(zip({ eqHigh: -12, reverb: 1, reverbSize: "room" }))).not.toThrow();
    expect(resolveImport(parseProjectZip(zip({}))).pads[0].reverb).toBeUndefined();
  });
  it("Kopieren eines Pads nimmt den Klang mit", () => {
    const s = new Map<string, PadConfig>([
      ["a:0", { ...defaultPad("a:0"), eqLow: 3, reverb: 0.4, reverbSize: "hall" }],
      ["a:1", defaultPad("a:1")],
    ]);
    copyPad(s, "a:0", "a:1");
    expect(s.get("a:1")).toMatchObject({ eqLow: 3, reverb: 0.4, reverbSize: "hall" });
  });
});
