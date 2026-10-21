import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { padAction } from "../src/model/mode";

describe("Live-Modus", () => {
  it("öffnet nie einen Bearbeitungsdialog", () => {
    for (const hasSound of [true, false]) for (const playing of [true, false])
      expect(padAction("live", hasSound, playing)).not.toBe("edit");
  });
  it("leere Pads bleiben inaktiv", () => {
    expect(padAction("live", false, false)).toBe("ignore");
  });
  it("startet und stoppt Pads mit Sound", () => {
    expect(padAction("live", true, false)).toBe("play");
    expect(padAction("live", true, true)).toBe("stop");
  });
  it("Bearbeitungsmodus öffnet den Dialog, auch bei leeren Pads", () => {
    expect(padAction("edit", false, false)).toBe("edit");
    expect(padAction("edit", true, true)).toBe("edit");
  });
});

describe("PWA-Manifest", () => {
  const m = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
  it("hat die nötigen Felder", () => {
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("./");
    expect(m.name).toBeTruthy();
  });
  it("verweist auf vorhandene Icons", () => {
    for (const i of m.icons) expect(existsSync("public/" + i.src)).toBe(true);
    expect(existsSync("public/sw.js")).toBe(true);
  });
});
