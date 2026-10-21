import "./styles/theme.css";
import { AudioEngine } from "./audio/AudioEngine";
import {
  deleteBankData, deletePad, deleteSound, getSound, importSound, listSounds, renameSound, setSoundDuration, loadBanks, loadPads, savePad, saveBanks, type PadConfig,
} from "./storage/db";
import { openSampleEditor } from "./ui/SampleEditor";
import { findConflict, isAssignableKey, keyLabel } from "./model/keys";
import { midiSupported, noteName, startMidi } from "./input/midi";
import { formatDuration, formatSize, isSupportedAudioName, isValidSoundName, padsUsingSound } from "./model/library";
import { padAction } from "./model/mode";
import { setupOffline } from "./pwa";
import { clampRegion } from "./model/region";
import { ProjectError, parseProjectZip, resolveImport } from "./model/projectFormat";
import { exportProject, importResolved, toBlob } from "./storage/projectIO";
import { clampInt, makePads, migrateLegacy, moveBank, newBank, padPrefix, type Bank } from "./model/banks";

const engine = new AudioEngine();
const buffers = new Map<string, AudioBuffer>(); // dekodierte Sounds, nur einmal dekodiert
const store = new Map<string, PadConfig>(); // alle Pads aller Bänke
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const grid = $("grid"), tabs = $("tabs"), status = $("status"), dialog = $<HTMLDialogElement>("padDialog");

let banks: Bank[] = [];
let current = 0;
let editMode = false;
let editing: PadConfig | null = null;
let learning: "key" | "midi" | null = null; // wartet gerade auf Tastendruck bzw. MIDI-Note
let pendingKey: string | undefined;
let pendingMidi: number | undefined;

const cur = (): Bank => banks[current];
function say(msg: string): void { status.textContent = msg; }

async function persistBanks(): Promise<void> {
  try { await saveBanks(banks); } catch { say("Speichern fehlgeschlagen (Speicher voll?)."); }
}

async function bufferFor(soundId: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(soundId);
  if (cached) return cached;
  const s = await getSound(soundId);
  if (!s) return null;
  try {
    const buf = await engine.decode(await s.blob.arrayBuffer());
    buffers.set(soundId, buf);
    return buf;
  } catch { return null; }
}

function renderTabs(): void {
  tabs.replaceChildren();
  const playing = engine.playingIds();
  banks.forEach((b, i) => {
    const t = document.createElement("button");
    t.type = "button";
    t.className = "tab" + (i === current ? " active" : "");
    const running = playing.some((id) => id.startsWith(padPrefix(b.id)));
    t.textContent = (running ? "● " : "") + b.name; // textContent: kein HTML aus Namen
    t.addEventListener("pointerdown", (e) => { e.preventDefault(); current = i; render(); }); // stoppt nichts
    tabs.append(t);
  });
  $<HTMLInputElement>("bCols").value = String(cur().columns);
  $<HTMLInputElement>("bCount").value = String(cur().padCount);
}

function renderGrid(): void {
  grid.replaceChildren();
  grid.style.gridTemplateColumns = `repeat(${cur().columns}, 1fr)`;
  for (const p of makePads(cur(), store)) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pad" + (p.soundId ? "" : " empty") + (engine.isPlaying(p.id) ? " playing" : "");
    b.style.background = p.color;
    b.textContent = p.name || (editMode ? "+ leer" : "");
    const hint = [p.key ? `[${keyLabel(p.key)}]` : "", p.midiNote !== undefined ? `♪${noteName(p.midiNote)}` : ""].filter(Boolean).join(" ");
    if (hint && p.soundId) { const s = document.createElement("small"); s.textContent = hint; b.append(s); }
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); void onPad(p); });
    grid.append(b);
  }
}
function render(): void { renderTabs(); renderGrid(); }

async function onPad(p: PadConfig): Promise<void> {
  await engine.unlock();
  const action = padAction(editMode ? "edit" : "live", !!p.soundId, engine.isPlaying(p.id));
  if (action === "edit") { openDialog(p); return; }
  if (action === "ignore") return; // leere Pads: keine Reaktion, keine Fehlermeldung
  if (action === "stop") { engine.stop(p.id); return; }
  const buf = await bufferFor(p.soundId);
  if (!buf) { say(`„${p.name}“: Audiodatei fehlt oder ist defekt.`); return; }
  engine.play(p.id, buf, { volume: p.volume, loop: p.loop, start: p.start, end: p.end });
}

