// Projektformat (siehe docs/PROJEKTFORMAT.md). Reine Logik ohne Browser/Datenbank, daher testbar.
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import type { PadConfig } from "../storage/db";
import { padId, type Bank } from "./banks";

export const FORMAT_NAME = "sampler-project";
export const FORMAT_VERSION = 1;
const MAX_ZIP = 500 * 1024 * 1024, MAX_TOTAL = 800 * 1024 * 1024, MAX_FILE = 150 * 1024 * 1024;
const MAX_ENTRIES = 3000, MAX_JSON = 5 * 1024 * 1024;

export interface PadEntry { index: number; name: string; color: string; volume: number; loop: boolean; soundId: string | null; start?: number; end?: number }
export interface BankEntry { id: string; name: string; columns: number; padCount: number; pads: PadEntry[] }
export interface SoundEntry { id: string; name: string; file: string }
export interface ProjectFile { format: string; version: number; name: string; exportedAt: string; banks: BankEntry[]; sounds: SoundEntry[] }
export interface ParsedProject { project: ProjectFile; audio: Map<string, Uint8Array>; missingSounds: string[] }

export class ProjectError extends Error {}
function fail(msg: string): never { throw new ProjectError(msg); }

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/, SAFE_AUDIO = /^audio\/[A-Za-z0-9._-]{1,120}$/, COLOR = /^#[0-9a-fA-F]{6}$/;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
function str(v: unknown, max: number, what: string): string {
  if (typeof v !== "string" || v.length > max) fail(`Das Projekt ist beschädigt: ${what} ist ungültig.`);
  return v;
}
function num(v: unknown, min: number, max: number, what: string, integer = false): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v)))
    fail(`Das Projekt ist beschädigt: ${what} ist ungültig.`);
  return v;
}

/** Prüft ein geladenes project.json streng und gibt nur bekannte Felder zurück. */
export function validateProject(raw: unknown): ProjectFile {
  if (!isObj(raw) || raw.format !== FORMAT_NAME) fail("Das ist keine Projektdatei dieser App.");
  const version = num(raw.version, 1, 1e6, "die Formatversion", true);
  if (version > FORMAT_VERSION) fail("Das Projekt stammt aus einer neueren Version der App. Bitte die App aktualisieren.");
  // Hier würden künftig Umwandlungen älterer Versionen stehen (Version 1 ist die erste).
  if (!Array.isArray(raw.banks) || raw.banks.length < 1 || raw.banks.length > 100) fail("Das Projekt enthält keine gültigen Bänke.");
  const bankIds = new Set<string>();
  const banks = raw.banks.map((b: unknown): BankEntry => {
    if (!isObj(b)) fail("Das Projekt ist beschädigt: Bank ungültig.");
    const id = str(b.id, 64, "eine Bank-ID");
    if (!SAFE_ID.test(id) || bankIds.has(id)) fail("Das Projekt ist beschädigt: Bank-ID ungültig.");
    bankIds.add(id);
    const padCount = num(b.padCount, 1, 48, "die Pad-Anzahl", true);
    if (!Array.isArray(b.pads) || b.pads.length > 48) fail("Das Projekt ist beschädigt: Pads ungültig.");
    const pads = b.pads.map((p: unknown): PadEntry => {
      if (!isObj(p)) fail("Das Projekt ist beschädigt: Pad ungültig.");
      const soundId = p.soundId === null ? null : str(p.soundId, 64, "eine Sound-ID");
      if (soundId !== null && !SAFE_ID.test(soundId)) fail("Das Projekt ist beschädigt: Sound-ID ungültig.");
      if (typeof p.loop !== "boolean") fail("Das Projekt ist beschädigt: Loop-Angabe ungültig.");
      const color = str(p.color, 7, "eine Farbe");
      if (!COLOR.test(color)) fail("Das Projekt ist beschädigt: Farbe ungültig.");
      const out: PadEntry = {
        index: num(p.index, 0, padCount - 1, "die Pad-Position", true), name: str(p.name, 60, "ein Pad-Name"),
        color, volume: num(p.volume, 0, 1, "eine Lautstärke"), loop: p.loop, soundId,
      };
      if (p.start !== undefined) out.start = num(p.start, 0, 86400, "ein Startpunkt");
      if (p.end !== undefined) out.end = num(p.end, 0, 86400, "ein Endpunkt");
      return out;
    });
    return { id, name: str(b.name, 60, "ein Bank-Name"), columns: num(b.columns, 1, 8, "die Spaltenzahl", true), padCount, pads };
  });
  if (!Array.isArray(raw.sounds) || raw.sounds.length > 2000) fail("Das Projekt ist beschädigt: Sound-Liste ungültig.");
  const soundIds = new Set<string>();
  const sounds = raw.sounds.map((s: unknown): SoundEntry => {
    if (!isObj(s)) fail("Das Projekt ist beschädigt: Sound ungültig.");
    const id = str(s.id, 64, "eine Sound-ID"), file = str(s.file, 130, "ein Dateipfad");
    if (!SAFE_ID.test(id) || soundIds.has(id)) fail("Das Projekt ist beschädigt: Sound-ID ungültig.");
    if (!SAFE_AUDIO.test(file) || file.includes("..")) fail("Das Projekt enthält unsichere Dateipfade.");
    soundIds.add(id);
    return { id, name: str(s.name, 200, "ein Dateiname"), file };
  });
  return { format: FORMAT_NAME, version, name: str(raw.name, 100, "der Projektname"), exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt.slice(0, 40) : "", banks, sounds };
}

