// Kurzfassungen für den Pad-Dialog (zugeklappte Bereiche). Reine Logik, ohne Browser.
import type { Fx } from "./fx";
import type { PlayMode } from "./playRules";
import { KIND_SHORT, activeKinds, type EffectProfile, type EffectsSettings, type FxMode } from "./effects";

const sign = (v: number): string => `${v > 0 ? "+" : ""}${v}`;
const MODE_NAME: Record<PlayMode, string> = {
  parallel: "Parallel", stopSelected: "Ausgewählte stoppen", group: "Gruppe exklusiv", stopOthers: "Alle anderen stoppen",
};

export function summarizeFx(fx: Fx, sizeName: string): string {
  const eq = fx.low === 0 && fx.mid === 0 && fx.high === 0 ? "EQ aus" : `EQ ${sign(fx.low)}/${sign(fx.mid)}/${sign(fx.high)} dB`;
  const rev = fx.reverb > 0 ? `Hall ${Math.round(fx.reverb * 100)} % ${sizeName}` : "Hall aus";
  return `${eq} · ${rev}`;
}
export function summarizeBehavior(mode: PlayMode, groupName: string | undefined, targets: number): string {
  return MODE_NAME[mode] + (mode === "stopSelected" ? ` (${targets})` : "") + (groupName ? ` · Gruppe „${groupName}“` : "");
}
export function summarizeControls(key: string | undefined, midi: string | undefined): string {
  return `${key ? "Taste " + key : "Taste –"} · ${midi ? "MIDI " + midi : "MIDI aus"}`;
}
export function summarizeNote(note: string): string {
  const t = note.trim();
  return t ? (t.length > 40 ? t.slice(0, 40) + "…" : t) : "leer";
}
/** "Pad 3 · Bank „Intros“" aus der Pad-ID (<bank-id>:<index>). */
export function padSubtitle(padId: string, bankName: string | undefined): string {
  const n = Number(padId.slice(padId.lastIndexOf(":") + 1)) + 1;
  const pad = Number.isFinite(n) ? `Pad ${n}` : "Pad";
  return bankName ? `${pad} · Bank „${bankName}“` : pad;
}

const activeNames = (p: EffectProfile): string => activeKinds(p).map((k) => KIND_SHORT[k]).join(" + ");
/** Kurzfassung der Soundeffekte & Filter eines Pads, z. B. "Global (aus): Tape". */
export function summarizeEffects(mode: FxMode, own: EffectProfile, global: EffectsSettings): string {
  if (mode === "off") return "Keine (Original)";
  if (mode === "own") return `Eigene: ${activeNames(own) || "nichts aktiv"}`;
  return `Global${global.enabled ? "" : " (aus)"}: ${activeNames(global.profile) || "nichts aktiv"}`;
}
