// Service Worker: macht die App offline nutzbar. Nur Dateien der App selbst, keine fremden Server.
const CACHE = "sampler-v2";
const TIMEOUT_MS = 3000;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const res = await fetch("./index.html", { cache: "reload" });
    const html = await res.clone().text();
    const urls = [...new Set([...html.matchAll(/(?:src|href)="(\.\/[^"?#]+)"/g)].map((m) => m[1]))];
    await cache.put("./index.html", res);
    // Programm und Design MÜSSEN gespeichert werden, sonst bricht die Installation ab (statt halb zu funktionieren).
    await Promise.all(urls.filter((u) => /\.(js|css)$/.test(u)).map((u) => cache.add(u)));
    // Icons, Manifest usw.: wenn eine fehlt, ist das nicht kritisch.
    await Promise.allSettled([cache.add("./"), ...urls.filter((u) => !/\.(js|css)$/.test(u)).map((u) => cache.add(u))]);
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  event.respondWith(req.mode === "navigate" ? networkFirst(req) : cacheFirst(req));
});

// Startseite: online immer die neueste Version, bei schlechter oder fehlender Verbindung die gespeicherte.
async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(rej, TIMEOUT_MS))]);
    if (res.ok) cache.put("./index.html", res.clone());
    return res;
  } catch {
    return (await cache.match("./index.html")) || (await cache.match("./")) || Response.error();
  }
}
// Übrige Dateien (Namen enthalten eine Prüfsumme): erst Speicher, sonst Netz.
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}
