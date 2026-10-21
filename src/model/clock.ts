// Uhrzeit, Stoppuhr und Restzeit-Anzeige. Reine Logik, ohne Browser.
const pad2 = (n: number): string => String(n).padStart(2, "0");

export const formatClock = (d: Date): string => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

/** Restzeit eines Pads: unter 10 s mit Zehntel ("9,4 s"), sonst "m:ss" (aufgerundet). */
export function formatRemaining(sec: number): string {
  const s = Math.max(0, sec);
  if (s < 10) return `${s.toFixed(1).replace(".", ",")} s`;
  const t = Math.ceil(s);
  return `${Math.floor(t / 60)}:${pad2(t % 60)}`;
}
export function formatElapsed(ms: number): string {
  const t = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

/** Stoppuhr auf Basis von Zeitstempeln (überlebt Neuladen, driftet nicht bei gedrosselten Timern). */
export interface StopwatchState { accMs: number; since: number | null }
export const swInitial = (): StopwatchState => ({ accMs: 0, since: null });
export const swReset = swInitial;
export const swStart = (s: StopwatchState, now: number): StopwatchState => (s.since === null ? { ...s, since: now } : s);
export const swStop = (s: StopwatchState, now: number): StopwatchState =>
  s.since === null ? s : { accMs: s.accMs + Math.max(0, now - s.since), since: null };
export const swElapsed = (s: StopwatchState, now: number): number => s.accMs + (s.since === null ? 0 : Math.max(0, now - s.since));

/** Liest einen gespeicherten Zustand und verwirft Ungültiges. */
export function parseStopwatch(raw: unknown): StopwatchState {
  if (typeof raw !== "object" || raw === null) return swInitial();
  const r = raw as Record<string, unknown>;
  const acc = r.accMs, since = r.since;
  if (typeof acc !== "number" || !Number.isFinite(acc) || acc < 0) return swInitial();
  if (since !== null && (typeof since !== "number" || !Number.isFinite(since))) return swInitial();
  return { accMs: acc, since };
}