const soundNames = new Map<string, string>();
async function fillLibrarySelect(p: PadConfig): Promise<void> {
  const sel = $<HTMLSelectElement>("fLibrary");
  sel.replaceChildren(new Option("– keine Änderung –", "")); // Option setzt Text sicher, kein HTML
  try {
    for (const s of await listSounds()) {
      soundNames.set(s.id, s.name);
      sel.append(new Option(s.name + (s.id === p.soundId ? " (aktuell)" : ""), s.id));
    }
  } catch { /* Bibliothek nicht lesbar: Auswahl bleibt leer */ }
}

/** Prüft die Datei (muss dekodierbar sein), speichert sie und gibt die Sound-ID zurück. */
async function importToLibrary(file: File): Promise<string | null> {
  let data: ArrayBuffer, buf: AudioBuffer;
  try {
    data = await file.arrayBuffer();
    buf = await engine.decode(data.slice(0));
  } catch { say(`„${file.name}“ kann nicht gelesen werden. Bitte WAV oder MP3 verwenden.`); return null; }
  try {
    const id = await importSound(file, data, buf.duration);
    buffers.set(id, buf);
    return id;
  } catch { say("Speichern fehlgeschlagen (Speicher voll?)."); return null; }
}
async function importMany(files: File[]): Promise<void> {
  const audio = files.filter((f) => isSupportedAudioName(f.name));
  if (!audio.length) { say("Keine WAV- oder MP3-Dateien gefunden."); return; }
  const failed: string[] = [];
  for (const [i, f] of audio.entries()) {
    say(`Importiere ${i + 1} von ${audio.length} …`);
    if (!(await importToLibrary(f))) failed.push(f.name);
  }
  say(`${audio.length - failed.length} von ${audio.length} Sound(s) importiert.` + (failed.length ? ` Nicht lesbar: ${failed.join(", ")}` : ""));
  if (libDialog.open) await renderLibrary();
}

function refreshLearn(): void {
  $("fKeyLabel").textContent = learning === "key" ? "Taste drücken …" : pendingKey ? keyLabel(pendingKey) : "–";
  $("fMidiLabel").textContent = learning === "midi" ? "Note spielen …"
    : pendingMidi !== undefined ? `Note ${pendingMidi} (${noteName(pendingMidi)})` : "–";
}

function openDialog(p: PadConfig): void {
  editing = p;
  $<HTMLInputElement>("fName").value = p.name;
  $<HTMLInputElement>("fColor").value = p.color;
  $<HTMLInputElement>("fVol").value = String(p.volume);
  $<HTMLInputElement>("fLoop").checked = p.loop;
  $<HTMLInputElement>("fFile").value = "";
  pendingKey = p.key; pendingMidi = p.midiNote; learning = null; refreshLearn();
  $("fSound").textContent = p.soundId ? "Audiodatei zugewiesen." : "Noch keine Audiodatei.";
  void fillLibrarySelect(p);
  dialog.showModal();
}

dialog.addEventListener("close", async () => {
  const p = editing; editing = null;
  if (!p) return;
  learning = null;
  const action = dialog.returnValue;
  let conflictMsg = "";
  if (action === "clear") {
    engine.stop(p.id);
    Object.assign(p, { name: "", soundId: null, start: undefined, end: undefined, key: undefined, midiNote: undefined });
  } else if (action === "ok") {
    p.name = $<HTMLInputElement>("fName").value.trim();
    p.color = $<HTMLInputElement>("fColor").value;
    p.volume = Number($<HTMLInputElement>("fVol").value);
    p.loop = $<HTMLInputElement>("fLoop").checked;
    const pads = makePads(cur(), store);
    const kc = findConflict(pads, p.id, "key", pendingKey), mc = findConflict(pads, p.id, "midiNote", pendingMidi);
    if (kc) conflictMsg += `Taste ${keyLabel(pendingKey!)} ist schon an „${kc.name || "Pad"}“ vergeben und wurde nicht übernommen. `;
    else p.key = pendingKey;
    if (mc) conflictMsg += `MIDI-Note ${pendingMidi} ist schon an „${mc.name || "Pad"}“ vergeben und wurde nicht übernommen.`;
    else p.midiNote = pendingMidi;
    const file = $<HTMLInputElement>("fFile").files?.[0];
    const libId = $<HTMLSelectElement>("fLibrary").value;
    let newId: string | null = null, newName = "";
    if (file) { newId = await importToLibrary(file); newName = file.name; }
    else if (libId && libId !== p.soundId) { newId = libId; newName = soundNames.get(libId) ?? ""; }
    if (newId) {
      p.soundId = newId;
      p.start = undefined; p.end = undefined; // neuer Sound: alter Schnitt gilt nicht mehr
      if (!p.name) p.name = newName.replace(/\.[^.]+$/, "");
    }
  } else { render(); return; }
  try { await savePad(p); say(conflictMsg || "Gespeichert."); }
  catch { say("Speichern fehlgeschlagen (Speicher voll?)."); }
  render();
});

