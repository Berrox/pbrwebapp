import "./styles/theme.css";
import { AudioEngine } from "./audio/AudioEngine";
import {
  deleteBankData, deleteNote, deletePad, loadGroups, saveGroups, loadNotes, saveNote, saveNoteOrder, deleteSound, getSound, importSound, listSounds, renameSound, setSoundDuration, loadBanks, loadPads, savePad, saveBanks, type PadConfig,
} from "./storage/db";
import { openSampleEditor } from "./ui/SampleEditor";
import { findConflict, isAssignableKey, keyLabel } from "./model/keys";
import { midiSupported, noteName, startMidi } from "./input/midi";
import { formatDuration, formatSize, isSupportedAudioName, isValidSoundName, padsUsingSound } from "./model/library";
import { NotesStore } from "./model/notes";
import { mountNotes } from "./ui/NotesPanel";
import { AUDIO_ACCEPT } from "./model/audioFormats";
import { bankOf, computeStops, type Group, type PlayMode } from "./model/playRules";
import { padSubtitle, summarizeBehavior, summarizeControls, summarizeFx, summarizeNote } from "./model/padSummary";
import { uuid } from "./model/ids";
import { fxFromPad, isFlat, normalizeEq, normalizeReverb, type Fx, type ReverbSize } from "./model/fx";
import { isLightColor, padFontSize, textColorFor } from "./model/colors";
import { setIconText } from "./ui/icons";
import { backupHint, checkExportSize, parseLastExport } from "./model/backup";
import { formatClock, formatElapsed, formatRemaining, parseStopwatch, swElapsed, swInitial, swReset, swStart, swStop, type StopwatchState } from "./model/clock";
import { copyPad, normalizeFade, swapPads } from "./model/padOps";
import { WakeLockManager, type WakeApi } from "./input/wakelock";
import { normalizeNote, volumePercent } from "./model/padNotes";
import { padAction } from "./model/mode";
import { setupOffline } from "./pwa";
import { clampRegion } from "./model/region";
import { MAX_ZIP, ProjectError, parseProjectZip, resolveImport } from "./model/projectFormat";
import { exportProject, importResolved, toBlob } from "./storage/projectIO";
import { bankColor, clampInt, makePads, migrateLegacy, moveBank, newBank, padPrefix, type Bank } from "./model/banks";

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

let groups: Group[] = [];
const padLive = new Map<string, { fill: HTMLElement; tm: HTMLElement }>(); // Fortschrittsanzeige der laufenden Pads
const notesStore = new NotesStore({ loadAll: loadNotes, save: saveNote, saveOrder: saveNoteOrder, remove: deleteNote });
const notesUI = mountNotes({
  store: notesStore, panel: $("notes"), list: $("notesList"), status: $("notesStatus"),
  addBtn: $<HTMLButtonElement>("noteAdd"), toggle: $<HTMLButtonElement>("notesBtn"), onVisibility: () => render(),
});

const cur = (): Bank => banks[current];
const toastEl = $("toast");
let toastTimer: number | undefined;
/** Meldung als kurze Einblendung unten (verschwindet von selbst). Der Text bleibt zusätzlich in #status. */
function say(msg: string): void {
  status.textContent = msg;
  clearTimeout(toastTimer);
  if (!msg) { toastEl.hidden = true; return; }
  toastEl.textContent = msg;
  toastEl.hidden = false;
  toastTimer = window.setTimeout(() => { toastEl.hidden = true; }, Math.min(9000, 3000 + msg.length * 40));
}

async function persistBanks(): Promise<void> {
  try { await saveBanks(banks); } catch { say("Speichern fehlgeschlagen (Speicher voll?)."); }
}

const pendingDecodes = new Map<string, Promise<AudioBuffer | null>>();
const loading = new Set<string>(); // Pads, die gerade geladen werden (verhindert Doppelstart bei schnellem Zweittipp)
let decodedBytes = 0;
const DECODE_BUDGET = 150 * 1024 * 1024; // Obergrenze fürs Vorladen (iPad-Speicher ist begrenzt)

/** Dekodiert einen Sound höchstens einmal, auch wenn mehrere Aufrufer gleichzeitig danach fragen. */
function bufferFor(soundId: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(soundId);
  if (cached) return Promise.resolve(cached);
  let p = pendingDecodes.get(soundId);
  if (!p) {
    p = (async () => {
      try {
        const s = await getSound(soundId);
        if (!s) return null;
        const buf = await engine.decode(await s.blob.arrayBuffer());
        buffers.set(soundId, buf);
        return buf;
      } catch { return null; } finally { pendingDecodes.delete(soundId); }
    })();
    pendingDecodes.set(soundId, p);
  }
  return p;
}

