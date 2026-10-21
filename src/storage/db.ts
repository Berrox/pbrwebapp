import { openDB, type DBSchema } from "idb";
import { contentHash, uuid } from "../model/ids";
import type { Note } from "../model/notes";
import type { Group, PlayMode } from "../model/playRules";

export interface StoredSound { id: string; name: string; hash: string; size: number; blob: Blob; duration?: number }
export interface PadConfig {
  id: string; name: string; color: string; volume: number; loop: boolean; soundId: string | null;
  start?: number; end?: number; // Schnitt in Sekunden (nicht destruktiv); leer = ganzes Sample
  key?: string; midiNote?: number; // Tastaturkürzel (event.code) und MIDI-Note, optional
  playMode?: PlayMode; groupId?: string; stopTargets?: string[]; // Wiedergaberegeln (leer = parallel)
  note?: string; // persönliche Notiz zum Pad (an die Pad-ID gebunden)
  fadeIn?: number; fadeOut?: number; // Ein-/Ausblendzeit in Sekunden (leer = aus)
}
export interface StoredBank { id: string; name: string; columns: number; padCount: number; order: number }
export interface StoredNote extends Note { order: number }
export interface StoredGroup extends Group { order: number }
interface SamplerDB extends DBSchema {
  notes: { key: string; value: StoredNote };
  groups: { key: string; value: StoredGroup };
  banks: { key: string; value: StoredBank };
  sounds: { key: string; value: StoredSound; indexes: { hash: string } };
  pads: { key: string; value: PadConfig };
}

const dbPromise = openDB<SamplerDB>("sampler", 4, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore("sounds", { keyPath: "id" }).createIndex("hash", "hash");
      db.createObjectStore("pads", { keyPath: "id" });
    }
    if (oldVersion < 2) db.createObjectStore("banks", { keyPath: "id" });
    if (oldVersion < 3) db.createObjectStore("notes", { keyPath: "id" });
    if (oldVersion < 4) db.createObjectStore("groups", { keyPath: "id" });
  },
});

/** Speichert eine Datei; erkennt Duplikate per Prüfsumme. Gibt die Sound-ID zurück. */
export async function importSound(file: File, data: ArrayBuffer, duration?: number): Promise<string> {
  const db = await dbPromise;
  const hash = await contentHash(data);
  const existing = await db.getFromIndex("sounds", "hash", hash);
  if (existing) return existing.id;
  const id = uuid();
  await db.put("sounds", { id, name: file.name, hash, size: file.size, blob: new Blob([data], { type: file.type }), duration });
  return id;
}
export async function getSound(id: string): Promise<StoredSound | undefined> {
  return (await dbPromise).get("sounds", id);
}
export async function savePad(p: PadConfig): Promise<void> { await (await dbPromise).put("pads", p); }
export async function loadPads(): Promise<PadConfig[]> { return (await dbPromise).getAll("pads"); }
export async function loadAllSounds(): Promise<StoredSound[]> { return (await dbPromise).getAll("sounds"); }
/** Ersetzt das gesamte Projekt in EINER Transaktion: entweder alles oder (bei Fehler) nichts. */
export async function replaceAllData(d: {
  banks: Omit<StoredBank, "order">[]; pads: PadConfig[]; sounds: StoredSound[]; notes: Note[]; groups: Group[];
}): Promise<void> {
  const db = await dbPromise;
  const tx = db.transaction(["banks", "pads", "sounds", "notes", "groups"], "readwrite");
  const jobs: Promise<unknown>[] = [
    tx.objectStore("banks").clear(), tx.objectStore("pads").clear(), tx.objectStore("sounds").clear(), tx.objectStore("notes").clear(), tx.objectStore("groups").clear(),
  ];
  d.banks.forEach((b, order) => jobs.push(tx.objectStore("banks").put({ ...b, order })));
  d.pads.forEach((p) => jobs.push(tx.objectStore("pads").put(p)));
  d.sounds.forEach((s) => jobs.push(tx.objectStore("sounds").put(s)));
  d.notes.forEach((n, order) => jobs.push(tx.objectStore("notes").put({ ...n, order })));
  d.groups.forEach((g, order) => jobs.push(tx.objectStore("groups").put({ ...g, order })));
  await Promise.all([...jobs, tx.done]);
}
export type SoundInfo = Omit<StoredSound, "blob">;
/** Liste ohne die Audiodaten selbst, damit nicht alles im Speicher liegt. */
export async function listSounds(): Promise<SoundInfo[]> {
  const db = await dbPromise;
  const out: SoundInfo[] = [];
  let c = await db.transaction("sounds").store.openCursor();
  while (c) { const { blob: _unused, ...info } = c.value; out.push(info); c = await c.continue(); }
  return out.sort((a, b) => a.name.localeCompare(b.name, "de"));
}
export async function renameSound(id: string, name: string): Promise<void> {
  const db = await dbPromise;
  const s = await db.get("sounds", id);
  if (s) await db.put("sounds", { ...s, name });
}
export async function setSoundDuration(id: string, duration: number): Promise<void> {
  const db = await dbPromise;
  const s = await db.get("sounds", id);
  if (s) await db.put("sounds", { ...s, duration });
}
export async function deleteSound(id: string): Promise<void> { await (await dbPromise).delete("sounds", id); }
export async function loadNotes(): Promise<Note[]> {
  const all = await (await dbPromise).getAll("notes");
  return all.sort((a, b) => a.order - b.order).map(({ order: _order, ...n }) => n);
}
export async function saveNote(n: Note, order: number): Promise<void> { await (await dbPromise).put("notes", { ...n, order }); }
export async function saveNoteOrder(notes: Note[]): Promise<void> {
  const tx = (await dbPromise).transaction("notes", "readwrite");
  await Promise.all([...notes.map((n, order) => tx.store.put({ ...n, order })), tx.done]);
}
export async function deleteNote(id: string): Promise<void> { await (await dbPromise).delete("notes", id); }
export async function loadGroups(): Promise<Group[]> {
  const all = await (await dbPromise).getAll("groups");
  return all.sort((a, b) => a.order - b.order).map(({ order: _order, ...g }) => g);
}
/** Schreibt die komplette Gruppenliste neu (in einer Transaktion). */
export async function saveGroups(groups: Group[]): Promise<void> {
  const tx = (await dbPromise).transaction("groups", "readwrite");
  await Promise.all([tx.store.clear(), ...groups.map((g, order) => tx.store.put({ ...g, order })), tx.done]);
}
export async function deletePad(id: string): Promise<void> { await (await dbPromise).delete("pads", id); }
export async function loadBanks(): Promise<StoredBank[]> {
  return (await (await dbPromise).getAll("banks")).sort((a, b) => a.order - b.order);
}
export async function saveBanks(banks: Omit<StoredBank, "order">[]): Promise<void> {
  const db = await dbPromise;
  const tx = db.transaction("banks", "readwrite");
  banks.forEach((b, order) => void tx.store.put({ ...b, order }));
  await tx.done;
}
/** Löscht eine Bank samt ihrer Pad-Konfigurationen (Sounds bleiben in der Bibliothek). */
export async function deleteBankData(bankId: string): Promise<void> {
  const db = await dbPromise;
  const tx = db.transaction(["banks", "pads"], "readwrite");
  void tx.objectStore("banks").delete(bankId);
  for (const key of await tx.objectStore("pads").getAllKeys()) {
    if (key.startsWith(bankId + ":")) void tx.objectStore("pads").delete(key);
  }
  await tx.done;
}
