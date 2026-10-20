import { openDB, type DBSchema } from "idb";

export interface StoredSound { id: string; name: string; hash: string; size: number; blob: Blob }
export interface PadConfig {
  id: string; name: string; color: string; volume: number; loop: boolean; soundId: string | null;
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

async function sha256(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Speichert eine Datei; erkennt Duplikate per Prüfsumme. Gibt die Sound-ID zurück. */
export async function importSound(file: File, data: ArrayBuffer): Promise<string> {
  const db = await dbPromise;
  const hash = await sha256(data);
  const existing = await db.getFromIndex("sounds", "hash", hash);
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await db.put("sounds", { id, name: file.name, hash, size: file.size, blob: new Blob([data], { type: file.type }) });
  return id;
}
export async function getSound(id: string): Promise<StoredSound | undefined> {
  return (await dbPromise).get("sounds", id);
}
export async function savePad(p: PadConfig): Promise<void> { await (await dbPromise).put("pads", p); }
export async function loadPads(): Promise<PadConfig[]> { return (await dbPromise).getAll("pads"); }
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
