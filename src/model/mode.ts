// Betriebsmodi. Reine Logik: Was passiert beim Antippen eines Pads?
export type Mode = "edit" | "live";
export type PadAction = "edit" | "play" | "stop" | "ignore";

export function padAction(mode: Mode, hasSound: boolean, playing: boolean): PadAction {
  if (mode === "edit") return "edit";
  if (!hasSound) return "ignore"; // leere Pads: keine Reaktion
  return playing ? "stop" : "play"; // im Live-Modus öffnet sich nie ein Bearbeitungsdialog
}
