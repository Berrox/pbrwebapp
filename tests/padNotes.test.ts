import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { normalizeNote, volumePercent } from "../src/model/padNotes";
import { defaultPad } from "../src/model/banks";
import { ProjectError, buildProjectZip, parseProjectZip, resolveImport } from "../src/model/projectFormat";
import type { PadConfig } from "../src/storage/db";

describe("Pad-Lautstärke und Pad-Notizen", () => {
  it("zeigt die Lautstärke als Prozent und begrenzt ungültige Werte", () => {
    expect(volumePercent(0.75)).toBe("75 %");
    expect(volumePercent(0)).toBe("0 %");
    expect(volumePercent(1)).toBe("100 %");
    expect(volumePercent(3)).toBe("100 %");
    expect(volumePercent(NaN)).toBe("0 %");
  });
  it("speichert leere Notizen nicht und kürzt zu lange", () => {
    expect(normalizeNote("   ")).toBeUndefined();
    expect(normalizeNote("  Bass für den Drop ")).toBe("Bass für den Drop");
    expect(normalizeNote("x".repeat(900))).toHaveLength(500);
  });
  it("Lautstärke und Notiz bleiben nach Export und Import beim richtigen Pad", () => {
    const bank = { id: "b", name: "B", columns: 4, padCount: 3 };
    const store = new Map<string, PadConfig>([
      ["b:0", { ...defaultPad("b:0"), name: "A", volume: 0.35, note: "Alternative Version für den Refrain" }],
      ["b:1", { ...defaultPad("b:1"), name: "B", volume: 0.8 }],
      ["b:2", { ...defaultPad("b:2"), name: "C", volume: 1, note: "Nur zusammen mit Pad 3 verwenden 🎧" }],
    ]);
    const r = resolveImport(parseProjectZip(buildProjectZip("T", [bank], store, [])));
    const by = (id: string) => r.pads.find((p) => p.id === id)!;
    expect(by("b:0")).toMatchObject({ volume: 0.35, note: "Alternative Version für den Refrain" });
    expect(by("b:1").volume).toBe(0.8);
    expect(by("b:1").note).toBeUndefined();
    expect(by("b:2")).toMatchObject({ volume: 1, note: "Nur zusammen mit Pad 3 verwenden 🎧" });
  });
  it("ältere Projekte ohne Notizfeld importieren mit Standardwerten und behalten ihre Lautstärke", () => {
    const v1 = { format: "sampler-project", version: 1, name: "Alt", exportedAt: "x", sounds: [], banks: [{ id: "b", name: "B", columns: 4, padCount: 1, pads: [{ index: 0, name: "P", color: "#000000", volume: 0.6, loop: false, soundId: null }] }] };
    const r = resolveImport(parseProjectZip(zipSync({ "project.json": strToU8(JSON.stringify(v1)) })));
    expect(r.pads[0].note).toBeUndefined();
    expect(r.pads[0].volume).toBe(0.6);
  });
  it("lehnt zu lange oder ungültige Pad-Notizen im Projekt ab", () => {
    const mk = (note: unknown) => zipSync({ "project.json": strToU8(JSON.stringify({ format: "sampler-project", version: 4, name: "T", exportedAt: "x", sounds: [], banks: [{ id: "b", name: "B", columns: 4, padCount: 1, pads: [{ index: 0, name: "P", color: "#000000", volume: 1, loop: false, soundId: null, note }] }] })) });
    expect(() => parseProjectZip(mk("x".repeat(501)))).toThrow(ProjectError);
    expect(() => parseProjectZip(mk(42))).toThrow(ProjectError);
    expect(() => parseProjectZip(mk("ok"))).not.toThrow();
  });
});
