import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { contrastRatio, isLightColor, padFontSize, textColorFor } from "../src/model/colors";
import { BANK_PALETTE, bankColor } from "../src/model/banks";
import { ProjectError, buildProjectZip, parseProjectZip, resolveImport } from "../src/model/projectFormat";

describe("Lesbare Schrift auf Pads", () => {
  it("wählt dunkle Schrift auf hellen und weiße auf dunklen Farben", () => {
    expect(textColorFor("#facc15")).toBe("#111111");
    expect(textColorFor("#f59e0b")).toBe("#111111");
    expect(textColorFor("#2563eb")).toBe("#ffffff");
    expect(textColorFor("#475569")).toBe("#ffffff");
    expect(isLightColor("#ffffff")).toBe(true);
    expect(isLightColor("#000000")).toBe(false);
    expect(textColorFor("kaputt")).toBe("#ffffff"); // ungültig: weiß
  });
  it("erreicht für alle Beispiel-Farben des Entwurfs mindestens 4,5:1", () => {
    for (const c of ["#2563eb", "#f59e0b", "#15803d", "#0f766e", "#7c3aed", "#be185d", "#facc15", "#475569", "#c2410c", "#1d4ed8", "#d93025"]) {
      expect(contrastRatio(c, textColorFor(c))).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("macht lange Namen kleiner", () => {
    expect(padFontSize("Intro")).toBe(22);
    expect(padFontSize("x".repeat(14))).toBe(22);
    expect(padFontSize("x".repeat(15))).toBe(18);
    expect(padFontSize("x".repeat(26))).toBe(18);
    expect(padFontSize("x".repeat(27))).toBe(15);
  });
});

describe("Farbe der Bank", () => {
  const bank = { id: "b1", name: "B", columns: 4, padCount: 1 };
  it("ist ohne eigene Farbe stabil aus der Palette, mit eigener Farbe diese", () => {
    expect(BANK_PALETTE).toContain(bankColor(bank));
    expect(bankColor(bank)).toBe(bankColor({ ...bank, name: "anders", padCount: 9 })); // hängt nur an der ID
    expect(bankColor({ ...bank, color: "#112233" })).toBe("#112233");
  });
  it("bleibt nach Export und Import erhalten, ältere Projekte importieren ohne Farbe", () => {
    const r = resolveImport(parseProjectZip(buildProjectZip("T", [{ ...bank, color: "#abcdef" }], new Map(), [])));
    expect(r.banks[0].color).toBe("#abcdef");
    const alt = { format: "sampler-project", version: 3, name: "Alt", exportedAt: "x", sounds: [], banks: [{ ...bank, pads: [] }] };
    expect(resolveImport(parseProjectZip(zipSync({ "project.json": strToU8(JSON.stringify(alt)) }))).banks[0].color).toBeUndefined();
  });
  it("lehnt ungültige Bankfarben ab", () => {
    const mk = (color: unknown) => zipSync({ "project.json": strToU8(JSON.stringify({ format: "sampler-project", version: 7, name: "T", exportedAt: "x", sounds: [], banks: [{ ...bank, color, pads: [] }] })) });
    expect(() => parseProjectZip(mk("rot"))).toThrow(ProjectError);
    expect(() => parseProjectZip(mk(5))).toThrow(ProjectError);
    expect(() => parseProjectZip(mk("#00ff00"))).not.toThrow();
  });
});
