// Bildschirm wach halten (Screen Wake Lock). Nur aktiv, wenn eingeschaltet, im Live-Modus und die Seite sichtbar ist.
export interface Sentinel { release(): Promise<void>; addEventListener(type: "release", cb: () => void): void }
export interface WakeApi { request(type: "screen"): Promise<Sentinel> }
export type WakeState = "unsupported" | "off" | "armed" | "on" | "error";

export class WakeLockManager {
  onChange: () => void = () => {};
  private sentinel: Sentinel | null = null;
  private enabled = false;
  private live = false;
  private visible = true;
  private failed = false;
  private busy = false;
  private again = false;

  constructor(private api: WakeApi | undefined) {}

  /** off: aus · armed: an, wartet auf Live-Modus/Sichtbarkeit · on: Sperre aktiv · error: Anfrage abgelehnt */
  get state(): WakeState {
    if (!this.api) return "unsupported";
    if (!this.enabled) return "off";
    if (this.sentinel) return "on";
    if (this.failed) return "error";
    return "armed";
  }
  setEnabled(b: boolean): void { this.enabled = b; this.failed = false; void this.update(); }
  setLive(b: boolean): void { this.live = b; void this.update(); }
  setVisible(b: boolean): void { this.visible = b; void this.update(); }
  /** Neuer Versuch nach einem Fehler (z. B. bei der nächsten Berührung). */
  refresh(): void { this.failed = false; void this.update(); }

  private async update(): Promise<void> {
    if (!this.api) return;
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    try {
      do {
        this.again = false;
        const need = this.enabled && this.live && this.visible;
        if (need && !this.sentinel && !this.failed) {
          try {
            const s = await this.api.request("screen");
            s.addEventListener("release", () => { if (this.sentinel === s) { this.sentinel = null; this.onChange(); } });
            this.sentinel = s;
          } catch { this.failed = true; }
        } else if (!need && this.sentinel) {
          const s = this.sentinel;
          this.sentinel = null;
          try { await s.release(); } catch { /* egal */ }
        }
        this.onChange();
      } while (this.again);
    } finally { this.busy = false; }
  }
}
