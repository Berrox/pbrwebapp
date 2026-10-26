// Projektformat (siehe docs/PROJEKTFORMAT.md). Reine Logik ohne Browser/Datenbank, daher testbar.
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import type { PadConfig } from "../storage/db";
import { MAX_PADS, isBlankPad, padId, type Bank } from "./banks";
import { isAssignableKey } from "./keys";
import { audioExtension, audioMime } from "./audioFormats";
import { isReverbSize, type ReverbSize } from "./fx";
import { defaultEffects, isFxMode, parseGlobalEffects, parseProfile, type EffectProfile, type EffectsSettings, type FxMode } from "./effects";
import { isPlayMode, type Group, type PlayMode } from "./playRules";
import { MAX_NOTES, NOTE_TEXT_MAX, NOTE_TITLE_MAX, type Note } from "./notes";

export const FORMAT_NAME = "sampler-project";
export const FORMAT_VERSION = 10; // 10: weitere Effekte (Vinyl, Filter, Verzerrung, Chorus, Lo-Fi, Echo) // 8: EQ und Hall pro Pad // 7: Farbe der Bank. 6: ausgeblendete Pads // 6: auch ausgeblendete Pads (Position über der Pad-Anzahl) werden gespeichert // 2: Notizen, 3: Wiedergaberegeln und Gruppen. Ältere Versionen bleiben importierbar.
export const MAX_ZIP = 500 * 1024 * 1024, MAX_TOTAL = 800 * 1024 * 1024, MAX_FILE = 150 * 1024 * 1024;
const MAX_ENTRIES = 3000, MAX_JSON = 5 * 1024 * 1024;

