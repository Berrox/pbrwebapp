import { describe, expect, it } from "vitest";
import { findConflict, isAssignableKey, keyLabel } from "../src/model/keys";
import { noteName, parseNoteOn } from "../src/input/midi";
import { buildProjectZip, parseProjectZip, resolveImport } from "../src/model/projectFormat";
import { defaultPad } from "../src/model/banks";
import { strToU8, zipSync } from "fflate";

describe("Tastaturkürzel", () => {
  it("erlaubt Buchstaben, Ziffern und Ziffernblock", () => {
    for (const k of ["KeyQ", "Digit1", "Numpad5"]) expect(isAssignableKey(k)).toBe(true);
  });
  it("sperrt reservierte Tasten (Esc, Tab, Enter, Leertaste, F-Tasten)", () => {
    for (const k of ["Escape", "Tab", "Enter", "Space", "F5", "ArrowUp", "ShiftLeft", ""]) expect(isAssignableKey(k)).toBe(false);
  });
  it("zeigt lesbare Beschriftungen", () => {
    expect(keyLabel("KeyQ")).toBe("Q");
    expect(keyLabel("Digit3")).toBe("3");
    expect(keyLabel("Numpad7")).toBe("Num 7");
  });
  it("erkennt doppelt vergebene Tasten und Noten, aber nicht beim selben Pad", () => {
    const a = { ...defaultPad("b:0"), key: "KeyQ", midiNote: 60 }, b = defaultPad("b:1");
    expect(findConflict([a, b], "b:1", "key", "KeyQ")).toBe(a);
    expect(findConflict([a, b], "b:1", "midiNote", 60)).toBe(a);
    expect(findConflict([a, b], "b:0", "key", "KeyQ")).toBeNull();
    expect(findConflict([a, b], "b:1", "key", undefined)).toBeNull();
  });
});

describe("MIDI", () => {
  it("liest Note-an-Nachrichten, auch auf anderen Kanälen", () => {
    expect(parseNoteOn([0x90, 60, 100])).toBe(60);
    expect(parseNoteOn([0x95, 36, 1])).toBe(36);
  });
  it("ignoriert Note-aus, Anschlagstärke 0 und kurze Daten", () => {
    expect(parseNoteOn([0x80, 60, 64])).toBeNull();
    expect(parseNoteOn([0x90, 60, 0])).toBeNull();
    expect(parseNoteOn([0x90, 60])).toBeNull();
  });
  it("benennt Noten", () => {
    expect(noteName(60)).toBe("C4");
    expect(noteName(69)).toBe("A4");
  });
});

describe("Projekt mit Taste und MIDI", () => {
  const bank = { id: "b", name: "B", columns: 4, padCount: 2 };
  it("bleibt beim Export und Import erhalten", () => {
    const store = new Map([["b:0", { ...defaultPad("b:0"), name: "X", key: "KeyW", midiNote: 72 }]]);
    const r = resolveImport(parseProjectZip(buildProjectZip("T", [bank], store, [])));
    expect(r.pads[0]).toMatchObject({ key: "KeyW", midiNote: 72 });
  });
  it("lehnt ungültige Taste oder MIDI-Note ab", () => {
    const mk = (pad: object) => zipSync({ "project.json": strToU8(JSON.stringify({
      format: "sampler-project", version: 1, name: "T", exportedAt: "x", sounds: [],
      banks: [{ ...bank, pads: [{ index: 0, name: "", color: "#000000", volume: 1, loop: false, soundId: null, ...pad }] }],
    })) });
    expect(() => parseProjectZip(mk({ key: "F5" }))).toThrow();
    expect(() => parseProjectZip(mk({ midiNote: 200 }))).toThrow();
    expect(() => parseProjectZip(mk({ key: "KeyA", midiNote: 5 }))).not.toThrow();
  });
});
