import { beforeEach, describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { AudioEngine } from "../src/audio/AudioEngine";
import { computeStops, type Group } from "../src/model/playRules";
import { defaultPad, makePads } from "../src/model/banks";
import { ProjectError, buildProjectZip, parseProjectZip, resolveImport } from "../src/model/projectFormat";
import type { PadConfig } from "../src/storage/db";

class MockGain { gain = { value: 1, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} }; connect(n: unknown) { return n; } disconnect() {} }
class MockSource {
  buffer: unknown = null; loop = false; stopped = false; onended: (() => void) | null = null;
  connect(n: unknown) { return n; } disconnect() {} start() {} stop() { this.stopped = true; }
}
let sources: MockSource[];
class MockCtx {
  state = "running"; currentTime = 0; destination = {};
  resume() { return Promise.resolve(); }
  createBufferSource() { const s = new MockSource(); sources.push(s); return s; }
  createGain() { return new MockGain(); }
}
const buf = {} as AudioBuffer;
let engine: AudioEngine, store: Map<string, PadConfig>, groups: Group[];

function pad(id: string, extra: Partial<PadConfig> = {}): PadConfig {
  const p = { ...defaultPad(id), soundId: "s", ...extra };
  store.set(id, p);
  return p;
}
/** Entspricht dem Ablauf beim Antippen: Regeln direkt vor dem Start auswerten. */
function start(id: string): void {
  const p = store.get(id)!;
  engine.play(p.id, buf, { volume: 1, loop: p.loop, stopIds: computeStops(p, engine.playingIds(), (i) => store.get(i), groups) });
}
const playing = () => engine.playingIds().sort();

beforeEach(() => {
  sources = []; store = new Map(); groups = [];
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = MockCtx;
  engine = new AudioEngine();
});

describe("Wiedergaberegeln", () => {
  it("Parallelmodus: zwei Pads spielen gleichzeitig, Standard ohne Einstellung", () => {
    pad("x:0"); pad("x:1", { playMode: "parallel" });
    start("x:0"); start("x:1");
    expect(playing()).toEqual(["x:0", "x:1"]);
  });
  it("Ausgewählte stoppen: nur das gewählte Pad endet, nicht gewählte laufen ununterbrochen weiter", () => {
    pad("x:1"); pad("x:2", { loop: true });
    pad("x:0", { playMode: "stopSelected", stopTargets: ["x:1"] });
    start("x:1"); start("x:2"); start("x:0");
    expect(playing()).toEqual(["x:0", "x:2"]);
    expect(sources[1].stopped).toBe(false); // Pad x:2 wurde nie angefasst
  });
  it("exklusive Gruppe: Pads derselben Gruppe stoppen sich gegenseitig", () => {
    groups = [{ id: "g", name: "Intros", crossBank: false }];
    pad("x:0", { playMode: "group", groupId: "g" }); pad("x:1", { playMode: "group", groupId: "g" });
    start("x:0"); start("x:1");
    expect(playing()).toEqual(["x:1"]);
    start("x:0");
    expect(playing()).toEqual(["x:0"]);
  });
  it("verschiedene Gruppen und Pads ohne Gruppe laufen parallel", () => {
    groups = [{ id: "g1", name: "Intros", crossBank: false }, { id: "g2", name: "Hintergrund", crossBank: false }];
    pad("x:0", { playMode: "group", groupId: "g1" }); pad("x:1", { playMode: "group", groupId: "g2", loop: true }); pad("x:2");
    start("x:1"); start("x:2"); start("x:0");
    expect(playing()).toEqual(["x:0", "x:1", "x:2"]);
  });
  it("Alle anderen stoppen beendet alle anderen laufenden Pads", () => {
    pad("x:1"); pad("x:2", { loop: true }); pad("y:0");
    pad("x:0", { playMode: "stopOthers" });
    start("x:1"); start("x:2"); start("y:0"); start("x:0");
    expect(playing()).toEqual(["x:0"]);
  });
  it("STOP ALL beendet alles, unabhängig von Gruppen und Regeln", () => {
    groups = [{ id: "g", name: "G", crossBank: true }];
    pad("x:0", { playMode: "group", groupId: "g", loop: true }); pad("y:0", { groupId: "g" }); pad("y:1", { loop: true });
    start("x:0"); start("y:0"); start("y:1");
    engine.stopAll();
    expect(playing()).toEqual([]);
    expect(sources.every((s) => s.stopped)).toBe(true);
  });
  it("Gruppe bankübergreifend: stoppt Pads anderer Bänke, wenn aktiviert", () => {
    groups = [{ id: "g", name: "Intros", crossBank: true }];
    pad("a:0", { playMode: "group", groupId: "g" }); pad("b:0", { playMode: "group", groupId: "g" });
    start("a:0"); start("b:0");
    expect(playing()).toEqual(["b:0"]);
  });
  it("Gruppe nur innerhalb der Bank, wenn bankübergreifend aus ist", () => {
    groups = [{ id: "g", name: "Intros", crossBank: false }];
    pad("a:0", { playMode: "group", groupId: "g" }); pad("b:0", { playMode: "group", groupId: "g" }); pad("a:1", { playMode: "group", groupId: "g" });
    start("a:0"); start("b:0");
    expect(playing()).toEqual(["a:0", "b:0"]);
    start("a:1");
    expect(playing()).toEqual(["a:1", "b:0"]);
  });
  it("Ausgewählte Pads wirken über Bankgrenzen hinweg", () => {
    pad("b:3", { loop: true }); pad("a:0", { playMode: "stopSelected", stopTargets: ["b:3"] });
    start("b:3"); start("a:0");
    expect(playing()).toEqual(["a:0"]);
  });
  it("Bankwechsel löst keine Stop-Regeln aus", () => {
    pad("a:0", { playMode: "stopOthers" }); pad("a:1", { loop: true });
    start("a:1");
    const bankB = { id: "b", name: "B", columns: 4, padCount: 4 };
    makePads(bankB, store); // entspricht dem Anzeigen einer anderen Bank
    expect(playing()).toEqual(["a:1"]);
  });
  it("One-Shot und Loop funktionieren mit allen Modi", () => {
    groups = [{ id: "g", name: "G", crossBank: false }];
    const modes = [{ playMode: "parallel" as const }, { playMode: "stopSelected" as const, stopTargets: ["x:9"] }, { playMode: "group" as const, groupId: "g" }, { playMode: "stopOthers" as const }];
    for (const loop of [false, true]) for (const m of modes) {
      engine.stopAll(); sources = [];
      pad("x:9", { loop: true, groupId: "g" }); pad("x:0", { ...m, loop });
      start("x:9"); start("x:0");
      expect(sources[sources.length - 1].loop).toBe(loop);
      const stopsTarget = m.playMode !== "parallel";
      expect(engine.isPlaying("x:9")).toBe(!stopsTarget);
      expect(engine.isPlaying("x:0")).toBe(true);
      start("x:9"); // gestopptes Pad ist wieder normal startbar
      expect(engine.isPlaying("x:9")).toBe(true);
    }
  });
  it("natürliches Ende setzt den Status zurück und ein Exklusivstart danach läuft sauber", () => {
    pad("x:1"); pad("x:0", { playMode: "stopOthers" });
    start("x:1");
    sources[0].onended?.();
    expect(engine.isPlaying("x:1")).toBe(false);
    start("x:0");
    expect(playing()).toEqual(["x:0"]);
  });
  it("schnelle Mehrfachstarts erzeugen keine doppelten oder verwaisten Wiedergaben", () => {
    groups = [{ id: "g", name: "G", crossBank: false }];
    pad("x:0", { playMode: "group", groupId: "g" }); pad("x:1", { playMode: "group", groupId: "g" });
    for (let i = 0; i < 20; i++) start(i % 2 ? "x:1" : "x:0");
    expect(playing()).toEqual(["x:1"]);
    expect(sources.filter((s) => !s.stopped)).toHaveLength(1);
  });
});