// ---- Bank-Werkzeuge (nur im Bearbeitungsmodus sichtbar) ----
$("bAdd").addEventListener("click", async () => {
  const name = prompt("Name der neuen Bank:")?.trim();
  if (!name) return;
  banks.push(newBank(name)); current = banks.length - 1;
  await persistBanks(); render();
});
$("bRename").addEventListener("click", async () => {
  const name = prompt("Neuer Name der Bank:", cur().name)?.trim();
  if (!name) return;
  cur().name = name; await persistBanks(); render();
});
for (const [id, dir] of [["bLeft", -1], ["bRight", 1]] as const) {
  $(id).addEventListener("click", async () => {
    const r = moveBank(banks, current, dir);
    banks = r.banks; current = r.index;
    await persistBanks(); render();
  });
}
$("bDel").addEventListener("click", async () => {
  if (banks.length <= 1) { say("Die letzte Bank kann nicht gelöscht werden."); return; }
  const b = cur();
  if (!confirm(`Bank „${b.name}“ mit allen Pad-Einstellungen wirklich löschen?`)) return;
  for (const id of [...store.keys()]) {
    if (id.startsWith(padPrefix(b.id))) { engine.stop(id); store.delete(id); }
  }
  try { await deleteBankData(b.id); } catch { say("Löschen fehlgeschlagen."); return; }
  banks.splice(current, 1);
  current = Math.min(current, banks.length - 1);
  await persistBanks(); render();
});
$<HTMLInputElement>("bCols").addEventListener("change", async (e) => {
  cur().columns = clampInt(Number((e.target as HTMLInputElement).value), 1, 8, cur().columns);
  await persistBanks(); render();
});
$<HTMLInputElement>("bCount").addEventListener("change", async (e) => {
  cur().padCount = clampInt(Number((e.target as HTMLInputElement).value), 1, 48, cur().padCount);
  await persistBanks(); render(); // Pads über dem neuen Limit behalten ihre Einstellungen
});

$("fEdit").addEventListener("click", async () => {
  const p = editing;
  if (!p?.soundId) { $("fSound").textContent = "Zuerst eine Audiodatei zuweisen und speichern."; return; }
  const buf = await bufferFor(p.soundId);
  if (!buf) { say("Audiodatei fehlt oder ist defekt."); return; }
  await engine.unlock();
  openSampleEditor({
    engine, buffer: buf, region: clampRegion(p.start, p.end, buf.duration),
    volume: Number($<HTMLInputElement>("fVol").value),
    onApply: async (r) => {
      p.start = r?.start; p.end = r?.end;
      try { await savePad(p); say("Schnitt gespeichert."); } catch { say("Speichern fehlgeschlagen."); }
      render();
    },
  });
});

let projectName = "Sampler-Projekt";
$("pExport").addEventListener("click", async () => {
  const name = prompt("Name des Projekts (wird zum Dateinamen):", projectName)?.trim();
  if (!name) return;
  projectName = name;
  try {
    say("Erzeuge ZIP …");
    const bytes = await exportProject(name, banks, store);
    const url = URL.createObjectURL(toBlob(bytes, "application/zip"));
    const a = document.createElement("a");
    a.href = url; a.download = `${name.replace(/[^\w.-]+/g, "_")}.zip`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    say(`ZIP erzeugt (${(bytes.length / 1048576).toFixed(1)} MB), Download gestartet. Bitte prüfe, ob die Datei gespeichert wurde.`);
  } catch { say("Export fehlgeschlagen (zu wenig Arbeitsspeicher oder Platz?)."); }
});
$("pImport").addEventListener("click", () => $<HTMLInputElement>("pFile").click());
$<HTMLInputElement>("pFile").addEventListener("change", async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try {
    say("Prüfe Projekt …");
    const parsed = parseProjectZip(new Uint8Array(await file.arrayBuffer()));
    const r = resolveImport(parsed);
    const msg = `Projekt „${parsed.project.name}“ importieren?\n${r.banks.length} Bänke, ${r.sounds.length} Sounds`
      + (r.warnings.length ? `\n${r.warnings.length} Pad(s) ohne Audiodatei` : "")
      + "\n\nDas aktuelle Projekt wird ERSETZT. Tipp: vorher exportieren.";
    if (!confirm(msg)) { say("Import abgebrochen."); return; }
    engine.stopAll();
    await importResolved(r); // atomar: bei Fehler bleibt das alte Projekt unverändert
    store.clear(); r.pads.forEach((p) => store.set(p.id, p));
    banks = r.banks; current = 0; buffers.clear(); projectName = parsed.project.name;
    render();
    say("Projekt importiert." + (r.warnings.length ? ` ${r.warnings.length} Pad(s) ohne Audiodatei.` : ""));
  } catch (err) {
    say(err instanceof ProjectError ? err.message : "Import fehlgeschlagen. Das aktuelle Projekt wurde nicht verändert.");
  }
});