export interface PadEntry { index: number; name: string; color: string; volume: number; loop: boolean; soundId: string | null; start?: number; end?: number; key?: string; midiNote?: number; playMode?: PlayMode; groupId?: string; stopTargets?: string[]; note?: string; fadeIn?: number; fadeOut?: number; eqLow?: number; eqMid?: number; eqHigh?: number; reverb?: number; reverbSize?: ReverbSize; fxMode?: FxMode; fxOwn?: EffectProfile }
export interface BankEntry { id: string; name: string; columns: number; padCount: number; pads: PadEntry[]; color?: string }
export interface SoundEntry { id: string; name: string; file: string }
export interface ProjectFile { format: string; version: number; name: string; exportedAt: string; banks: BankEntry[]; sounds: SoundEntry[]; notes: Note[]; groups: Group[]; effects: EffectsSettings }
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
        index: num(p.index, 0, MAX_PADS - 1, "die Pad-Position", true), name: str(p.name, 60, "ein Pad-Name"),
        color, volume: num(p.volume, 0, 1, "eine Lautstärke"), loop: p.loop, soundId,
      };
      if (p.start !== undefined) out.start = num(p.start, 0, 86400, "ein Startpunkt");
      if (p.end !== undefined) out.end = num(p.end, 0, 86400, "ein Endpunkt");
      if (p.key !== undefined) {
        const k = str(p.key, 12, "eine Taste");
        if (!isAssignableKey(k)) fail("Das Projekt ist beschädigt: Taste ungültig.");
        out.key = k;
      }
      if (p.midiNote !== undefined) out.midiNote = num(p.midiNote, 0, 127, "eine MIDI-Note", true);
      if (p.note !== undefined) out.note = str(p.note, 500, "eine Pad-Notiz");
      if (p.fadeIn !== undefined) out.fadeIn = num(p.fadeIn, 0, 30, "eine Einblendzeit");
      if (p.fadeOut !== undefined) out.fadeOut = num(p.fadeOut, 0, 30, "eine Ausblendzeit");
      for (const k of ["eqLow", "eqMid", "eqHigh"] as const) if (p[k] !== undefined) out[k] = num(p[k], -12, 12, "ein EQ-Wert");
      if (p.reverb !== undefined) out.reverb = num(p.reverb, 0, 1, "eine Hall-Menge");
      if (p.reverbSize !== undefined) {
        if (!isReverbSize(p.reverbSize)) fail("Das Projekt ist beschädigt: Hall-Größe ungültig.");
        out.reverbSize = p.reverbSize;
      }
      if (p.fxMode !== undefined) {
        if (!isFxMode(p.fxMode)) fail("Das Projekt ist beschädigt: Effekt-Modus ungültig.");
        out.fxMode = p.fxMode;
      }
      if (p.fxOwn !== undefined) {
        const own = parseProfile(p.fxOwn);
        if (!own) fail("Das Projekt ist beschädigt: Pad-Effekte ungültig.");
        out.fxOwn = own;
      }
      if (p.playMode !== undefined) {
        if (!isPlayMode(p.playMode)) fail("Das Projekt ist beschädigt: Wiedergabemodus ungültig.");
        out.playMode = p.playMode;
      }
      if (p.groupId !== undefined) {
        const g = str(p.groupId, 64, "eine Gruppen-ID");
        if (!SAFE_ID.test(g)) fail("Das Projekt ist beschädigt: Gruppen-ID ungültig.");
        out.groupId = g;
      }
      if (p.stopTargets !== undefined) {
        if (!Array.isArray(p.stopTargets) || p.stopTargets.length > 1000) fail("Das Projekt ist beschädigt: Stop-Ziele ungültig.");
        out.stopTargets = p.stopTargets.map((t: unknown) => {
          const id = str(t, 80, "ein Stop-Ziel");
          if (!/^[A-Za-z0-9_-]{1,64}:\d{1,2}$/.test(id)) fail("Das Projekt ist beschädigt: Stop-Ziel ungültig.");
          return id;
        });
      }
      return out;
    });
    let color: string | undefined;
    if (b.color !== undefined) {
      color = str(b.color, 7, "eine Bank-Farbe");
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) fail("Das Projekt ist beschädigt: Bank-Farbe ungültig.");
    }
    return { id, name: str(b.name, 60, "ein Bank-Name"), columns: num(b.columns, 1, 8, "die Spaltenzahl", true), padCount, pads, ...(color ? { color } : {}) };
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
  const rawNotes = raw.notes === undefined ? [] : raw.notes; // ältere Projekte haben keine Notizen
  if (!Array.isArray(rawNotes) || rawNotes.length > MAX_NOTES) fail("Das Projekt ist beschädigt: Notizen ungültig.");
  const noteIds = new Set<string>();
  const notes = rawNotes.map((n: unknown): Note => {
    if (!isObj(n)) fail("Das Projekt ist beschädigt: Notiz ungültig.");
    const id = str(n.id, 64, "eine Notiz-ID");
    if (!SAFE_ID.test(id) || noteIds.has(id)) fail("Das Projekt ist beschädigt: Notiz-ID ungültig.");
    noteIds.add(id);
    return { id, title: str(n.title, NOTE_TITLE_MAX, "ein Notiztitel"), text: str(n.text, NOTE_TEXT_MAX, "ein Notiztext") };
  });
  const effects = raw.effects === undefined ? defaultEffects() : parseGlobalEffects(raw.effects); // ältere Projekte: Effekte aus
  if (!effects) fail("Das Projekt ist beschädigt: Soundeffekte ungültig.");
  const rawGroups = raw.groups === undefined ? [] : raw.groups; // ältere Projekte haben keine Gruppen
  if (!Array.isArray(rawGroups) || rawGroups.length > 100) fail("Das Projekt ist beschädigt: Gruppen ungültig.");
  const groupIds = new Set<string>();
  const groups = rawGroups.map((g: unknown): Group => {
    if (!isObj(g)) fail("Das Projekt ist beschädigt: Gruppe ungültig.");
    const id = str(g.id, 64, "eine Gruppen-ID");
    if (!SAFE_ID.test(id) || groupIds.has(id)) fail("Das Projekt ist beschädigt: Gruppen-ID ungültig.");
    groupIds.add(id);
    return { id, name: str(g.name, 60, "ein Gruppenname"), crossBank: g.crossBank === true };
  });
  return { format: FORMAT_NAME, version, name: str(raw.name, 100, "der Projektname"), exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt.slice(0, 40) : "", banks, sounds, notes, groups, effects };
}

