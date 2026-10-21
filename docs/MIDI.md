# MIDI und Tastatur: Stand und Grenzen

## Tastatur
- Pro Pad eine Taste (Buchstaben, Ziffern, Ziffernblock). Gespeichert wird der Tastencode, daher unabhängig vom Layout.
- Wirkt nur im Live-Modus und nur für die aktuell gewählte Bank. Esc ist immer STOP ALL.
- Doppelt belegte Tasten innerhalb einer Bank werden abgelehnt.
- Am iPad nur mit angeschlossener Tastatur nutzbar.

## MIDI (Stand der Recherche, Oktober 2026, Quelle: caniuse.com/webmidi)
| Umgebung | Web MIDI |
|---|---|
| Chrome, Edge, Opera, Firefox (PC/Mac), Chrome auf Android | ja |
| Safari am Mac | nein (nur über eine Drittanbieter-Erweiterung, ungetestet) |
| Safari auf iPhone/iPad | nein |

- Umgesetzt: "Note an" startet/stoppt das Pad (wie Antippen, nur im Live-Modus, aktuelle Bank), MIDI-Lernen im Pad-Dialog, beliebiger Kanal.
- Nicht umgesetzt: Kanal-Filter, Controller (Regler), Note-aus-Verhalten, MIDI-Ausgabe.
- Am iPad ist MIDI im Browser nicht möglich. Eine native App oder ein Desktop-Paket (Electron/Tauri) könnte es auf dem Desktop ergänzen.