const libDialog = $<HTMLDialogElement>("libraryDialog");
async function renderLibrary(): Promise<void> {
  const list = $("libList");
  let sounds = await listSounds();
  for (const s of sounds) { // fehlende Dauer einmalig nachtragen
    if (s.duration === undefined) {
      say("Lese Dauer …");
      const buf = await bufferFor(s.id);
      if (buf) { s.duration = buf.duration; await setSoundDuration(s.id, buf.duration); }
    }
  }
  sounds = sounds.slice();
  list.replaceChildren();
  if (!sounds.length) { list.textContent = "Noch keine Sounds importiert."; return; }
  for (const s of sounds) {
    const used = padsUsingSound(store, s.id);
    const row = document.createElement("div"); row.className = "libRow";
    const name = document.createElement("div"); name.className = "libName";
    const b = document.createElement("b"); b.textContent = s.name;
    const small = document.createElement("small");
    small.textContent = `${formatSize(s.size)} · ${formatDuration(s.duration)} · ` + (used.length ? `verwendet von ${used.length} Pad(s)` : "nicht verwendet");
    name.append(b, small);
    const mk = (label: string, fn: () => Promise<void>) => {
      const btn = document.createElement("button"); btn.type = "button"; btn.className = "tab"; btn.textContent = label;
      btn.addEventListener("click", () => void fn()); return btn;
    };
    row.append(name,
      mk("▶ Hören", async () => {
        if (engine.isPlaying("__preview__")) { engine.stop("__preview__"); return; }
        await engine.unlock();
        const buf = await bufferFor(s.id);
        if (buf) engine.play("__preview__", buf, { volume: 0.9, loop: false }); else say("Audiodatei defekt.");
      }),
      mk("Umbenennen", async () => {
        const n = prompt("Neuer Name:", s.name);
        if (n === null) return;
        if (!isValidSoundName(n)) { say("Der Name darf nicht leer sein."); return; }
        try { await renameSound(s.id, n.trim()); } catch { say("Umbenennen fehlgeschlagen."); }
        await renderLibrary();
      }),
      mk("Löschen", async () => {
        const msg = used.length
          ? `„${s.name}“ wird von ${used.length} Pad(s) verwendet. Wirklich löschen? Diese Pads werden leer.`
          : `„${s.name}“ aus der Bibliothek löschen?`;
        if (!confirm(msg)) return;
        try {
          for (const p of used) { engine.stop(p.id); p.soundId = null; p.start = undefined; p.end = undefined; await savePad(p); }
          await deleteSound(s.id);
          buffers.delete(s.id);
        } catch { say("Löschen fehlgeschlagen."); }
        render(); await renderLibrary();
      }));
    list.append(row);
  }
  say(`${sounds.length} Sound(s) in der Bibliothek.`);
}
$("pLibrary").addEventListener("click", async () => { libDialog.showModal(); await renderLibrary(); });
$("libClose").addEventListener("click", () => libDialog.close());
libDialog.addEventListener("close", () => engine.stop("__preview__"));
$("libImport").addEventListener("click", () => $<HTMLInputElement>("libFiles").click());
$<HTMLInputElement>("libFiles").addEventListener("change", async (e) => {
  const input = e.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = "";
  await importMany(files);
});
// Drag-and-drop: immer abfangen, sonst öffnet der Browser die Datei und verlässt die App.
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", async (e) => {
  e.preventDefault();
  if (!editMode) { say("Zum Importieren zuerst in den Bearbeiten-Modus wechseln."); return; }
  await importMany([...(e.dataTransfer?.files ?? [])]);
});

$("stopAll").addEventListener("pointerdown", (e) => { e.preventDefault(); engine.stopAll(); });
const modeBtn = $("modeBtn");

