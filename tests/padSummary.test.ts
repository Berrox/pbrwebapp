import { describe, expect, it } from "vitest";
import { padSubtitle, summarizeBehavior, summarizeControls, summarizeFx, summarizeNote } from "../src/model/padSummary";

describe("Kurzfassungen im Pad-Dialog", () => {
  it("Klang: aus und an", () => {
    expect(summarizeFx({ low: 0, mid: 0, high: 0, reverb: 0, size: "room" }, "Raum")).toBe("EQ aus · Hall aus");
    expect(summarizeFx({ low: 3, mid: 0, high: -2, reverb: 0.3, size: "church" }, "Kirche")).toBe("EQ +3/0/-2 dB · Hall 30 % Kirche");
  });
  it("Verhalten: Modus, Anzahl der Stop-Ziele und Gruppe", () => {
    expect(summarizeBehavior("parallel", undefined, 0)).toBe("Parallel");
    expect(summarizeBehavior("stopSelected", undefined, 2)).toBe("Ausgewählte stoppen (2)");
    expect(summarizeBehavior("group", "Intros", 0)).toBe("Gruppe exklusiv · Gruppe „Intros“");
  });
  it("Steuerung: Taste und MIDI", () => {
    expect(summarizeControls(undefined, undefined)).toBe("Taste – · MIDI aus");
    expect(summarizeControls("Q", "C4")).toBe("Taste Q · MIDI C4");
  });
  it("Notiz: leer, kurz und gekürzt", () => {
    expect(summarizeNote("  ")).toBe("leer");
    expect(summarizeNote("Nur mit Pad 3")).toBe("Nur mit Pad 3");
    expect(summarizeNote("x".repeat(60))).toBe("x".repeat(40) + "…");
  });
  it("Untertitel aus der Pad-ID", () => {
    expect(padSubtitle("bank-1:2", "Intros")).toBe("Pad 3 · Bank „Intros“");
    expect(padSubtitle("bank-1:0", undefined)).toBe("Pad 1");
  });
});
