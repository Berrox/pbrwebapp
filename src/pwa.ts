// Offline-Betrieb: Service Worker anmelden und den Zustand ehrlich anzeigen.
const CACHE = "sampler-v2"; // muss zu public/sw.js passen

export async function setupOffline(el: HTMLElement): Promise<void> {
  const parts: string[] = [];
  const show = () => { el.textContent = parts.join(" · "); };
  if (!import.meta.env.PROD) { parts.push("Entwicklungsmodus (kein Offline-Speicher)"); show(); return; }
  if (!("serviceWorker" in navigator)) { parts.push("Offline-Betrieb in diesem Browser nicht möglich"); show(); return; }
  try {
    await navigator.serviceWorker.register("./sw.js");
    // Nicht unendlich warten: hängt die Installation, wird das angezeigt.
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, rej) => setTimeout(() => rej(new Error("Installation dauert zu lange oder ist fehlgeschlagen")), 10000)),
    ]);
    const files = (await (await caches.open(CACHE)).keys()).length;
    parts.push(files >= 3 ? `✓ Offline bereit (${files} Dateien)` : `Offline unvollständig (${files} Dateien), bitte mit Internet neu laden`);
  } catch (e) {
    parts.push("Offline nicht aktiv: " + (e instanceof Error ? e.message : String(e)));
  }
  try {
    if (navigator.storage?.persist) {
      parts.push((await navigator.storage.persist()) ? "Speicher dauerhaft" : "Speicher nicht garantiert, bitte regelmäßig exportieren");
    }
  } catch { /* nicht unterstützt */ }
  const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  parts.push(standalone ? "App-Modus" : "im Browser-Tab");
  show();
}
