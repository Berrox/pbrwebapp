import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { copyPad, normalizeFade, swapPads } from "../src/model/padOps";
import { defaultPad } from "../src/model/banks";
import { ProjectError, buildProjectZip, parseProjectZip, resolveImport } from "../src/model/projectFormat";
import type { PadConfig } from "../src/storage/db";

const mk = (): Map<string, PadConfig> => new Map<string, PadConfig>([
  ["a:0", { ...defaultPad("a:0"), name: "Intro", soundId: "s1", volume: 0.4, loop: true, key: "KeyQ", midiNote: 60, note: "Notiz A", fadeIn: 1, start: 1, end: 3, playMode: "stopSelected", stopTargets: ["a:2"] }],
  ["a:1", { ...defaultPad("a:1"), name: "Jingle", soundId: "s2", key: "KeyW" }],
  ["a:2", { ...defaultPad("a:2"), name: "Musik", soundId: "s3", stopTargets: ["a:0"] }],
]);

describe("Pad kopieren und tauschen", () => {
  it("Ein-/Ausblendzeit wird auf 0,1 s gerundet, 0 oder ungültig bedeutet aus", () => {
    expect(normalizeFade(1.26)).toBe(1.3);
    expect(normalizeFade(0)).toBeUndefined();
    expect(normalizeFade(NaN)).toBeUndefined();
    expect(normalizeFade(99)).toBe(10);
  });
  it("Kopieren überträgt den Inhalt, lässt das Original unverändert und behält Taste und MIDI-Note des Ziels", () => {
    const s = mk();
    expect(copyPad(s, "a:0", "a:1")).toEqual(["a:1"]);
    expect(s.get("a:1")).toMatchObject({ name: "Intro", soundId: "s1", volume: 0.4, loop: true, note: "Notiz A", fadeIn: 1, start: 1, end: 3, playMode: "stopSelected", stopTargets: ["a:2"], key: "KeyW" });
    expect(s.get("a:1")!.midiNote).toBeUndefined();
    expect(s.get("a:0")).toMatchObject({ name: "Intro", key: "KeyQ", midiNote: 60 });
  });
  it("Kopieren nutzt eigene Kopien der Stop-Ziele und entfernt Selbstverweise", () => {
    const s = mk();
    s.get("a:0")!.stopTargets = ["a:1", "a:2"];
    copyPad(s, "a:0", "a:1");
    expect(s.get("a:1")!.stopTargets).toEqual(["a:2"]); // a:1 zeigt nicht auf sich selbst
    s.get("a:1")!.stopTargets!.push("x");
    expect(s.get("a:0")!.stopTargets).toEqual(["a:1", "a:2"]);
  });
  it("Kopieren oder Tauschen mit sich selbst oder einem unbekannten Pad ändert nichts", () => {
    const s = mk();
    expect(copyPad(s, "a:0", "a:0")).toEqual([]);
    expect(swapPads(s, "a:0", "a:0")).toEqual([]);
    expect(swapPads(s, "a:0", "zzz:9")).toEqual([]);
  });
  it("Tauschen vertauscht die Inhalte, Tasten und MIDI-Noten bleiben an der Position", () => {
    const s = mk();
    swapPads(s, "a:0", "a:1");
    expect(s.get("a:0")).toMatchObject({ name: "Jingle", soundId: "s2", key: "KeyQ", midiNote: 60 });
    expect(s.get("a:1")).toMatchObject({ name: "Intro", soundId: "s1", loop: true, note: "Notiz A", key: "KeyW" });
  });
  it("Tauschen: Stop-Ziele folgen dem Inhalt, auch bei gegenseitigen Zielen", () => {
    const s = mk();
    const changed = swapPads(s, "a:0", "a:2");
    expect(s.get("a:0")!.name).toBe("Musik");
    expect(s.get("a:2")!.name).toBe("Intro");
    // Intro zielte auf Musik und Musik auf Intro. Nach dem Tausch sitzt Intro auf a:2 und Musik auf a:0,
    // die Beziehung bleibt also bestehen, nur die Positionen sind vertauscht.
    expect(s.get("a:2")!.stopTargets).toEqual(["a:0"]); // Intro zielt weiter auf Musik
    expect(s.get("a:0")!.stopTargets).toEqual(["a:2"]); // Musik zielt weiter auf Intro
    expect(changed).toEqual(expect.arrayContaining(["a:0", "a:2"]));
    const t = mk();
    t.get("a:1")!.stopTargets = ["a:0"];
    swapPads(t, "a:0", "a:2");
    expect(t.get("a:1")!.stopTargets).toEqual(["a:2"]);
  });
});

describe("Ein-/Ausblendzeit im Projekt", () => {
  const bank = { id: "a", name: "A", columns: 4, padCount: 1 };
  it("bleibt nach Export und Import erhalten", () => {
    const store = new Map([["a:0", { ...defaultPad("a:0"), fadeIn: 1.5, fadeOut: 3 }]]);
    const r = resolveImport(parseProjectZip(buildProjectZip("T", [bank], store, [])));
    expect(r.pads[0]).toMatchObject({ fadeIn: 1.5, fadeOut: 3 });
  });
  it("lehnt ungültige Zeiten ab, ältere Projekte importieren ohne Fades", () => {
    const zip = (extra: object) => zipSync({ "project.json": strToU8(JSON.stringify({ format: "sampler-project", version: 5, name: "T", exportedAt: "x", sounds: [], banks: [{ ...bank, pads: [{ index: 0, name: "P", color: "#000000", volume: 1, loop: false, soundId: null, ...extra }] }] })) });
    expect(() => parseProjectZip(zip({ fadeIn: 99 }))).toThrow(ProjectError);
    expect(() => parseProjectZip(zip({ fadeOut: -1 }))).toThrow(ProjectError);
    expect(resolveImport(parseProjectZip(zip({}))).pads[0].fadeIn).toBeUndefined();
  });
});
