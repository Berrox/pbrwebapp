// Sicherungserinnerung und Größenprüfung vor dem Export. Reine Logik, ohne Browser.
import { MAX_FILE, MAX_ZIP } from "./projectFormat";

export const BACKUP_REMINDER_DAYS = 14;
export const SOFT_LIMIT = 150 * 1024 * 1024; // ab hier Warnung wegen Arbeitsspeicher (vor allem iPad)
export const MAX_SOUNDS = 2000;
const DAY = 86_400_000;

export function formatAgo(ms: number): string {
  const min = Math.floor(Math.max(0, ms) / 60_000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  return d === 1 ? "vor 1 Tag" : `vor ${d} Tagen`;
}

export interface BackupHint { text: string; overdue: boolean }
/** Hinweis zum letzten Export. null = nichts zu sichern und nie exportiert. Ab 14 Tagen (oder nie) gilt er als überfällig. */
export function backupHint(lastExport: number | null, now: number, hasContent: boolean): BackupHint | null {
  if (lastExport === null) return hasContent ? { text: "Noch nie exportiert", overdue: true } : null;
  const age = Math.max(0, now - lastExport);
  return { text: `Letzter Export ${formatAgo(age)}`, overdue: age >= BACKUP_REMINDER_DAYS * DAY };
}
export function parseLastExport(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface SizeCheck { level: "ok" | "large" | "toolarge"; totalBytes: number; message: string }
/** Prüft vor dem Export, ob das Projekt zu groß für den Import oder für den Arbeitsspeicher werden könnte. */
export function checkExportSize(sounds: { name: string; size: number }[]): SizeCheck {
  const total = sounds.reduce((a, s) => a + s.size, 0);
  const biggest = sounds.reduce((m, s) => (s.size > m.size ? s : m), { name: "", size: 0 });
  const mb = (b: number) => Math.round(b / 1048576);
  const problems: string[] = [];
  if (total > MAX_ZIP) problems.push(`Die Audiodaten ergeben ${mb(total)} MB, die Importgrenze liegt bei ${mb(MAX_ZIP)} MB.`);
  if (biggest.size > MAX_FILE) problems.push(`„${biggest.name}“ ist ${mb(biggest.size)} MB groß, einzelne Dateien dürfen beim Import höchstens ${mb(MAX_FILE)} MB haben.`);
  if (sounds.length > MAX_SOUNDS) problems.push(`Mehr als ${MAX_SOUNDS} Sounds (${sounds.length}) lassen sich nicht importieren.`);
  if (problems.length) {
    return { level: "toolarge", totalBytes: total, message: problems.join("\n") + "\n\nDer Export wäre später NICHT wieder importierbar. Trotzdem exportieren?" };
  }
  if (total > SOFT_LIMIT) {
    return { level: "large", totalBytes: total, message: `Das Projekt ist groß (${mb(total)} MB). Export und Import brauchen viel Arbeitsspeicher und können vor allem auf dem iPad scheitern. Trotzdem exportieren?` };
  }
  return { level: "ok", totalBytes: total, message: "" };
}