export function buildProjectZip(
  name: string, banks: Bank[], store: Map<string, PadConfig>, sounds: { id: string; name: string; bytes: Uint8Array }[], notes: Note[] = [], groups: Group[] = [], effects: EffectsSettings = defaultEffects(),
): Uint8Array {
  const soundEntries: SoundEntry[] = sounds.map((s) => ({
    id: s.id, name: s.name, file: `audio/${s.id}.${audioExtension(s.name) ?? "bin"}`,
  }));
  const project: ProjectFile = {
    format: FORMAT_NAME, version: FORMAT_VERSION, name, exportedAt: new Date().toISOString(),
    sounds: soundEntries,
    groups: groups.map(({ id, name, crossBank }) => ({ id, name, crossBank })),
    effects,
    notes: notes.map(({ id, title, text }) => ({ id, title, text })), // Reihenfolge = Reihenfolge in der Liste
    banks: banks.map((b) => ({
      id: b.id, name: b.name, columns: b.columns, padCount: b.padCount, color: b.color,
      pads: Array.from({ length: MAX_PADS }, (_, i) => ({ i, p: store.get(padId(b.id, i)) }))
        .filter((x): x is { i: number; p: PadConfig } => !!x.p && (x.i < b.padCount || !isBlankPad(x.p))) // ausgeblendete Pads nur mit Inhalt
        .map(({ i, p }): PadEntry => ({ index: i, name: p.name, color: p.color, volume: p.volume, loop: p.loop, soundId: p.soundId, start: p.start, end: p.end, key: p.key, midiNote: p.midiNote, playMode: p.playMode, groupId: p.groupId, stopTargets: p.stopTargets?.length ? p.stopTargets : undefined, note: p.note, fadeIn: p.fadeIn, fadeOut: p.fadeOut, eqLow: p.eqLow, eqMid: p.eqMid, eqHigh: p.eqHigh, reverb: p.reverb, reverbSize: p.reverbSize, fxMode: p.fxMode, fxOwn: p.fxOwn })),
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
  banks: Bank[]; pads: PadConfig[]; sounds: { id: string; name: string; bytes: Uint8Array; mime: string }[]; warnings: string[]; notes: Note[]; groups: Group[]; effects: EffectsSettings;
}
/** Wandelt das geprüfte Projekt in App-Daten um. Pads mit fehlender Audiodatei werden leer markiert. */
export function resolveImport(parsed: ParsedProject): ResolvedImport {
  const warnings: string[] = [], pads: PadConfig[] = [];
  const groupIds = new Set(parsed.project.groups.map((g) => g.id));
  const known = new Set(parsed.project.banks.flatMap((b) => b.pads.map((p) => padId(b.id, p.index))));
  const banks: Bank[] = parsed.project.banks.map((b) => {
    for (const p of b.pads) {
      let soundId = p.soundId;
      if (soundId && !parsed.audio.has(soundId)) { warnings.push(`„${p.name || "Pad"}“: Audiodatei fehlt`); soundId = null; }
      const selfId = padId(b.id, p.index);
      let groupId = p.groupId;
      if (groupId && !groupIds.has(groupId)) { warnings.push(`„${p.name || "Pad"}“: Wiedergabegruppe fehlt`); groupId = undefined; }
      const targets = (p.stopTargets ?? []).filter((t) => t !== selfId && known.has(t)); // Selbstzuordnung und tote Verweise entfernen
      if ((p.stopTargets?.length ?? 0) !== targets.length) warnings.push(`„${p.name || "Pad"}“: ungültige Stop-Ziele entfernt`);
      pads.push({ id: selfId, name: p.name, color: p.color, volume: p.volume, loop: p.loop, soundId, start: p.start, end: p.end, key: p.key, midiNote: p.midiNote, playMode: p.playMode, groupId, stopTargets: targets.length ? targets : undefined, note: p.note, fadeIn: p.fadeIn, fadeOut: p.fadeOut, eqLow: p.eqLow, eqMid: p.eqMid, eqHigh: p.eqHigh, reverb: p.reverb, reverbSize: p.reverbSize, fxMode: p.fxMode, fxOwn: p.fxOwn });
    }
    return { id: b.id, name: b.name, columns: b.columns, padCount: b.padCount, color: b.color };
  });
  const sounds = parsed.project.sounds.filter((s) => parsed.audio.has(s.id)).map((s) => ({
    id: s.id, name: s.name, bytes: parsed.audio.get(s.id)!,
    mime: audioMime(s.name),
  }));
  return { banks, pads, sounds, warnings, notes: parsed.project.notes, groups: parsed.project.groups, effects: parsed.project.effects };
}
