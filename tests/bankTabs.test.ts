import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BANK_PALETTE } from "../src/model/banks";
import { contrastRatio, textColorFor } from "../src/model/colors";

describe("Bank-Tabs in Bankfarbe", () => {
  it("Schrift auf jeder Palettenfarbe ist gut lesbar (mindestens 4,5:1)", () => {
    for (const c of BANK_PALETTE) expect(contrastRatio(c, textColorFor(c))).toBeGreaterThan(4.49);
  });
  it("eigene dunkle oder helle Bankfarbe bekommt passende Schrift", () => {
    expect(textColorFor("#1e3a8a")).toBe("#ffffff");
    expect(textColorFor("#fde68a")).toBe("#111111");
  });
  it("der Tab füllt sich mit der Bankfarbe, der alte Farbstreifen ist weg", () => {
    const main = readFileSync("src/main.ts", "utf8");
    expect(main.includes("t.style.background = bc")).toBe(true);
    expect(main.includes("borderTop")).toBe(false);
  });
});