function setMode(edit: boolean): void {
  editMode = edit;
  modeBtn.className = edit ? "edit" : "live";
  modeBtn.textContent = edit ? "✎ BEARBEITEN – tippen für LIVE" : "🔒 LIVE – tippen zum Bearbeiten";
  $("bankTools").hidden = !edit;
  $("projectTools").hidden = !edit;
  try { localStorage.setItem("sampler.mode", edit ? "edit" : "live"); } catch { /* egal */ }
  render();
}
const unlockDialog = $<HTMLDialogElement>("unlockDialog");
modeBtn.addEventListener("click", () => {
  if (editMode) { setMode(false); return; }
  unlockDialog.returnValue = ""; // sonst würde Esc den Wert vom letzten Mal behalten
  unlockDialog.showModal();
});
unlockDialog.addEventListener("close", () => { if (unlockDialog.returnValue === "ok") setMode(true); });
document.addEventListener("contextmenu", (e) => { if (!editMode) e.preventDefault(); });
const anyDialogOpen = (): boolean => !!document.querySelector("dialog[open]");
document.addEventListener("keydown", (e) => {
  if (learning === "key") { // Taste für ein Pad aufnehmen
    e.preventDefault(); e.stopPropagation();
    if (e.code === "Escape") learning = null;
    else if (!isAssignableKey(e.code)) { say("Diese Taste ist nicht erlaubt. Erlaubt: Buchstaben, Ziffern, Ziffernblock."); return; }
    else { pendingKey = e.code; learning = null; }
    refreshLearn(); return;
  }
  if (e.key === "Escape" && !anyDialogOpen()) { engine.stopAll(); return; }
  if (editMode || anyDialogOpen() || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
  const tag = (e.target as HTMLElement).tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  const p = makePads(cur(), store).find((x) => x.key === e.code); // gilt für die aktuell gewählte Bank
  if (p) { e.preventDefault(); void onPad(p); }
}, true);

let midiStarted = false;
async function ensureMidi(): Promise<void> {
  if (midiStarted) return;
  const r = await startMidi(onMidiNote);
  midiStarted = r.ok; $("midiState").textContent = r.text;
  if (!r.ok) say(r.text);
}
function onMidiNote(note: number): void {
  if (learning === "midi") { pendingMidi = note; learning = null; refreshLearn(); return; }
  if (editMode || anyDialogOpen()) return; // MIDI löst nur im Live-Modus Pads aus
  const p = makePads(cur(), store).find((x) => x.midiNote === note);
  if (p) void onPad(p);
}
$("fKeyLearn").addEventListener("click", () => { learning = "key"; refreshLearn(); });
$("fKeyClear").addEventListener("click", () => { pendingKey = undefined; learning = null; refreshLearn(); });
$("fMidiClear").addEventListener("click", () => { pendingMidi = undefined; learning = null; refreshLearn(); });
$("fMidiLearn").addEventListener("click", async () => {
  if (!midiSupported()) { say("MIDI wird von diesem Browser nicht unterstützt (zum Beispiel Safari/iPad). Am PC mit Chrome oder Edge möglich."); return; }
  learning = "midi"; refreshLearn();
  await ensureMidi();
  if (!midiStarted) { learning = null; refreshLearn(); }
});
engine.onChange(render);

async function start(): Promise<void> {
  const savedPads = await loadPads();
  banks = await loadBanks();
  if (!banks.length) {
    banks = [{ id: "bank-1", name: "Bank 1", columns: 4, padCount: 12 }];
    await saveBanks(banks);
  }
  for (const p of savedPads) store.set(p.id, p);
  for (const { oldId, pad } of migrateLegacy(savedPads, banks[0].id)) { // Übernahme aus M1
    store.delete(oldId); store.set(pad.id, pad);
    await savePad(pad); await deletePad(oldId);
  }
  render();
  let saved: string | null = null;
  try { saved = localStorage.getItem("sampler.mode"); } catch { /* egal */ }
  setMode(saved !== "live"); // nach einem Neuladen im Live-Modus bleibt die Sperre aktiv
  say(editMode ? "Bereit. Pad antippen zum Belegen." : "Bereit. LIVE-Modus.");
  void setupOffline($("offlineState"));
  $("midiState").textContent = midiSupported() ? "MIDI aus" : "MIDI nicht verfügbar in diesem Browser";
  if (midiSupported() && [...store.values()].some((p) => p.midiNote !== undefined)) void ensureMidi();
}
void start();
