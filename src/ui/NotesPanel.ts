// Notizbereich: Darstellung und Bedienung. Die Daten liegen in NotesStore.
import type { NotesStore } from "../model/notes";

const VIS_KEY = "sampler.notes";
const STATUS_TEXT = { idle: "", saving: "Speichern …", saved: "✓ Gespeichert", error: "⚠ Speichern fehlgeschlagen. Bitte Projekt exportieren." };

interface Elements {
  store: NotesStore; panel: HTMLElement; list: HTMLElement; status: HTMLElement;
  addBtn: HTMLButtonElement; toggle: HTMLButtonElement;
  onVisibility?: (visible: boolean) => void; // nach Umschalten durch den Benutzer
}
export function mountNotes({ store, panel, list, status, addBtn, toggle, onVisibility }: Elements) {
  let editable = false;

  function setVisible(v: boolean): void {
    panel.hidden = !v; // nur ausblenden: Inhalte bleiben unverändert erhalten
    toggle.setAttribute("aria-pressed", String(v));
    toggle.classList.toggle("active", v);
    toggle.textContent = v ? "📝 Notizen: AN" : "📝 Notizen: AUS";
    try { localStorage.setItem(VIS_KEY, v ? "on" : "off"); } catch { /* egal */ }
    if (!v) void store.flush();
  }
  function renderStatus(): void {
    status.textContent = STATUS_TEXT[store.state];
    status.className = store.state;
  }
  const mk = (label: string, aria: string, fn: () => void, disabled = false) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "tab"; b.textContent = label; b.disabled = disabled;
    b.setAttribute("aria-label", aria); b.addEventListener("click", fn);
    return b;
  };
  function render(): void {
    list.replaceChildren();
    panel.classList.toggle("ro", !editable);
    addBtn.hidden = !editable;
    if (!store.notes.length) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = editable ? "Noch keine Notizen. Mit „+ Notiz“ eine anlegen." : "Keine Notizen vorhanden.";
      list.append(p);
    }
    store.notes.forEach((n, i) => {
      const card = document.createElement("section"); card.className = "note";
      const head = document.createElement("div"); head.className = "noteHead";
      const title = document.createElement("input");
      title.value = n.title; title.maxLength = 100; title.readOnly = !editable;
      title.setAttribute("aria-label", "Titel der Notiz");
      title.addEventListener("input", () => store.edit(n.id, { title: title.value }));
      title.addEventListener("blur", () => void store.flush());
      const tools = document.createElement("span"); tools.className = "noteTools";
      tools.append(
        mk("▲", "Notiz nach oben", () => void store.move(n.id, -1), i === 0),
        mk("▼", "Notiz nach unten", () => void store.move(n.id, 1), i === store.notes.length - 1),
        mk("✕", "Notiz löschen", () => {
          if (confirm(`Notiz „${n.title || "ohne Titel"}“ wirklich löschen?`)) void store.remove(n.id);
        }),
      );
      head.append(title, tools);
      const ta = document.createElement("textarea");
      ta.value = n.text; ta.readOnly = !editable;
      ta.setAttribute("aria-label", `Text der Notiz ${n.title}`);
      ta.addEventListener("input", () => store.edit(n.id, { text: ta.value })); // ohne Neuzeichnen: Cursor bleibt
      ta.addEventListener("blur", () => void store.flush());
      card.append(head, ta);
      list.append(card);
    });
  }
  store.onList = render;
  store.onState = renderStatus;
  toggle.addEventListener("click", () => { setVisible(panel.hidden); onVisibility?.(!panel.hidden); });
  addBtn.addEventListener("click", async () => {
    await store.add();
    (list.querySelector(".note:last-child input") as HTMLInputElement | null)?.focus();
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void store.flush(); });
  window.addEventListener("pagehide", () => void store.flush());

  let initial = false;
  try { initial = localStorage.getItem(VIS_KEY) === "on"; } catch { /* egal */ }
  setVisible(initial);
  return { render, setEditable(e: boolean) { editable = e; render(); }, get visible(): boolean { return !panel.hidden; } };
}
