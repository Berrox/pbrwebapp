import { describe, expect, it } from "vitest";
import { WakeLockManager, type Sentinel, type WakeApi } from "../src/input/wakelock";

const tick = () => new Promise((r) => setTimeout(r, 0));
function fakeApi(opts: { fail?: boolean } = {}) {
  const api = {
    fail: opts.fail ?? false, requests: 0, released: 0,
    async request(): Promise<Sentinel> {
      api.requests++;
      if (api.fail) throw new Error("abgelehnt");
      return { async release() { api.released++; }, addEventListener() {} };
    },
  };
  return api satisfies WakeApi & object;
}

describe("Bildschirm wach halten", () => {
  it("meldet fehlende Unterstützung", () => {
    expect(new WakeLockManager(undefined).state).toBe("unsupported");
  });
  it("angeschaltet, aber nicht im Live-Modus: wartet, fordert nichts an", async () => {
    const api = fakeApi(), w = new WakeLockManager(api);
    w.setEnabled(true); await tick();
    expect(w.state).toBe("armed");
    expect(api.requests).toBe(0);
  });
  it("im Live-Modus wird die Sperre angefordert, beim Verlassen freigegeben", async () => {
    const api = fakeApi(), w = new WakeLockManager(api);
    w.setEnabled(true); w.setLive(true); await tick();
    expect(w.state).toBe("on");
    expect(api.requests).toBe(1);
    w.setLive(false); await tick();
    expect(api.released).toBe(1);
    expect(w.state).toBe("armed");
  });
  it("Ausschalten gibt die Sperre frei", async () => {
    const api = fakeApi(), w = new WakeLockManager(api);
    w.setEnabled(true); w.setLive(true); await tick();
    w.setEnabled(false); await tick();
    expect(api.released).toBe(1);
    expect(w.state).toBe("off");
  });
  it("Seite im Hintergrund: freigeben, bei Rückkehr neu anfordern", async () => {
    const api = fakeApi(), w = new WakeLockManager(api);
    w.setEnabled(true); w.setLive(true); await tick();
    w.setVisible(false); await tick();
    expect(w.state).toBe("armed");
    w.setVisible(true); await tick();
    expect(api.requests).toBe(2);
    expect(w.state).toBe("on");
  });
  it("abgelehnte Anfrage zeigt Fehler, ein erneuter Versuch kann gelingen", async () => {
    const api = fakeApi({ fail: true }), w = new WakeLockManager(api);
    w.setEnabled(true); w.setLive(true); await tick();
    expect(w.state).toBe("error");
    api.fail = false;
    w.refresh(); await tick();
    expect(w.state).toBe("on");
  });
  it("schnelles Hin- und Herschalten erzeugt keine doppelte Sperre", async () => {
    const api = fakeApi(), w = new WakeLockManager(api);
    w.setEnabled(true);
    for (let i = 0; i < 6; i++) w.setLive(i % 2 === 0);
    await tick(); await tick();
    expect(api.requests - api.released).toBe(w.state === "on" ? 1 : 0);
  });
});
