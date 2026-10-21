import { describe, expect, it } from "vitest";
import { formatDuration, formatSize, isSupportedAudioName, isValidSoundName, padsUsingSound } from "../src/model/library";
import { defaultPad } from "../src/model/banks";

describe("Soundbibliothek", () => {
  it("formatiert Größe und Dauer lesbar", () => {
    expect(formatSize(500)).toBe("500 B");
    expect(formatSize(2048)).toBe("2 KB");
    expect(formatSize(2.5 * 1048576)).toBe("2,5 MB");
    expect(formatDuration(4.26)).toBe("4,3 s");
    expect(formatDuration(125)).toBe("2:05 min");
    expect(formatDuration(undefined)).toBe("–");
  });
  it("findet Pads, die einen Sound verwenden (über alle Bänke)", () => {
    const store = new Map([
      ["a:0", { ...defaultPad("a:0"), soundId: "s1" }],
      ["b:3", { ...defaultPad("b:3"), soundId: "s1" }],
      ["b:4", { ...defaultPad("b:4"), soundId: "s2" }],
    ]);
    expect(padsUsingSound(store, "s1").map((p) => p.id)).toEqual(["a:0", "b:3"]);
    expect(padsUsingSound(store, "x")).toEqual([]);
  });
  it("erkennt unterstützte Dateinamen und prüft neue Namen", () => {
    expect(isSupportedAudioName("Jingle.WAV")).toBe(true);
    expect(isSupportedAudioName("lied.mp3")).toBe(true);
    expect(isSupportedAudioName("bild.png")).toBe(false);
    expect(isValidSoundName("   ")).toBe(false);
    expect(isValidSoundName(" Intro ")).toBe(true);
    expect(isValidSoundName("x".repeat(201))).toBe(false);
  });
});