function renderTabs(): void {
  tabs.replaceChildren();
  const playing = engine.playingIds();
  banks.forEach((b, i) => {
    const t = document.createElement("button");
    t.type = "button";
    const bc = bankColor(b), fg = textColorFor(bc);
    t.className = "tab bankTab" + (i === current ? " active" : "");
    t.style.background = bc; // ganze Fläche in der Bankfarbe, ohne dunklen Untergrund
    t.style.color = fg; // Schrift automatisch dunkel oder weiß
    t.style.borderBottomColor = i === current ? fg : "transparent"; // aktive Bank: Balken unten und fette Schrift
    const running = playing.some((id) => id.startsWith(padPrefix(b.id)));
    t.textContent = (running ? "● " : "") + b.name; // textContent: kein HTML aus Namen
    t.addEventListener("pointerdown", (e) => { e.preventDefault(); current = i; render(); void preloadBank(); }); // stoppt nichts
    tabs.append(t);
  });
  $<HTMLInputElement>("bColor").value = bankColor(cur());
  $<HTMLInputElement>("bCols").value = String(cur().columns);
  $<HTMLInputElement>("bCount").value = String(cur().padCount);
}

function renderGrid(): void {
  grid.replaceChildren();
  padLive.clear();
  grid.style.gridTemplateColumns = `repeat(${cur().columns}, 1fr)`;
  for (const p of makePads(cur(), store)) {
    const b = document.createElement("button");
    b.type = "button";
    const label = p.name || (editMode ? "+ leer" : "");
    b.className = "pad" + (p.soundId ? "" : " empty") + (engine.isPlaying(p.id) ? " playing" : "") + (p.soundId && isLightColor(p.color) ? " dk" : "");
    b.setAttribute("aria-pressed", String(engine.isPlaying(p.id)));
    b.style.background = p.color;
    b.style.fontSize = `${padFontSize(label)}px`; // lange Namen etwas kleiner
    b.textContent = label;
    const hint = [p.key ? `[${keyLabel(p.key)}]` : "", p.midiNote !== undefined ? `♪${noteName(p.midiNote)}` : ""].filter(Boolean).join(" ");
    if (hint && p.soundId) { const s = document.createElement("small"); s.textContent = hint; b.append(s); }
    if (notesUI.visible && p.note) { // Pad-Notizen nur bei "Notizen: AN" und nur, wenn vorhanden
      const n = document.createElement("small"); n.className = "padNote"; n.textContent = "✎ " + p.note; b.append(n);
    }
    if (engine.isPlaying(p.id)) { // Fortschritt und Restzeit nur für laufende Pads
      const bar = document.createElement("span"); bar.className = "padBar";
      const fill = document.createElement("i"); bar.append(fill);
      const tm = document.createElement("small"); tm.className = "padTime";
      b.append(bar, tm); padLive.set(p.id, { fill, tm });
    }
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); void onPad(p); });
    grid.append(b);
  }
  syncProgress();
}
function render(): void { renderTabs(); renderGrid(); renderBackup(); }

async function onPad(p: PadConfig): Promise<void> {
  engine.unlock(); // wartet nicht (iOS)
  const action = padAction(editMode ? "edit" : "live", !!p.soundId, engine.isPlaying(p.id));
  if (action === "edit") { openDialog(p); return; }
  if (action === "ignore") return; // leere Pads: keine Reaktion, keine Fehlermeldung
  if (action === "stop") { engine.stop(p.id); return; }
  if (!p.soundId || loading.has(p.id)) return; // lädt schon: weitere Taps ignorieren
  loading.add(p.id);
  try {
    if (!buffers.has(p.soundId)) say("Lade Sound …");
    const buf = await bufferFor(p.soundId);
    if (!buf) { say(`„${p.name}“: Audiodatei fehlt oder ist defekt.`); return; }
    engine.play(p.id, buf, {
      volume: p.volume, loop: p.loop, start: p.start, end: p.end,
      fadeIn: p.fadeIn, fadeOut: p.fadeOut, fx: fxFromPad(p),
      stopIds: computeStops(p, engine.playingIds(), (id) => store.get(id), groups), // erst jetzt ausgewertet, direkt vor dem Start
    });
    if (!engine.running) say("Audio wird reaktiviert … (Display einmal berühren, falls nichts zu hören ist)");
  } finally { loading.delete(p.id); }
}