describe("Wiedergaberegeln im Projekt", () => {
  const bank = { id: "b1", name: "B", columns: 4, padCount: 3 };
  const base = (pads: object[], over: Record<string, unknown> = {}) => zipSync({ "project.json": strToU8(JSON.stringify({
    format: "sampler-project", version: 3, name: "T", exportedAt: "x", sounds: [], groups: [{ id: "g1", name: "Intros", crossBank: true }],
    banks: [{ ...bank, pads: pads.map((p, index) => ({ index, name: "P", color: "#000000", volume: 1, loop: false, soundId: null, ...p })) }], ...over,
  })) });

  it("Einstellungen bleiben nach Export und Import erhalten", () => {
    pad("b1:0", { playMode: "stopSelected", stopTargets: ["b1:1"], groupId: "g1" }); pad("b1:1", { playMode: "group", groupId: "g1" });
    const g: Group[] = [{ id: "g1", name: "Intros", crossBank: true }];
    const zip = buildProjectZip("T", [bank], store, [{ id: "s", name: "a.wav", bytes: new Uint8Array([1]) }], [], g);
    const r = resolveImport(parseProjectZip(zip));
    expect(r.groups).toEqual(g);
    expect(r.pads.find((p) => p.id === "b1:0")).toMatchObject({ playMode: "stopSelected", stopTargets: ["b1:1"], groupId: "g1" });
    expect(r.pads.find((p) => p.id === "b1:1")).toMatchObject({ playMode: "group", groupId: "g1" });
    expect(r.warnings).toEqual([]);
  });
  it("ältere Projekte ohne diese Einstellungen laufen mit Standardwerten (parallel)", () => {
    const v1 = { format: "sampler-project", version: 1, name: "Alt", exportedAt: "x", sounds: [], banks: [{ ...bank, pads: [{ index: 0, name: "P", color: "#000000", volume: 1, loop: false, soundId: null }] }] };
    const r = resolveImport(parseProjectZip(zipSync({ "project.json": strToU8(JSON.stringify(v1)) })));
    expect(r.groups).toEqual([]);
    expect(r.pads[0].playMode).toBeUndefined();
    expect(computeStops(r.pads[0], ["x:5"], () => undefined, [])).toEqual([]);
  });
  it("entfernt ungültige Verknüpfungen (Selbstzuordnung, fehlende Pads und Gruppen) mit Hinweis", () => {
    const r = resolveImport(parseProjectZip(base([{ playMode: "stopSelected", stopTargets: ["b1:0", "b1:1", "b1:9", "zzz:0"], groupId: "nope" }, {}])));
    expect(r.pads[0].stopTargets).toEqual(["b1:1"]);
    expect(r.pads[0].groupId).toBeUndefined();
    expect(r.warnings).toHaveLength(2);
  });
  it("lehnt ungültige Modi und Pad-Verweise ab", () => {
    expect(() => parseProjectZip(base([{ playMode: "kaputt" }]))).toThrow(ProjectError);
    expect(() => parseProjectZip(base([{ stopTargets: ["../x"] }]))).toThrow(ProjectError);
    expect(() => parseProjectZip(base([{}], { groups: "x" }))).toThrow(ProjectError);
  });
});
