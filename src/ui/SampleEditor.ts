import type { AudioEngine } from "../audio/AudioEngine";
import { computePeaks } from "../audio/waveform";
import { setEnd, setStart, type Region } from "../model/region";

const PREVIEW_ID = "__preview__"; // läuft über die Engine, daher stoppt auch STOP ALL die Vorschau

interface EditorOptions {
  engine: AudioEngine; buffer: AudioBuffer; region: Region; volume: number;
  onApply: (region: Region | null) => void; // null = ganzes Sample
}

export function openSampleEditor(o: EditorOptions): void {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const dlg = $<HTMLDialogElement>("editorDialog"), canvas = $<HTMLCanvasElement>("wave"), info = $("waveInfo");
  const dur = o.buffer.duration;
  let r: Region = { ...o.region };
  let drag: "s" | "e" | null = null;

  dlg.returnValue = "";
  dlg.showModal(); // erst anzeigen, dann Größe messen
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(300, Math.floor(canvas.clientWidth * dpr)), h = Math.max(100, Math.floor(canvas.clientHeight * dpr));
  canvas.width = w; canvas.height = h;
  const channels = Array.from({ length: o.buffer.numberOfChannels }, (_, i) => o.buffer.getChannelData(i));
  const peaks = computePeaks(channels, w);

  function draw(): void {
    const c = canvas.getContext("2d")!;
    const x = (t: number) => (t / dur) * w;
    c.clearRect(0, 0, w, h);
    c.fillStyle = "#3b82f6";
    peaks.forEach((p, i) => { const half = (p * h) / 2; c.fillRect(i, h / 2 - half, 1, Math.max(1, half * 2)); });
    c.fillStyle = "rgba(0,0,0,0.65)";
    c.fillRect(0, 0, x(r.start), h); c.fillRect(x(r.end), 0, w - x(r.end), h);
    c.fillStyle = "#fff";
    c.fillRect(x(r.start) - 2 * dpr, 0, 4 * dpr, h); c.fillRect(x(r.end) - 2 * dpr, 0, 4 * dpr, h);
    info.textContent = `Start ${r.start.toFixed(2)} s · Ende ${r.end.toFixed(2)} s · Länge ${(r.end - r.start).toFixed(2)} s von ${dur.toFixed(2)} s`;
  }
  const timeAt = (e: PointerEvent): number => {
    const b = canvas.getBoundingClientRect();
    return Math.min(dur, Math.max(0, ((e.clientX - b.left) / b.width) * dur));
  };
  const move = (e: PointerEvent) => { const t = timeAt(e); r = drag === "s" ? setStart(r, t) : setEnd(r, t, dur); draw(); };

  // Zuweisung über on...-Eigenschaften: bei erneutem Öffnen entstehen keine doppelten Listener
  canvas.onpointerdown = (e) => {
    const t = timeAt(e);
    drag = Math.abs(t - r.start) <= Math.abs(t - r.end) ? "s" : "e"; // nächste Linie greifen
    canvas.setPointerCapture(e.pointerId); move(e);
  };
  canvas.onpointermove = (e) => { if (drag) move(e); };
  canvas.onpointerup = canvas.onpointercancel = () => { drag = null; };

  const preview = (reg: Region) => o.engine.play(PREVIEW_ID, o.buffer, { volume: o.volume, loop: false, start: reg.start, end: reg.end });
  $("eAll").onclick = () => preview({ start: 0, end: dur });
  $("eSel").onclick = () => preview(r);
  $("eStop").onclick = () => o.engine.stop(PREVIEW_ID);
  $("eReset").onclick = () => { r = { start: 0, end: dur }; draw(); };
  $("eCancel").onclick = () => dlg.close("cancel");
  $("eOk").onclick = () => dlg.close("apply");
  dlg.onclose = () => {
    o.engine.stop(PREVIEW_ID);
    if (dlg.returnValue !== "apply") return; // verwerfen oder Esc: nichts speichern
    const whole = r.start <= 0.001 && r.end >= dur - 0.001;
    o.onApply(whole ? null : r);
  };
  draw();
}
