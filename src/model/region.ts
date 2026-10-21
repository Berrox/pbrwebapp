// Schnittbereich eines Samples in Sekunden. Reine Logik, ohne Browser.
export interface Region { start: number; end: number }
export const MIN_REGION = 0.02; // kürzester erlaubter Ausschnitt in Sekunden

/** Macht aus beliebigen Werten einen gültigen Bereich innerhalb der Datei. */
export function clampRegion(start: number | undefined, end: number | undefined, duration: number): Region {
  const d = Math.max(0, duration);
  let s = typeof start === "number" && Number.isFinite(start) ? start : 0;
  let e = typeof end === "number" && Number.isFinite(end) ? end : d;
  s = Math.min(Math.max(0, s), d);
  e = Math.min(Math.max(0, e), d);
  if (s > e) [s, e] = [e, s]; // vertauscht: tauschen
  if (e - s < MIN_REGION) { e = Math.min(d, s + MIN_REGION); s = Math.max(0, e - MIN_REGION); }
  return { start: s, end: e };
}
/** Startlinie verschieben: nicht hinter das Ende, nicht vor 0. */
export function setStart(r: Region, t: number): Region {
  return { start: Math.max(0, Math.min(t, r.end - MIN_REGION)), end: r.end };
}
/** Endlinie verschieben: nicht vor den Start, nicht hinter das Dateiende. */
export function setEnd(r: Region, t: number, duration: number): Region {
  return { start: r.start, end: Math.min(duration, Math.max(t, r.start + MIN_REGION)) };
}