export function buildProjectZip(
  name: string, banks: Bank[], store: Map<string, PadConfig>, sounds: { id: string; name: string; bytes: Uint8Array }[],
): Uint8Array {
  const soundEntries: SoundEntry[] = sounds.map((s) => ({
    id: s.id, name: s.name, file: `audio/${s.id}${/\.(wav|mp3)$/i.exec(s.name)?.[0].toLowerCase() ?? ".bin"}`,
  }));
  const project: ProjectFile = {
    format: FORMAT_NAME, version: FORMAT_VERSION, name, exportedAt: new Date().toISOString(),
    sounds: soundEntries,
    banks: banks.map((b) => ({
      id: b.id, name: b.name, columns: b.columns, padCount: b.padCount,
      pads: Array.from({ length: b.padCount }, (_, i) => ({ i, p: store.get(padId(b.id, i)) }))
        .filter((x): x is { i: number; p: PadConfig } => !!x.p)
        .map(({ i, p }): PadEntry => ({ index: i, name: p.name, color: p.color, volume: p.volume, loop: p.loop, soundId: p.soundId, start: p.start, end: p.end })),
    })),
  };
  const files: Zippable = { "project.json": strToU8(JSON.stringify(project, null, 2)) };
  soundEntries.forEach((e, i) => { files[e.file] = [sounds[i].bytes, { level: 0 }]; }); // Audio ist schon komprimiert
  return zipSync(files);
}

export function parseProjectZip(bytes: Uint8Array): ParsedProject {
  if (bytes.length > MAX_ZIP) fail("Die Projektdatei ist zu groß.");
  let files: Record<string, Uint8Array>;
  let count = 0, total = 0;
  try {
    files = unzipSync(bytes, {
      filter: (f) => {
        if (f.name.endsWith("/")) return false;
        if (f.name.includes("..") || f.name.startsWith("/") || f.name.includes("\\")) fail("Das Projekt enthält unsichere Dateipfade.");
        total += f.originalSize;
        if (++count > MAX_ENTRIES || f.originalSize > MAX_FILE || total > MAX_TOTAL) fail("Das Projekt ist zu groß.");
        return f.name === "project.json" || f.name.startsWith("audio/"); // alles andere wird ignoriert
      },
    });
  } catch (e) {
    if (e instanceof ProjectError) throw e;
    return fail("Keine gültige ZIP-Datei oder die Datei ist beschädigt.");
  }
  const json = files["project.json"];
  if (!json) fail("In der ZIP-Datei fehlt project.json.");
  if (json.length > MAX_JSON) fail("project.json ist zu groß.");
  let raw: unknown;
  try { raw = JSON.parse(strFromU8(json)); } catch { fail("project.json ist beschädigt."); }
  const project = validateProject(raw);
  const audio = new Map<string, Uint8Array>(), missingSounds: string[] = [];
  for (const s of project.sounds) {
    const data = files[s.file];
    if (data) audio.set(s.id, data); else missingSounds.push(s.name);
  }
  return { project, audio, missingSounds };
}

export interface ResolvedImport {
  banks: Bank[]; pads: PadConfig[]; sounds: { id: string; name: string; bytes: Uint8Array; mime: string }[]; warnings: string[];
}
/** Wandelt das geprüfte Projekt in App-Daten um. Pads mit fehlender Audiodatei werden leer markiert. */
export function resolveImport(parsed: ParsedProject): ResolvedImport {
  const warnings: string[] = [], pads: PadConfig[] = [];
  const banks: Bank[] = parsed.project.banks.map((b) => {
    for (const p of b.pads) {
      let soundId = p.soundId;
      if (soundId && !parsed.audio.has(soundId)) { warnings.push(`„${p.name || "Pad"}“: Audiodatei fehlt`); soundId = null; }
      pads.push({ id: padId(b.id, p.index), name: p.name, color: p.color, volume: p.volume, loop: p.loop, soundId, start: p.start, end: p.end });
    }
    return { id: b.id, name: b.name, columns: b.columns, padCount: b.padCount };
  });
  const sounds = parsed.project.sounds.filter((s) => parsed.audio.has(s.id)).map((s) => ({
    id: s.id, name: s.name, bytes: parsed.audio.get(s.id)!,
    mime: /\.wav$/i.test(s.name) ? "audio/wav" : /\.mp3$/i.test(s.name) ? "audio/mpeg" : "application/octet-stream",
  }));
  return { banks, pads, sounds, warnings };
}
