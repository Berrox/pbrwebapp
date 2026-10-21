import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { ProjectError, buildProjectZip, parseProjectZip, resolveImport } from "../src/model/projectFormat";
import type { PadConfig } from "../src/storage/db";

const validProject = (over: Record<string, unknown> = {}) => ({
  format: "sampler-project", version: 1, name: "T", exportedAt: "x",
  banks: [{ id: "b", name: "B", columns: 4, padCount: 2, pads: [{ index: 0, name: "P", color: "#000000", volume: 1, loop: false, soundId: "s1" }] }],
  sounds: [{ id: "s1", name: "a.wav", file: "audio/s1.wav" }], ...over,
});
const makeZip = (project: unknown, extra: Record<string, Uint8Array> = {}) =>
  zipSync({ "project.json": strToU8(JSON.stringify(project)), ...extra });

describe("Projekt-ZIP", () => {
  it("Export und Import ergeben dasselbe Projekt (inkl. Schnittpunkte und Audio)", () => {
    const store = new Map<string, PadConfig>([
      ["bank-1:0", { id: "bank-1:0", name: "Hallo", color: "#112233", volume: 0.5, loop: true, soundId: "s1", start: 1.5, end: 3 }],
    ]);
    const bank = { id: "bank-1", name: "Intros", columns: 3, padCount: 4 };
    const zip = buildProjectZip("Test", [bank], store, [{ id: "s1", name: "hallo.wav", bytes: new Uint8Array([1, 2, 3]) }]);
    const parsed = parseProjectZip(zip);
    expect(Array.from(parsed.audio.get("s1")!)).toEqual([1, 2, 3]);
    const r = resolveImport(parsed);
    expect(r.banks).toEqual([bank]);
    expect(r.pads).toHaveLength(1);
    expect(r.pads[0]).toMatchObject({ id: "bank-1:0", name: "Hallo", volume: 0.5, loop: true, start: 1.5, end: 3, soundId: "s1" });
    expect(r.warnings).toEqual([]);
  });
  it("erkennt fehlende Audiodateien und markiert das Pad als leer", () => {
    const parsed = parseProjectZip(makeZip(validProject()));
    expect(parsed.missingSounds).toEqual(["a.wav"]);
    const r = resolveImport(parsed);
    expect(r.pads[0].soundId).toBeNull();
    expect(r.warnings).toHaveLength(1);
  });
  it("lehnt beschädigte ZIP-Dateien ab", () => {
    expect(() => parseProjectZip(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(ProjectError);
  });
  it("lehnt ZIP ohne project.json ab", () => {
    expect(() => parseProjectZip(zipSync({ "x.txt": strToU8("hi") }))).toThrow(/project\.json/);
  });
  it("lehnt unsichere Dateipfade im ZIP ab", () => {
    expect(() => parseProjectZip(makeZip(validProject(), { "../evil.txt": strToU8("x") }))).toThrow(/unsicher/);
  });
  it("lehnt unsichere Pfade in project.json ab", () => {
    const bad = validProject({ sounds: [{ id: "s1", name: "a.wav", file: "audio/../x" }] });
    expect(() => parseProjectZip(makeZip(bad))).toThrow(/unsicher/);
  });
  it("lehnt neuere Formatversionen verständlich ab", () => {
    expect(() => parseProjectZip(makeZip(validProject({ version: 99 })))).toThrow(/neuere/);
  });
  it("lehnt ungültige Werte ab (Lautstärke, Farbe, fremdes Format)", () => {
    const vol = validProject();
    vol.banks[0].pads[0].volume = 5;
    expect(() => parseProjectZip(makeZip(vol))).toThrow(ProjectError);
    const col = validProject();
    col.banks[0].pads[0].color = "red";
    expect(() => parseProjectZip(makeZip(col))).toThrow(ProjectError);
    expect(() => parseProjectZip(makeZip(validProject({ format: "anderes" })))).toThrow(/keine Projektdatei/);
  });
});
