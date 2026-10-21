// Hilfsfunktionen mit Ausweichlösung: Über unverschlüsseltes HTTP (z. B. iPad im WLAN)
// fehlen crypto.subtle und evtl. crypto.randomUUID.
export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Prüfsumme zur Duplikat-Erkennung. Ohne crypto.subtle: einfachere FNV-1a-Summe (schwächer, aber ausreichend). */
export async function contentHash(data: ArrayBuffer): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const h = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  const bytes = new Uint8Array(data);
  let h1 = 0x811c9dc5, h2 = 0x1b873593;
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ bytes[i], 0x85ebca6b) >>> 0;
  }
  return `fnv-${bytes.length}-${h1.toString(16)}-${h2.toString(16)}`;
}
