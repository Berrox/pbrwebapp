// MIDI über Web MIDI. Verfügbar nur in Browsern, die es anbieten (Chrome, Edge, Firefox, Opera).
// Safari (Mac und iPad/iPhone) unterstützt es nicht.
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const noteName = (n: number): string => `${NAMES[n % 12]}${Math.floor(n / 12) - 1}`;

/** Liefert die Notennummer bei "Note an" (beliebiger Kanal, Anschlagstärke > 0), sonst null. */
export function parseNoteOn(data: ArrayLike<number>): number | null {
  if (data.length < 3) return null;
  return (data[0] & 0xf0) === 0x90 && data[2] > 0 ? data[1] : null;
}
export const midiSupported = (): boolean =>
  typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function";

export async function startMidi(onNoteOn: (note: number) => void): Promise<{ ok: boolean; text: string }> {
  if (!midiSupported()) return { ok: false, text: "MIDI nicht verfügbar in diesem Browser" };
  try {
    const access = await navigator.requestMIDIAccess({ sysex: false });
    const attach = () => access.inputs.forEach((input) => {
      input.onmidimessage = (e) => {
        const n = e.data ? parseNoteOn(e.data) : null;
        if (n !== null) onNoteOn(n);
      };
    });
    attach();
    access.onstatechange = attach; // später angeschlossene Geräte
    return { ok: true, text: `MIDI aktiv (${access.inputs.size} Eingänge)` };
  } catch {
    return { ok: false, text: "MIDI-Zugriff verweigert oder fehlgeschlagen" };
  }
}
