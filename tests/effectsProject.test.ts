import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { copyPad } from "../src/model/padOps";
import { defaultPad } from "../src/model/banks";
import { applyRadioPreset, applyTapePreset, defaultProfile } from "../src/model/effects";
import { ProjectError, buildProjectZip, parseProjectZip, resolveImport } from "../src/model/projectFormat";
import type { PadConfig } from "../src/storage/db";

const bank = { id: "b", name: "B", columns: 4, padCount: 2 };
const base = { format: "sampler-project", name: "T", exportedAt: "x", sounds: [], banks: [{ ...bank, pads: [{ index: 0, name: "P", color: "#000000", volume: 1, loop: false, soundId: null }] }] };
const zip = (project: object) => zipSync({ "project.json": strToU8(JSON.stringify(project)) });

describe("Soundeffekte im Projekt", () => {
  it("globale und pad-eigene Effekte bleiben nach Export und Import erhalten", () => {
    const own = { ...defaultProfile(), tape: { ...applyTapePreset(defaultProfile().tape, "worn"), on: true } };
    const global = { enabled: true, profile: { ...defaultProfile(), radio: { ...applyRadioPreset(defaultProfile().radio, "phone"), on: true } } };
    const store = new Map<string, PadConfig>([
      ["b:0", { ...defaultPad("b:0"), fxMode: "own", fxOwn: own }],
      ["b:1", { ...defaultPad("b:1"), fxMode: "global" }],
    ]);
    const r = resolveImport(parseProjectZip(buildProjectZip("T", [bank], store, [], [], [], global)));
    expect(r.effects).toEqual(global);
    expect(r.pads.find((p) => p.id === "b:0")?.fxMode).toBe("own");
    expect(r.pads.find((p) => p.id === "b:0")?.fxOwn).toEqual(own);
    expect(r.pads.find((p) => p.id === "b:1")?.fxMode).toBe("global");
    expect(r.pads.find((p) => p.id === "b:1")?.fxOwn).toBeUndefined();
  });
  it("ältere Projekte ohne Effekte importieren mit Standardwerten (alles aus)", () => {
    const r = resolveImport(parseProjectZip(zip({ ...base, version: 3 })));
    expect(r.effects).toEqual({ enabled: false, profile: defaultProfile() });
    expect(r.pads[0].fxMode).toBeUndefined();
  });
  it("lehnt ungültige Effekt-Angaben ab", () => {
    const pad = (extra: object) => ({ ...base, version: 9, banks: [{ ...bank, pads: [{ index: 0, name: "P", color: "#000000", volume: 1, loop: false, soundId: null, ...extra }] }] });
    expect(() => parseProjectZip(zip(pad({ fxMode: "kaputt" })))).toThrow(ProjectError);
    expect(() => parseProjectZip(zip(pad({ fxOwn: { tape: { ...defaultProfile().tape, intensity: 500 } } })))).toThrow(ProjectError);
    expect(() => parseProjectZip(zip({ ...base, version: 9, effects: { enabled: "ja" } }))).toThrow(ProjectError);
    expect(() => parseProjectZip(zip(pad({ fxMode: "global" })))).not.toThrow();
  });
  it("Kopieren eines Pads nimmt die eigenen Effekte mit, als unabhängige Kopie", () => {
    const own = { ...defaultProfile(), tape: { ...defaultProfile().tape, on: true } };
    const s = new Map<string, PadConfig>([["a:0", { ...defaultPad("a:0"), fxMode: "own", fxOwn: own }], ["a:1", defaultPad("a:1")]]);
    copyPad(s, "a:0", "a:1");
    expect(s.get("a:1")?.fxMode).toBe("own");
    expect(s.get("a:1")?.fxOwn?.tape.on).toBe(true);
    s.get("a:1")!.fxOwn!.tape.on = false;
    expect(s.get("a:0")?.fxOwn?.tape.on).toBe(true);
  });
});
