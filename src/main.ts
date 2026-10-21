import "./styles/theme.css";
import { AudioEngine } from "./audio/AudioEngine";
import {
  deleteBankData, deletePad, getSound, importSound, loadBanks, loadPads, savePad, saveBanks, type PadConfig,
} from "./storage/db";
import { openSampleEditor } from "./ui/SampleEditor";
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

function openDialog(p: PadConfig): void {
  editing = p;
  $<HTMLInputElement>("fName").value = p.name;
  $<HTMLInputElement>("fColor").value = p.color;
  $<HTMLInputElement>("fVol").value = String(p.volume);
  $<HTMLInputElement>("fLoop").checked = p.loop;
  $<HTMLInputElement>("fFile").value = "";
  $("fSound").textContent = p.soundId ? "Audiodatei zugewiesen." : "Noch keine Audiodatei.";
  dialog.showModal();
}

dialog.addEventListener("close", async () => {
  const p = editing; editing = null;
  if (!p) return;
  const action = dialog.returnValue;
  if (action === "clear") {
    engine.stop(p.id);
    Object.assign(p, { name: "", soundId: null, start: undefined, end: undefined });
  } else if (action === "ok") {
    p.name = $<HTMLInputElement>("fName").value.trim();
    p.color = $<HTMLInputElement>("fColor").value;
    p.volume = Number($<HTMLInputElement>("fVol").value);
    p.loop = $<HTMLInputElement>("fLoop").checked;
    const file = $<HTMLInputElement>("fFile").files?.[0];
    if (file) {
      try {
        const data = await file.arrayBuffer();
        await engine.decode(data.slice(0)); // Prüfung: Datei muss dekodierbar sein
        p.soundId = await importSound(file, data);
        p.start = undefined; p.end = undefined; // neuer Sound: alter Schnitt gilt nicht mehr
        if (!p.name) p.name = file.name.replace(/\.[^.]+$/, "");
      } catch {
        say("Diese Datei kann nicht gelesen werden. Bitte WAV oder MP3 verwenden.");
      }
    }
  } else { render(); return; }
  try { await savePad(p); say("Gespeichert."); }
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
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !dialog.open) engine.stopAll(); });
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
}
void start();