const soundNames = new Map<string, string>();
async function fillLibrarySelect(p: PadConfig): Promise<void> {
  const sel = $<HTMLSelectElement>("fLibrary");
  sel.replaceChildren(new Option("– keine Änderung –", "")); // Option setzt Text sicher, kein HTML
  try {
    for (const s of await listSounds()) {
      soundNames.set(s.id, s.name);
      if (s.id === p.soundId) $("fSound").textContent = `${s.name} · ${formatDuration(s.duration)} · ${formatSize(s.size)}`;
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
  } catch { say(`„${file.name}“ kann auf diesem Gerät nicht gelesen werden (Format nicht unterstützt oder Datei beschädigt). WAV und MP3 funktionieren überall.`); return null; }
  try {
    const id = await importSound(file, data, buf.duration);
    buffers.set(id, buf);
    return id;
  } catch { say("Speichern fehlgeschlagen (Speicher voll?)."); return null; }
}
async function importMany(files: File[]): Promise<void> {
  const audio = files.filter((f) => isSupportedAudioName(f.name) || f.type.startsWith("audio/"));
  if (!audio.length) { say("Keine unterstützten Audiodateien gefunden."); return; }
  const failed: string[] = [];
  for (const [i, f] of audio.entries()) {
    say(`Importiere ${i + 1} von ${audio.length} …`);
    if (!(await importToLibrary(f))) failed.push(f.name);
  }
  say(`${audio.length - failed.length} von ${audio.length} Sound(s) importiert.` + (failed.length ? ` Nicht lesbar: ${failed.join(", ")}` : ""));
  if (libDialog.open) await renderLibrary();
}

function refreshLearn(): void {
  queueMicrotask(refreshView); // Vorschau und Kurzfassungen mitziehen
  $("fKeyLabel").textContent = learning === "key" ? "Taste drücken …" : pendingKey ? keyLabel(pendingKey) : "–";
  $("fMidiLabel").textContent = learning === "midi" ? "Note spielen …"
    : pendingMidi !== undefined ? `Note ${pendingMidi} (${noteName(pendingMidi)})` : "–";
}

function openDialog(p: PadConfig): void {
  editing = p;
  dialog.returnValue = ""; // sonst gilt bei Esc der Wert vom letzten Mal (z. B. „Pad leeren“)
  $<HTMLInputElement>("fName").value = p.name;
  $<HTMLInputElement>("fColor").value = p.color;
  $<HTMLInputElement>("fVol").value = String(p.volume);
  showVolume();
  $<HTMLInputElement>("fFadeIn").value = String(p.fadeIn ?? 0);
  $<HTMLInputElement>("fFadeOut").value = String(p.fadeOut ?? 0);
  showFades();
  fillFx(p);
  fillOpTargets(p);
  $("fNoteRow").hidden = !notesUI.visible; // Notizfeld nur bei "Notizen: AN"
  $<HTMLTextAreaElement>("fNote").value = p.note ?? "";
  $<HTMLInputElement>("fLoop").checked = p.loop;
  $<HTMLInputElement>("fFile").value = "";
  pendingKey = p.key; pendingMidi = p.midiNote; learning = null; refreshLearn();
  $("fSound").textContent = p.soundId ? "Audiodatei zugewiesen." : "Noch keine Audiodatei.";
  void fillLibrarySelect(p);
  fillBehavior(p);
  for (const id of ["secBehavior", "secControls", "secCopy", "fNoteRow"]) ($(id) as HTMLDetailsElement).open = false; // Klang klappt nur bei Einstellungen auf
  $("pdSub").textContent = padSubtitle(p.id, banks.find((b) => b.id === bankOf(p.id))?.name);
  refreshView();
  dialog.showModal();
}

dialog.addEventListener("close", async () => {
  const p = editing; editing = null;
  if (!p) return;
  engine.stop("__preview__"); // Probehören beenden
  learning = null;
  const action = dialog.returnValue;
  let conflictMsg = "";
  if (action === "clear") {
    engine.stop(p.id);
    Object.assign(p, { name: "", soundId: null, start: undefined, end: undefined, key: undefined, midiNote: undefined, playMode: undefined, groupId: undefined, stopTargets: undefined, note: undefined, fadeIn: undefined, fadeOut: undefined, eqLow: undefined, eqMid: undefined, eqHigh: undefined, reverb: undefined, reverbSize: undefined });
  } else if (action === "ok") {
    p.name = $<HTMLInputElement>("fName").value.trim();
    p.color = $<HTMLInputElement>("fColor").value;
    p.volume = Number($<HTMLInputElement>("fVol").value);
    engine.setVolume(p.id, p.volume);
    p.loop = $<HTMLInputElement>("fLoop").checked;
    p.fadeIn = normalizeFade(Number($<HTMLInputElement>("fFadeIn").value));
    p.fadeOut = normalizeFade(Number($<HTMLInputElement>("fFadeOut").value));
    const fx = readFx();
    p.eqLow = normalizeEq(fx.low); p.eqMid = normalizeEq(fx.mid); p.eqHigh = normalizeEq(fx.high);
    p.reverb = normalizeReverb(fx.reverb);
    p.reverbSize = p.reverb ? fx.size : undefined;
    engine.setEffects(p.id, fxFromPad(p));
    const pads = makePads(cur(), store);
    const kc = findConflict(pads, p.id, "key", pendingKey), mc = findConflict(pads, p.id, "midiNote", pendingMidi);
    if (kc) conflictMsg += `Taste ${keyLabel(pendingKey!)} ist schon an „${kc.name || "Pad"}“ vergeben und wurde nicht übernommen. `;
    else p.key = pendingKey;
    if (mc) conflictMsg += `MIDI-Note ${pendingMidi} ist schon an „${mc.name || "Pad"}“ vergeben und wurde nicht übernommen.`;
    else p.midiNote = pendingMidi;
    const mv = $<HTMLSelectElement>("fMode").value as PlayMode;
    p.playMode = mv === "parallel" ? undefined : mv; // "parallel" = Standard, wird nicht extra gespeichert
    p.groupId = $<HTMLSelectElement>("fGroup").value || undefined;
    const targets = [...document.querySelectorAll<HTMLInputElement>("#fTargets input:checked")].map((c) => c.value);
    p.stopTargets = targets.length ? targets : undefined;
    if (!$("fNoteRow").hidden) p.note = normalizeNote($<HTMLTextAreaElement>("fNote").value); // bei "Notizen: AUS" bleibt die Notiz unangetastet
    if (mv === "group" && !p.groupId) conflictMsg += " Hinweis: „Gruppe exklusiv“ wirkt erst, wenn eine Wiedergabegruppe gewählt ist.";
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
  } else { engine.setVolume(p.id, p.volume); engine.setEffects(p.id, fxFromPad(p)); render(); return; } // Abbrechen: Lautstärke zurücksetzen
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
  try { // Größenprüfung vor dem Export: zu große Projekte lassen sich später nicht importieren
    const chk = checkExportSize(await listSounds());
    if (chk.level !== "ok" && !confirm(chk.message)) return;
  } catch { /* Prüfung nicht möglich: Export bleibt erlaubt */ }
  const name = prompt("Name des Projekts (wird zum Dateinamen):", projectName)?.trim();
  if (!name) return;
  projectName = name;
  try {
    say("Erzeuge ZIP …");
    const bytes = await exportProject(name, banks, store, notesStore.notes, groups);
    const url = URL.createObjectURL(toBlob(bytes, "application/zip"));
    const a = document.createElement("a");
    a.href = url; a.download = `${name.replace(/[^\w.-]+/g, "_")}.zip`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    try { localStorage.setItem("sampler.lastExport", String(Date.now())); } catch { /* egal */ } // Zeitpunkt: Download gestartet
    renderBackup();
    say(`ZIP erzeugt (${(bytes.length / 1048576).toFixed(1)} MB), Download gestartet. Bitte prüfe, ob die Datei gespeichert wurde.${bytes.length > MAX_ZIP ? " ACHTUNG: Die Datei ist größer als die Importgrenze." : ""}`);
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
      + (r.warnings.length ? `\n${r.warnings.length} Hinweis(e), z. B.: ${r.warnings[0]}` : "")
      + "\n\nDas aktuelle Projekt wird ERSETZT. Tipp: vorher exportieren.";
    if (!confirm(msg)) { say("Import abgebrochen."); return; }
    engine.stopAll();
    await notesStore.flush();
    await importResolved(r); // atomar: bei Fehler bleibt das alte Projekt unverändert
    notesStore.replaceAll(r.notes);
    store.clear(); r.pads.forEach((p) => store.set(p.id, p));
    banks = r.banks; current = 0; groups = r.groups; buffers.clear(); decodedBytes = 0; projectName = parsed.project.name; void preloadBank();
    render();
    say("Projekt importiert." + (r.warnings.length ? ` ${r.warnings.length} Hinweis(e), z. B.: ${r.warnings[0]}.` : ""));
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

/** Lädt die Sounds der aktuellen Bank im Hintergrund vor, damit der erste Tipp ohne Wartezeit spielt. */
async function preloadBank(): Promise<void> {
  const ids = new Set(makePads(cur(), store).map((p) => p.soundId).filter((x): x is string => !!x));
  for (const id of ids) {
    if (buffers.has(id)) continue;
    if (decodedBytes > DECODE_BUDGET) break; // Rest wird erst beim Antippen geladen
    const b = await bufferFor(id);
    if (b) decodedBytes += b.length * b.numberOfChannels * 4;
  }
}
// Nach Standby: Audio bei jeder Berührung/Taste (auch beim Loslassen) wieder aufwecken.
for (const ev of ["touchend", "pointerup", "click", "keydown"]) {
  document.addEventListener(ev, () => {
    engine.gestureResume();
    if (wake.state === "error") wake.refresh();
    setTimeout(() => { if (engine.running && status.textContent?.startsWith("Audio wird")) say(""); }, 400);
  }, { capture: true, passive: true });
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") { engine.gestureResume(); void preloadBank(); }
});
window.addEventListener("pageshow", () => engine.gestureResume());

const MODE_HELP: Record<PlayMode, string> = {
  parallel: "Startet, ohne andere Pads zu stoppen. Mehrere Pads laufen gleichzeitig (Standard).",
  stopSelected: "Stoppt beim Start nur die unten angekreuzten Pads, in allen Bänken. Alle anderen laufen weiter.",
  group: "Stoppt beim Start alle laufenden Pads derselben Wiedergabegruppe. Andere Gruppen laufen weiter.",
  stopOthers: "Vorsicht: Stoppt beim Start ALLE anderen laufenden Pads in allen Bänken.",
};
function updateBehaviorUI(): void {
  const m = $<HTMLSelectElement>("fMode").value as PlayMode;
  $("fModeHelp").textContent = MODE_HELP[m];
  $("fTargetsRow").hidden = m !== "stopSelected";
}
function fillBehavior(p: PadConfig): void {
  $<HTMLSelectElement>("fMode").value = p.playMode ?? "parallel";
  const sel = $<HTMLSelectElement>("fGroup");
  sel.replaceChildren(new Option("– keine Gruppe –", ""), ...groups.map((g) => new Option(g.name, g.id)));
  sel.value = p.groupId ?? "";
  const box = $("fTargets");
  box.replaceChildren();
  const chosen = new Set(p.stopTargets ?? []);
  for (const b of banks) for (const q of makePads(b, store)) {
    if (q.id === p.id || !q.soundId) continue; // nicht das Pad selbst, keine leeren Pads
    const lab = document.createElement("label"); lab.className = "target";
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.value = q.id; cb.checked = chosen.has(q.id);
    lab.append(cb, document.createTextNode(`${b.name} – ${q.name || "(ohne Namen)"}`)); // Text, kein HTML
    box.append(lab);
  }
  if (!box.children.length) box.textContent = "Keine anderen belegten Pads vorhanden.";
  updateBehaviorUI();
}
$("fMode").addEventListener("change", updateBehaviorUI);

const groupDialog = $<HTMLDialogElement>("groupDialog");
async function persistGroups(): Promise<void> {
  try { await saveGroups(groups); } catch { say("Speichern fehlgeschlagen (Speicher voll?)."); }
}
function renderGroups(): void {
  const list = $("groupList");
  list.replaceChildren();
  if (!groups.length) list.textContent = "Noch keine Gruppen.";
  for (const g of groups) {
    const used = [...store.values()].filter((p) => p.groupId === g.id).length;
    const row = document.createElement("div"); row.className = "libRow";
    const name = document.createElement("div"); name.className = "libName";
    const b = document.createElement("b"); b.textContent = g.name;
    const small = document.createElement("small"); small.textContent = `${used} Pad(s)`;
    name.append(b, small);
    const cross = document.createElement("label");
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = g.crossBank;
    cb.addEventListener("change", async () => { g.crossBank = cb.checked; await persistGroups(); });
    cross.append(cb, document.createTextNode(" bankübergreifend"));
    const mk = (label: string, fn: () => Promise<void>) => {
      const btn = document.createElement("button"); btn.type = "button"; btn.className = "tab"; btn.textContent = label;
      btn.addEventListener("click", () => void fn()); return btn;
    };
    row.append(name, cross,
      mk("Umbenennen", async () => {
        const n = prompt("Neuer Name der Gruppe:", g.name)?.trim();
        if (!n || n.length > 60) return;
        g.name = n; await persistGroups(); renderGroups();
      }),
      mk("Löschen", async () => {
        if (!confirm(`Gruppe „${g.name}“ löschen? ${used} Pad(s) verlieren die Zuordnung. Laufende Sounds werden nicht gestoppt.`)) return;
        for (const p of store.values()) if (p.groupId === g.id) { p.groupId = undefined; try { await savePad(p); } catch { say("Speichern fehlgeschlagen."); } }
        groups = groups.filter((x) => x.id !== g.id);
        await persistGroups(); renderGroups();
      }));
    list.append(row);
  }
}
$("pGroups").addEventListener("click", () => { groupDialog.showModal(); renderGroups(); });
$("groupClose").addEventListener("click", () => groupDialog.close());
$("groupAdd").addEventListener("click", async () => {
  const n = prompt("Name der neuen Gruppe (z. B. Intros):")?.trim();
  if (!n) return;
  if (n.length > 60) { say("Der Gruppenname ist zu lang (höchstens 60 Zeichen)."); return; }
  groups.push({ id: uuid(), name: n, crossBank: false });
  await persistGroups(); renderGroups();
});

function showVolume(): void { $("fVolPct").textContent = volumePercent(Number($<HTMLInputElement>("fVol").value)); }
$("fVol").addEventListener("input", () => {
  showVolume();
  engine.setVolume(PREVIEW_ID, Number($<HTMLInputElement>("fVol").value));
  if (editing) engine.setVolume(editing.id, Number($<HTMLInputElement>("fVol").value)); // laufendes Pad hörbar anpassen
});

// ---- Restzeit auf laufenden Pads ----
let progressTimer: number | undefined;
function tickProgress(): void {
  for (const [id, el] of padLive) {
    const pr = engine.progress(id);
    if (!pr) continue;
    if (pr.loop || !Number.isFinite(pr.total) || pr.total <= 0) { el.tm.textContent = "∞ Loop"; el.fill.style.width = "0%"; continue; }
    el.tm.textContent = "−" + formatRemaining(Math.max(0, pr.total - pr.elapsed));
    el.fill.style.width = `${Math.min(100, (pr.elapsed / pr.total) * 100)}%`;
  }
}
function syncProgress(): void { // Zeitgeber läuft nur, solange ein Pad spielt
  if (padLive.size && progressTimer === undefined) progressTimer = window.setInterval(tickProgress, 100);
  else if (!padLive.size && progressTimer !== undefined) { clearInterval(progressTimer); progressTimer = undefined; }
  tickProgress();
}

// ---- Master-Lautstärke ----
function applyMaster(v: number, persist = true): void {
  engine.setMasterVolume(v);
  $("masterPct").textContent = volumePercent(v);
  if (persist) { try { localStorage.setItem("sampler.master", String(v)); } catch { /* egal */ } }
}
$("masterVol").addEventListener("input", () => applyMaster(Number($<HTMLInputElement>("masterVol").value)));

// ---- Bildschirm wach halten ----
const wake = new WakeLockManager(("wakeLock" in navigator ? navigator.wakeLock : undefined) as unknown as WakeApi | undefined);
let wantWake = false;
const WAKE_SUB = { unsupported: "auf diesem Gerät nicht verfügbar", off: "nur im Live-Modus", armed: "wartet auf Live-Modus", on: "Sperre aktiv", error: "abgelehnt, tippen für neuen Versuch" };
const wakeBtn = $<HTMLButtonElement>("wakeBtn");
wake.onChange = () => {
  const st = wake.state;
  $("wakeSub").textContent = WAKE_SUB[st];
  wakeBtn.disabled = st === "unsupported";
  wakeBtn.setAttribute("aria-pressed", String(st === "on" || st === "armed"));
};
wake.onChange();
wakeBtn.addEventListener("click", () => {
  if (wake.state === "error") { wake.refresh(); return; }
  wantWake = !wantWake;
  try { localStorage.setItem("sampler.wake", wantWake ? "on" : "off"); } catch { /* egal */ }
  wake.setEnabled(wantWake);
});
document.addEventListener("visibilitychange", () => wake.setVisible(document.visibilityState === "visible"));

// ---- Uhrzeit und Stoppuhr ----
function loadStopwatch(): StopwatchState {
  try { return parseStopwatch(JSON.parse(localStorage.getItem("sampler.sw") ?? "null")); } catch { return swInitial(); }
}
let stopwatch = loadStopwatch();
const saveStopwatch = () => { try { localStorage.setItem("sampler.sw", JSON.stringify(stopwatch)); } catch { /* egal */ } };
function renderClock(): void {
  const now = Date.now();
  const el = swElapsed(stopwatch, now);
  const running = stopwatch.since !== null;
  $("clock").textContent = formatClock(new Date(now));
  setIconText($("swToggle"), running ? "pause" : "play", formatElapsed(el));
  $("swToggle").setAttribute("aria-label", running ? "Stoppuhr anhalten" : "Stoppuhr starten");
  $<HTMLButtonElement>("swReset").disabled = running || el === 0; // Zurücksetzen nur bei angehaltener Uhr
}
$("swToggle").addEventListener("click", () => {
  stopwatch = stopwatch.since === null ? swStart(stopwatch, Date.now()) : swStop(stopwatch, Date.now());
  saveStopwatch(); renderClock();
});
$("swReset").addEventListener("click", () => { stopwatch = swReset(); saveStopwatch(); renderClock(); });
setInterval(renderClock, 250);
renderClock();

// ---- Ein-/Ausblenden im Pad-Dialog ----
function showFades(): void {
  for (const [inp, out] of [["fFadeIn", "fFadeInOut"], ["fFadeOut", "fFadeOutOut"]]) {
    const v = Number($<HTMLInputElement>(inp).value);
    $(out).textContent = v > 0 ? `${v.toFixed(1).replace(".", ",")} s` : "aus";
  }
}
$("fFadeIn").addEventListener("input", showFades);
$("fFadeOut").addEventListener("input", showFades);

// ---- Pad kopieren / tauschen ----
function fillOpTargets(p: PadConfig): void {
  const sel = $<HTMLSelectElement>("fOpTarget");
  sel.replaceChildren();
  for (const b of banks) makePads(b, store).forEach((q, i) => {
    if (q.id !== p.id) sel.append(new Option(`${b.name} – ${i + 1}${q.name ? ": " + q.name : q.soundId ? "" : " (leer)"}`, q.id));
  });
}
async function padOp(kind: "copy" | "swap"): Promise<void> {
  const p = editing, to = store.get($<HTMLSelectElement>("fOpTarget").value);
  if (!p || !to) { say("Bitte ein Ziel-Pad wählen."); return; }
  if (kind === "copy" && (to.soundId || to.name) && !confirm(`Der Inhalt von „${to.name || "Pad"}“ wird durch „${p.name || "Pad"}“ ersetzt. Fortfahren?`)) return;
  engine.stop(p.id); engine.stop(to.id); // betroffene Pads nicht weiterlaufen lassen
  const changed = kind === "copy" ? copyPad(store, p.id, to.id) : swapPads(store, p.id, to.id);
  dialog.close("cancel"); // ungespeicherte Eingaben im Dialog werden verworfen
  try {
    for (const id of changed) { const q = store.get(id); if (q) await savePad(q); }
    say(kind === "copy" ? "Pad kopiert." : "Pads getauscht.");
  } catch { say("Speichern fehlgeschlagen (Speicher voll?)."); }
  render();
}
$("fCopy").addEventListener("click", () => void padOp("copy"));
$("fSwap").addEventListener("click", () => void padOp("swap"));

// ---- Sicherungserinnerung ----
function renderBackup(): void {
  let last: number | null = null;
  try { last = parseLastExport(localStorage.getItem("sampler.lastExport")); } catch { /* egal */ }
  const hasContent = [...store.values()].some((p) => p.soundId || p.name) || notesStore.notes.length > 0;
  const hint = backupHint(last, Date.now(), hasContent);
  $("backupInfo").textContent = hint ? hint.text : "Noch nichts zu sichern";
  const chip = $("backupChip");
  chip.hidden = !(hint && hint.overdue); // im Kopf nur sichtbar, wenn die Sicherung überfällig ist
  chip.textContent = hint ? `${hint.text}: jetzt exportieren` : "";
}
$("backupChip").addEventListener("click", () => {
  if (!editMode) { say("Zum Exportieren in den Bearbeiten-Modus wechseln (Projekt-Werkzeuge)."); return; }
  $("pExport").click();
});
setInterval(renderBackup, 60_000);

// ---- Menü "Mehr", Helligkeit, Bankfarbe ----
const moreMenu = $<HTMLDialogElement>("moreMenu");
$("moreBtn").addEventListener("click", () => { if (moreMenu.open) moreMenu.close(); else moreMenu.show(); }); // nicht modal: STOP ALL bleibt erreichbar
document.addEventListener("pointerdown", (e) => {
  if (moreMenu.open && !moreMenu.contains(e.target as Node) && !$("moreBtn").contains(e.target as Node)) moreMenu.close();
}, true);
function applyDim(level: string, persist = true): void {
  const alpha = level === "40" ? 0.6 : level === "70" ? 0.3 : 0;
  $("dim").style.background = `rgba(0,0,0,${alpha})`;
  document.querySelectorAll<HTMLButtonElement>("#dimSeg button").forEach((b) => b.classList.toggle("on", b.dataset.dim === level));
  if (persist) { try { localStorage.setItem("sampler.dim", level); } catch { /* egal */ } }
}
document.querySelectorAll<HTMLButtonElement>("#dimSeg button").forEach((b) => b.addEventListener("click", () => applyDim(b.dataset.dim ?? "100")));
$("bColor").addEventListener("change", async (e) => {
  cur().color = (e.target as HTMLInputElement).value;
  await persistBanks(); render();
});

// ---- Klang: EQ und Hall im Pad-Dialog ----
const FX_RANGES = ["fEqLow", "fEqMid", "fEqHigh", "fRev"];
function readFx(): Fx {
  const n = (id: string) => Number($<HTMLInputElement>(id).value);
  return { low: n("fEqLow"), mid: n("fEqMid"), high: n("fEqHigh"), reverb: n("fRev") / 100, size: $<HTMLSelectElement>("fRevSize").value as ReverbSize };
}
function showFx(): void {
  for (const [inp, out] of [["fEqLow", "fEqLowOut"], ["fEqMid", "fEqMidOut"], ["fEqHigh", "fEqHighOut"]]) {
    const v = Number($<HTMLInputElement>(inp).value);
    $(out).textContent = `${v > 0 ? "+" : ""}${v} dB`;
  }
  const r = Number($<HTMLInputElement>("fRev").value);
  $("fRevOut").textContent = r > 0 ? `${r} %` : "aus";
}
function fillFx(p: PadConfig): void {
  const f = fxFromPad(p);
  $<HTMLInputElement>("fEqLow").value = String(f.low);
  $<HTMLInputElement>("fEqMid").value = String(f.mid);
  $<HTMLInputElement>("fEqHigh").value = String(f.high);
  $<HTMLInputElement>("fRev").value = String(Math.round(f.reverb * 100));
  $<HTMLSelectElement>("fRevSize").value = f.size;
  $<HTMLDetailsElement>("fxBox").open = !isFlat(f); // klappt nur auf, wenn das Pad Klang-Einstellungen hat
  showFx();
}
const onFx = () => { showFx(); engine.setEffects(PREVIEW_ID, readFx()); if (editing) engine.setEffects(editing.id, readFx()); }; // laufendes Pad sofort anpassen
for (const id of FX_RANGES) $(id).addEventListener("input", onFx);
$("fRevSize").addEventListener("change", onFx);
$("fFxReset").addEventListener("click", () => { for (const id of FX_RANGES) $<HTMLInputElement>(id).value = "0"; onFx(); });

// ---- Probehören im Klang-Bereich ----
const PREVIEW_ID = "__preview__";
function updatePreviewBtn(): void {
  const on = engine.isPlaying(PREVIEW_ID);
  setIconText($("fFxPreview"), on ? "stop" : "play", on ? "Stopp" : "Probehören");
}
$("fFxPreview").addEventListener("click", async () => {
  if (engine.isPlaying(PREVIEW_ID)) { engine.stop(PREVIEW_ID); return; }
  const p = editing;
  const soundId = $<HTMLSelectElement>("fLibrary").value || p?.soundId; // auch ein in der Bibliothek gewählter Sound
  if (!p || !soundId) {
    say($<HTMLInputElement>("fFile").files?.length ? "Neue Datei zuerst speichern, dann probehören." : "Zuerst eine Audiodatei zuweisen und speichern.");
    return;
  }
  engine.unlock();
  const buf = await bufferFor(soundId);
  if (!buf) { say("Audiodatei fehlt oder ist defekt."); return; }
  const same = soundId === p.soundId; // Schnittpunkte gelten nur für den gespeicherten Sound des Pads
  engine.play(PREVIEW_ID, buf, {
    volume: Number($<HTMLInputElement>("fVol").value), loop: true, // Wiederholen, damit man beim Einstellen weiter hört
    start: same ? p.start : undefined, end: same ? p.end : undefined,
    fx: readFx(), forceChain: true,
  });
});
engine.onChange(updatePreviewBtn);
updatePreviewBtn();

// ---- Pad-Dialog: Vorschau, Palette, Kurzfassungen ----
const PALETTE = ["#2563eb", "#f59e0b", "#15803d", "#0f766e", "#7c3aed", "#be185d", "#facc15", "#475569"];
PALETTE.forEach((c, i) => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "swatch"; b.style.background = c; b.dataset.color = c;
  b.setAttribute("aria-label", `Farbe ${i + 1}`);
  b.addEventListener("click", () => { $<HTMLInputElement>("fColor").value = c; refreshView(); });
  $("fPalette").append(b);
});
function refreshView(): void {
  const color = $<HTMLInputElement>("fColor").value;
  const name = $<HTMLInputElement>("fName").value.trim();
  const note = $<HTMLTextAreaElement>("fNote").value.trim();
  const pv = $("fPreview");
  pv.style.background = color;
  pv.classList.toggle("dk", isLightColor(color));
  pv.replaceChildren(document.createTextNode(name || "(ohne Namen)")); // Text, kein HTML
  const hint = [pendingKey ? `[${keyLabel(pendingKey)}]` : "", pendingMidi !== undefined ? `♪${noteName(pendingMidi)}` : ""].filter(Boolean).join(" ");
  if (hint) { const sm = document.createElement("small"); sm.textContent = hint; pv.append(sm); }
  if (!$("fNoteRow").hidden && note) { const sm = document.createElement("small"); sm.className = "pvNote"; sm.textContent = "✎ " + note; pv.append(sm); }
  $("padTitle").textContent = name || "Pad bearbeiten";
  $("pdSwatch").style.background = color;
  document.querySelectorAll<HTMLButtonElement>("#fPalette .swatch").forEach((b) => b.classList.toggle("on", b.dataset.color === color));
  const sizeSel = $<HTMLSelectElement>("fRevSize"), grp = $<HTMLSelectElement>("fGroup");
  $("sumKlang").textContent = summarizeFx(readFx(), sizeSel.selectedOptions[0]?.text ?? "");
  $("sumBehavior").textContent = summarizeBehavior($<HTMLSelectElement>("fMode").value as PlayMode, grp.value ? grp.selectedOptions[0]?.text : undefined, document.querySelectorAll("#fTargets input:checked").length);
  $("sumControls").textContent = summarizeControls(pendingKey ? keyLabel(pendingKey) : undefined, pendingMidi !== undefined ? noteName(pendingMidi) : undefined);
  $("sumNote").textContent = summarizeNote(note);
}
$("padForm").addEventListener("input", refreshView);
$("padForm").addEventListener("change", refreshView);

$("stopAll").addEventListener("pointerdown", (e) => { e.preventDefault(); engine.stopAll(); });
const modeBtn = $("modeBtn");

function setMode(edit: boolean): void {
  editMode = edit;
  modeBtn.className = edit ? "edit" : "live";
  setIconText(modeBtn, edit ? "pencil" : "lock", edit ? "Bearbeiten" : "Live");
  modeBtn.setAttribute("aria-label", edit ? "Bearbeiten-Modus aktiv. Tippen für Live-Modus." : "Live-Modus aktiv. Tippen zum Bearbeiten.");
  $("bankTools").hidden = !edit;
  $("projectTools").hidden = !edit;
  notesUI.setEditable(edit); // im Live-Modus sind Notizen nur lesbar
  wake.setLive(!edit); // Bildschirm nur im Live-Modus wach halten
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
  if (e.key === "Escape" && moreMenu.open) { moreMenu.close(); return; } // Esc schließt zuerst das Menü
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
  try { groups = await loadGroups(); } catch { say("Gruppen konnten nicht geladen werden."); }
  try { await notesStore.load(); } catch { say("Notizen konnten nicht geladen werden."); }
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
  let m = 1;
  try { const raw = localStorage.getItem("sampler.master"); if (raw !== null && Number.isFinite(Number(raw))) m = Math.min(1, Math.max(0, Number(raw))); } catch { /* egal */ }
  $<HTMLInputElement>("masterVol").value = String(m);
  let dimLevel = "100";
  try { dimLevel = localStorage.getItem("sampler.dim") ?? "100"; } catch { /* egal */ }
  applyDim(["70", "40"].includes(dimLevel) ? dimLevel : "100", false);
  applyMaster(m, false);
  try { wantWake = localStorage.getItem("sampler.wake") === "on"; } catch { /* egal */ }
  wake.setEnabled(wantWake);
  $<HTMLInputElement>("fFile").accept = AUDIO_ACCEPT;
  $<HTMLInputElement>("libFiles").accept = AUDIO_ACCEPT;
  void preloadBank();
  $("midiState").textContent = midiSupported() ? "MIDI aus" : "MIDI nicht verfügbar in diesem Browser";
  if (midiSupported() && [...store.values()].some((p) => p.midiNote !== undefined)) void ensureMidi();
}
void start();
