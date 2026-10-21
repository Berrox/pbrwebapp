import { describe, expect, it } from "vitest";
import { AUDIO_ACCEPT, audioExtension, audioMime } from "../src/model/audioFormats";
import { buildProjectZip, parseProjectZip, resolveImport } from "../src/model/projectFormat";

describe("Audioformate", () => {
  it("erkennt Endungen unabhängig von Groß- und Kleinschreibung", () => {
    expect(audioExtension("Jingle.M4A")).toBe("m4a");
    expect(audioExtension("lied.mp3")).toBe("mp3");
    expect(audioExtension("x.flac")).toBe("flac");
    expect(audioExtension("bild.png")).toBeNull();
    expect(audioExtension("ohneendung")).toBeNull();
    expect(audioExtension("a.constructor")).toBeNull();
  });
  it("liefert passende MIME-Typen, sonst octet-stream", () => {
    expect(audioMime("a.m4a")).toBe("audio/mp4");
    expect(audioMime("a.wav")).toBe("audio/wav");
    expect(audioMime("a.xyz")).toBe("application/octet-stream");
  });
  it("accept-Liste enthält audio/* und die Endungen", () => {
    expect(AUDIO_ACCEPT).toContain("audio/*");
    expect(AUDIO_ACCEPT).toContain(".m4a");
  });
  it("Projekt-Rundlauf behält die Endung und den Typ von m4a", () => {
    const bank = { id: "b", name: "B", columns: 4, padCount: 1 };
    const zip = buildProjectZip("T", [bank], new Map(), [{ id: "s1", name: "Jingle.M4A", bytes: new Uint8Array([1, 2]) }]);
    const parsed = parseProjectZip(zip);
    expect(parsed.project.sounds[0].file).toBe("audio/s1.m4a");
    expect(resolveImport(parsed).sounds[0].mime).toBe("audio/mp4");
  });
});
