import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { backupHint, checkExportSize, formatAgo, parseLastExport } from "../src/model/backup";
import { defaultPad, isBlankPad } from "../src/model/banks";
import { ProjectError, buildProjectZip, parseProjectZip, resolveImport } from "../src/model/projectFormat";
import type { PadConfig } from "../src/storage/db";

const DAY = 86_400_000, MB = 1048576;

describe("Sicherungserinnerung", () => {
  it("formatiert die vergangene Zeit", () => {
    expect(formatAgo(10_000)).toBe("gerade eben");
    expect(formatAgo(5 * 60_000)).toBe("vor 5 Min.");
    expect(formatAgo(3 * 3_600_000)).toBe("vor 3 Std.");
    expect(formatAgo(1 * DAY)).toBe("vor 1 Tag");
    expect(formatAgo(14 * DAY)).toBe("vor 14 Tagen");
  });
  it("wird nach 14 Tagen überfällig, vorher nicht", () => {
    const now = 100 * DAY;
    expect(backupHint(now - 13 * DAY, now, true)).toEqual({ text: "Letzter Export vor 13 Tagen", overdue: false });
    expect(backupHint(now - 14 * DAY, now, true)).toEqual({ text: "Letzter Export vor 14 Tagen", overdue: true });
    expect(backupHint(now + 5 * DAY, now, true)).toEqual({ text: "Letzter Export gerade eben", overdue: false }); // Uhr verstellt
  });
  it("noch nie exportiert: überfällig nur, wenn es etwas zu sichern gibt", () => {
    expect(backupHint(null, 5 * DAY, true)).toEqual({ text: "Noch nie exportiert", overdue: true });
    expect(backupHint(null, 5 * DAY, false)).toBeNull();
  });
  it("liest den gespeicherten Zeitpunkt und verwirft Ungültiges", () => {
    expect(parseLastExport("1700000000000")).toBe(1700000000000);
    expect(parseLastExport(null)).toBeNull();
    expect(parseLastExport("abc")).toBeNull();
    expect(parseLastExport("-5")).toBeNull();
  });
});

describe("Warnung vor zu großen Projekten", () => {
  it("kleine Projekte und große, aber importierbare Projekte werden unterschieden", () => {
    expect(checkExportSize([{ name: "a.wav", size: 20 * MB }]).level).toBe("ok");
    const large = checkExportSize([{ name: "a.wav", size: 100 * MB }, { name: "b.wav", size: 80 * MB }]);
    expect(large.level).toBe("large");
    expect(large.message).toContain("180 MB");
  });
  it("warnt, wenn der Import nicht mehr möglich wäre (Gesamtgröße, einzelne Datei, Anzahl)", () => {
    expect(checkExportSize([{ name: "a", size: 300 * MB }, { name: "b", size: 300 * MB }]).level).toBe("toolarge");
    const single = checkExportSize([{ name: "Gross.wav", size: 160 * MB }]);
    expect(single.level).toBe("toolarge");
    expect(single.message).toContain("Gross.wav");
    expect(checkExportSize(Array.from({ length: 2001 }, (_, i) => ({ name: `s${i}`, size: 1 }))).level).toBe("toolarge");
  });
});

describe("Ausgeblendete Pads im Export", () => {
  const bank = { id: "b", name: "B", columns: 4, padCount: 2 };
  const mk = (): Map<string, PadConfig> => new Map<string, PadConfig>([
    ["b:0", defaultPad("b:0")], // sichtbar, leer
    ["b:1", { ...defaultPad("b:1"), name: "Sichtbar" }],
    ["b:5", { ...defaultPad("b:5"), name: "Versteckt", note: "Bleibt erhalten", volume: 0.3, key: "KeyZ" }], // über der Pad-Anzahl
    ["b:6", defaultPad("b:6")], // versteckt und leer
  ]);
  it("erkennt leere Pads", () => {
    expect(isBlankPad(defaultPad("x:0"))).toBe(true);
    expect(isBlankPad({ ...defaultPad("x:0"), note: "n" })).toBe(false);
    expect(isBlankPad({ ...defaultPad("x:0"), volume: 0.5 })).toBe(false);
  });
  it("versteckte Pads mit Inhalt werden exportiert und wiederhergestellt, leere versteckte nicht", () => {
    const parsed = parseProjectZip(buildProjectZip("T", [bank], mk(), []));
    expect(parsed.project.banks[0].pads.map((p) => p.index)).toEqual([0, 1, 5]);
    const r = resolveImport(parsed);
    expect(r.banks[0].padCount).toBe(2); // Anzeige bleibt wie vorher
    expect(r.pads.find((p) => p.id === "b:5")).toMatchObject({ name: "Versteckt", note: "Bleibt erhalten", volume: 0.3, key: "KeyZ" });
    expect(r.pads.some((p) => p.id === "b:6")).toBe(false);
  });
  it("lehnt Pad-Positionen über dem Höchstwert ab", () => {
    const mkZip = (index: number) => zipSync({ "project.json": strToU8(JSON.stringify({ format: "sampler-project", version: 6, name: "T", exportedAt: "x", sounds: [], banks: [{ ...bank, pads: [{ index, name: "P", color: "#000000", volume: 1, loop: false, soundId: null }] }] })) });
    expect(() => parseProjectZip(mkZip(48))).toThrow(ProjectError);
    expect(() => parseProjectZip(mkZip(47))).not.toThrow();
  });
});
