import { openDB, type DBSchema } from "idb";
import { contentHash, uuid } from "../model/ids";

export interface StoredSound { id: string; name: string; hash: string; size: number; blob: Blob }
export interface PadConfig {
  id: string; name: string; color: string; volume: number; loop: boolean; soundId: string | null;
  start?: number; end?: number; // Schnitt in Sekunden (nicht destruktiv); leer = ganzes Sample
}
export interface StoredBank { id: string; name: string; columns: number; padCount: number; order: number }
interface SamplerDB extends DBSchema {
  banks: { key: string; value: StoredBank };
  sounds: { key: string; value: StoredSound; indexes: { hash: string } };
  pads: { key: string; value: PadConfig };
}

const dbPromise = openDB<SamplerDB>("sampler", 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore("sounds", { keyPath: "id" }).createIndex("hash", "hash");
      db.createObjectStore("pads", { keyPath: "id" });
    }
    if (oldVersion < 2) db.createObjectStore("banks", { keyPath: "id" });
  },
});

/** Speichert eine Datei; erkennt Duplikate per Prüfsumme. Gibt die Sound-ID zurück. */
export async function importSound(file: File, data: ArrayBuffer): Promise<string> {
  const db = await dbPromise;
  const hash = await contentHash(data);
  const existing = await db.getFromIndex("sounds", "hash", hash);
  if (existing) return existing.id;
  const id = uuid();
  await db.put("sounds", { id, name: file.name, hash, size: file.size, blob: new Blob([data], { type: file.type }) });
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
  banks: Omit<StoredBank, "order">[]; pads: PadConfig[]; sounds: StoredSound[];
}): Promise<void> {
  const db = await dbPromise;
  const tx = db.transaction(["banks", "pads", "sounds"], "readwrite");
  const jobs: Promise<unknown>[] = [
    tx.objectStore("banks").clear(), tx.objectStore("pads").clear(), tx.objectStore("sounds").clear(),
  ];
  d.banks.forEach((b, order) => jobs.push(tx.objectStore("banks").put({ ...b, order })));
  d.pads.forEach((p) => jobs.push(tx.objectStore("pads").put(p)));
  d.sounds.forEach((s) => jobs.push(tx.objectStore("sounds").put(s)));
  await Promise.all([...jobs, tx.done]);
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
