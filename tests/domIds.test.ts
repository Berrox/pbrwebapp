import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("index.html", "utf8");
const main = readFileSync("src/main.ts", "utf8");

describe("Oberfläche: Element-Namen", () => {
  it("jedes in main.ts verwendete Element gibt es in index.html", () => {
    const ids = new Set<string>();
    for (const m of main.matchAll(/\$(?:<[^>(]*>)?\("([A-Za-z0-9_-]+)"\)/g)) ids.add(m[1]);
    for (const m of main.matchAll(/"(f[A-Z][A-Za-z]+)"/g)) ids.add(m[1]); // Pad-Dialog-Felder, auch aus Listen
    const missing = [...ids].filter((id) => !html.includes(`id="${id}"`));
    expect(missing).toEqual([]);
  });
  it("jeder Name kommt in index.html nur einmal vor", () => {
    const all = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(all.filter((id, i) => all.indexOf(id) !== i)).toEqual([]);
  });
});
