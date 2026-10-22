import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles/theme.css", "utf8");
const blocks = (selector: string): string => {
  const out: string[] = [];
  const re = new RegExp(selector.replace(/[.#]/g, "\\$&") + "\\s*\\{([^}]*)\\}", "g");
  for (const m of css.matchAll(re)) out.push(m[1]);
  return out.join(" ");
};

describe("Stapelreihenfolge", () => {
  it("das Menü „Mehr“ liegt über den Pads, über der Einblendung und unter der Abdunklung", () => {
    const z = (sel: string) => Number(/z-index:\s*(\d+)/.exec(blocks(sel))?.[1] ?? 0);
    expect(blocks(".pad")).toContain("position: relative"); // der Grund, warum ein Menü ohne z-index unter den Pads läge
    expect(z("#moreMenu")).toBeGreaterThan(z("#toast"));
    expect(z("#moreMenu")).toBeGreaterThan(0);
    expect(z("#dim")).toBeGreaterThan(z("#moreMenu"));
  });
});
