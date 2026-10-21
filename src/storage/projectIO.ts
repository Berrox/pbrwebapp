// Verbindung zwischen Projektformat und Datenbank.
import type { PadConfig, StoredSound } from "./db";
import { loadAllSounds, replaceAllData } from "./db";
import type { Bank } from "../model/banks";
import { contentHash } from "../model/ids";
import { buildProjectZip, type ResolvedImport } from "../model/projectFormat";

/** Uint8Array → Blob (Typ-Umweg wegen neuerer TypeScript-Versionen). */
export const toBlob = (bytes: Uint8Array, type: string): Blob => new Blob([bytes as unknown as BlobPart], { type });

export async function exportProject(name: string, banks: Bank[], store: Map<string, PadConfig>): Promise<Uint8Array> {
  const stored = await loadAllSounds();
  const sounds = await Promise.all(stored.map(async (s) => ({ id: s.id, name: s.name, bytes: new Uint8Array(await s.blob.arrayBuffer()) })));
  return buildProjectZip(name, banks, store, sounds);
}

export async function importResolved(r: ResolvedImport): Promise<void> {
  const sounds: StoredSound[] = await Promise.all(r.sounds.map(async (s) => ({
    id: s.id, name: s.name, size: s.bytes.length, blob: toBlob(s.bytes, s.mime),
    hash: await contentHash(s.bytes.buffer.slice(s.bytes.byteOffset, s.bytes.byteOffset + s.bytes.byteLength) as ArrayBuffer),
  })));
  await replaceAllData({ banks: r.banks, pads: r.pads, sounds }); // erst hier wird das alte Projekt ersetzt
}
