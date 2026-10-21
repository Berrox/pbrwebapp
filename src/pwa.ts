// Offline-Betrieb: Service Worker anmelden und Zustand anzeigen.
export async function setupOffline(el: HTMLElement): Promise<void> {
  const parts: string[] = [];
  const show = () => { el.textContent = parts.join(" · "); };
  if (!import.meta.env.PROD) { parts.push("Entwicklungsmodus (kein Offline-Speicher)"); show(); return; }
  if (!("serviceWorker" in navigator)) { parts.push("Offline-Betrieb in diesem Browser nicht möglich"); show(); return; }
  try {
    await navigator.serviceWorker.register("./sw.js");
    await navigator.serviceWorker.ready;
    parts.push((await caches.match("./index.html")) ? "✓ Offline bereit" : "Offline noch nicht bereit (Seite einmal neu laden)");
  } catch { parts.push("Offline-Funktion konnte nicht aktiviert werden"); }
  try {
    if (navigator.storage?.persist) {
      parts.push((await navigator.storage.persist()) ? "Speicher dauerhaft" : "Speicher nicht garantiert, bitte regelmäßig exportieren");
    }
  } catch { /* nicht unterstützt */ }
  const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (!standalone && /iPad|iPhone|iPod/.test(navigator.userAgent)) parts.push("Tipp: zum Home-Bildschirm hinzufügen");
  show();
}
