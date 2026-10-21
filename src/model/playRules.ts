// Wiedergaberegeln: Was wird gestoppt, wenn ein Pad startet? Reine Logik ohne Browser.
export type PlayMode = "parallel" | "stopSelected" | "group" | "stopOthers";
export const PLAY_MODES: PlayMode[] = ["parallel", "stopSelected", "group", "stopOthers"];
export const isPlayMode = (v: unknown): v is PlayMode => typeof v === "string" && (PLAY_MODES as string[]).includes(v);

export interface Group { id: string; name: string; crossBank: boolean }
export interface RulePad { id: string; playMode?: PlayMode; groupId?: string; stopTargets?: string[] }

/** Pad-IDs haben die Form "<bank-id>:<index>". */
export const bankOf = (padId: string): string => padId.slice(0, padId.lastIndexOf(":"));

/**
 * Liefert die IDs der laufenden Pads, die beim Start von `pad` gestoppt werden.
 * Das Pad selbst ist nie enthalten. Fehlt der Modus, gilt "parallel" (altes Verhalten).
 */
export function computeStops(
  pad: RulePad, running: string[], lookup: (id: string) => RulePad | undefined, groups: Group[],
): string[] {
  const others = running.filter((id) => id !== pad.id);
  switch (pad.playMode ?? "parallel") {
    case "stopOthers": return others;
    case "stopSelected": {
      const targets = new Set(pad.stopTargets ?? []);
      return others.filter((id) => targets.has(id));
    }
    case "group": {
      const g = pad.groupId ? groups.find((x) => x.id === pad.groupId) : undefined;
      if (!g) return []; // ohne (gültige) Gruppe nichts zu stoppen
      return others.filter((id) => lookup(id)?.groupId === g.id && (g.crossBank || bankOf(id) === bankOf(pad.id)));
    }
    default: return [];
  }
}
