# Testanleitung Sampler-App

Stand: Oktober 2026 (Funktionsumfang bis Soundbibliothek).

Diese Anleitung trennt klar, was **automatisch geprüft** wird und was **du manuell prüfen musst**. Trage Ergebnisse in die Spalten ein:
✅ geprüft und in Ordnung · ❌ Fehler (bitte melden) · ⬜ noch nicht geprüft

## 1. Automatische Tests

Ausführen im Projektordner (Windows: PowerShell, macOS: Terminal):

```
npm run test
```

| Datei | Prüft |
|---|---|
| `tests/engine.test.ts` | Start, One-Shot-Ende, Loop bis Stopp, STOP ALL (auch Loops), Lautstärke, schnelles Mehrfachantippen ohne Doppelwiedergabe, Schnittpunkte und Loop-Bereich, ungültige Grenzen, Vorschau stoppt mit STOP ALL |
| `tests/banks.test.ts` | Bankwechsel ändert keine Konfiguration, Pad-Anzahl, eindeutige Pad-IDs, Reihenfolge, Übernahme alter Pads |
| `tests/region.test.ts` | Schnittgrenzen (vertauscht, außerhalb, zu kurz), Wellenform-Berechnung |
| `tests/project.test.ts` | Export und Import als Rundlauf, fehlende Audiodateien, beschädigte ZIP, unsichere Pfade, neuere Formatversion, ungültige Werte |
| `tests/mode.test.ts` | Live-Modus öffnet nie Bearbeitungsdialoge, leere Pads inaktiv, Manifest und Icons vorhanden |
| `tests/input.test.ts` | Tastenregeln, Konflikte, MIDI-Nachrichten, Taste und MIDI im Projektformat |
| `tests/library.test.ts` | Größen- und Dauer-Anzeige, Verwendung von Sounds, Dateinamen-Prüfung |

**Letzte gemeldete Ausführung (Windows, von dir):** 50 von 50 bestanden (Stand M6). Für den aktuellen Stand werden **53 Tests** erwartet; dieses Ergebnis steht noch aus: ⬜

**Grenze der automatischen Tests:** Die Audio-Tests laufen mit einer nachgebauten Audio-Schnittstelle. Sie beweisen die Logik, aber **nicht** Klang, Latenz, Stummschalter, Oberfläche oder das Verhalten auf echten Geräten. Das ist Aufgabe der Abschnitte 2 und 3.

### Zuordnung zu den Anforderungen (Abschnitt 16 des Auftrags)

| Anforderung | Automatisch | Manuell |
|---|---|---|
| Leere Pads reagieren nicht | Logik (`mode.test`) | A5 |
| Samples starten, erneutes Antippen stoppt | Engine | A1, A2 |
| One-Shot endet, Loops laufen bis Stopp | Engine | A3, A4 |
| STOP ALL beendet alles | Engine | A6, B3 |
| Lautstärken | Engine | A7 |
| Start- und Endpositionen | Engine, Region | C1–C4 (Hörprobe) |
| Bankwechsel verändert nichts | Banks | B2 |
| Projekt exportieren und importieren | Projekt (ohne Browser) | D1–D3 |
| Fehlende und beschädigte Projekte | Projekt | D4, D5 |
| Live-Modus verhindert Änderungen | Logik | E1–E4 |
| Offline nach Installation | nur Manifest-Datei | F1–F5 |

## 2. Manuelle Tests

Geräte: **Windows** (Chrome oder Edge), **macOS** (Chrome oder Safari), **iPad/iPhone** (Safari und installierte App).
Am PC unter `http://localhost:5173` (`npm run dev`), am iPad über die GitHub-Pages-Adresse.

Vorbereitung: Zwei kurze Sounds (z. B. ein Jingle von 2 s, ein Effekt) und eine längere Datei (mindestens 2 Minuten, MP3 und WAV).

### A Wiedergabe

| Nr. | Schritte | Erwartung | Win | Mac | iPad |
|---|---|---|---|---|---|
| A1 | Bearbeiten-Modus, Pad antippen, Sound zuweisen, Speichern. Live-Modus, Pad antippen | Ton startet, Pad zeigt ▶ und weißen Rand | ✅ | ⬜ | ⬜ |
| A2 | Laufendes Pad erneut antippen | Ton endet sanft (kein Knacken), Anzeige zurückgesetzt | ✅ | ⬜ | ⬜ |
| A3 | One-Shot bis zum Ende laufen lassen | Anzeige springt von selbst zurück | ✅ | ⬜ | ⬜ |
| A4 | Pad mit Loop starten, 30 s warten | Läuft ohne Pause weiter bis zum Stopp | ✅ | ⬜ | ⬜ |
| A5 | Leeres Pad im Live-Modus antippen | Nichts passiert, keine Meldung | ⬜ | ⬜ | ⬜ |
| A6 | Drei Pads (davon ein Loop) starten, STOP ALL | Alles stoppt sofort, nichts läuft unbemerkt weiter (Kopfhörer, 10 s lauschen) | ⬜ | ⬜ | ⬜ |
| A7 | Lautstärke eines Pads auf ca. 30 % stellen | Hörbar leiser als ein Pad mit 90 % | ⬜ | ⬜ | ⬜ |
| A8 | Ein Pad sehr schnell 10-mal antippen | Kein verdoppelter Ton, kein Hängen | ⬜ | ⬜ | ⬜ |
| A9 | Defekte Datei (umbenannte .txt als .mp3) zuweisen | Verständliche Meldung, App läuft weiter | ⬜ | ⬜ | ⬜ |
| A10 | Lange Datei (2 min+) spielen, zwischendurch kurze Effekte | Effekte kommen ohne Verzögerung, kein Ruckeln | ⬜ | ⬜ | ⬜ |

### B Bänke

| Nr. | Schritte | Erwartung | Win | Mac | iPad |
|---|---|---|---|---|---|
| B1 | Bank anlegen, umbenennen, verschieben, löschen | Löschen fragt vorher, Reihenfolge bleibt nach Neuladen (F5) | ⬜ | ⬜ | ⬜ |
| B2 | Loop starten, Bank wechseln | Loop läuft weiter, Tab der ursprünglichen Bank zeigt „●“ | ⬜ | ⬜ | ⬜ |
| B3 | In anderer Bank STOP ALL | Loop aus der ersten Bank stoppt | ⬜ | ⬜ | ⬜ |
| B4 | Spalten- und Pad-Anzahl ändern, F5 | Einstellung bleibt, Pads in ausgeblendeten Positionen behalten ihre Einstellungen bei erneuter Erhöhung | ⬜ | ⬜ | ⬜ |

### C Schnitt (Sample-Editor)

| Nr. | Schritte | Erwartung | Win | Mac | iPad |
|---|---|---|---|---|---|
| C1 | Sprach-Sample: Pad-Dialog, „Wellenform / Schnitt“, Linien ziehen, „Ausschnitt hören“ | Genau der gewählte Bereich ist zu hören | ⬜ | ⬜ | ⬜ |
| C2 | „Übernehmen“, F5, Pad im Live-Modus starten | Nur der Ausschnitt spielt | ⬜ | ⬜ | ⬜ |
| C3 | Loop mit Ausschnitt | Nur der Bereich wiederholt sich | ⬜ | ⬜ | ⬜ |
| C4 | Linien über Kreuz oder aus dem Bild ziehen; „Verwerfen“ | Linien können sich nicht kreuzen; Verwerfen ändert nichts | ⬜ | ⬜ | ⬜ |
| C5 | Editor mit Finger bedienen | Linien lassen sich greifen und ziehen | – | – | ⬜ |

### D Projekt

| Nr. | Schritte | Erwartung | Win | Mac | iPad |
|---|---|---|---|---|---|
| D1 | „Projekt exportieren“, ZIP mit Entpackprogramm öffnen | `project.json` und Ordner `audio` vorhanden | ⬜ | ⬜ | ⬜ |
| D2 | Etwas ändern (Bank löschen), ZIP importieren | Alter Stand mit Sounds, Schnitten, Loops, Tasten ist zurück | ⬜ | ⬜ | ⬜ |
| D3 | ZIP auf ein anderes Gerät übertragen und dort importieren | Projekt läuft auch dort | ⬜ | ⬜ | ⬜ |
| D4 | Kaputte Datei (umbenannte .txt als .zip) importieren | Verständliche Meldung, Projekt unverändert | ⬜ | ⬜ | ⬜ |
| D5 | ZIP mit entferntem Audio-Ordner importieren | Import klappt, Pads ohne Audio sind leer, Meldung nennt die Anzahl | ⬜ | ⬜ | ⬜ |

### E Live-Modus

| Nr. | Schritte | Erwartung | Win | Mac | iPad |
|---|---|---|---|---|---|
| E1 | Live-Modus aktiv, Pad antippen | Nie ein Bearbeitungsdialog, Pad spielt oder stoppt | ⬜ | ⬜ | ⬜ |
| E2 | Im Live-Modus: Werkzeuge der Bänke und Projekte sichtbar? | Nicht sichtbar | ⬜ | ⬜ | ⬜ |
| E3 | Button „LIVE – tippen zum Bearbeiten“ antippen | Rückfrage; „Im Live-Modus bleiben“ ist vorgewählt; Esc bricht ab; „Bearbeiten“ entsperrt | ⬜ | ⬜ | ⬜ |
| E4 | Live-Modus, F5 | Bleibt im Live-Modus | ⬜ | ⬜ | ⬜ |
| E5 | Live-Modus, Audiodatei ins Fenster ziehen | Wird nicht geöffnet, Hinweis zum Bearbeiten-Modus | ⬜ | ⬜ | – |

### F Offline und Installation (nur über die https-Adresse)

| Nr. | Schritte | Erwartung | Win | Mac | iPad |
|---|---|---|---|---|---|
| F1 | Seite mit Internet öffnen | Oben „✓ Offline bereit (… Dateien)“ | ⬜ | ⬜ | ✅ |
| F2 | Installieren (Chrome/Edge: Installieren-Symbol in der Adressleiste; iPad: Teilen → Zum Home-Bildschirm) | App startet im eigenen Fenster | ⬜ | ⬜ | ✅ |
| F3 | Installierte App **mit Internet** einmal starten, Sounds importieren | Sounds vorhanden | ⬜ | ⬜ | ✅ |
| F4 | Internet aus (Flugmodus), App komplett schließen, neu öffnen | Oberfläche und Sounds sind da, Pads spielen | ⬜ | ⬜ | ✅ |
| F5 | Offline: Projekt exportieren und importieren | Beides funktioniert | ⬜ | ⬜ | ⬜ |
| F6 | Nach einem Update auf GitHub: App mit Internet öffnen, ggf. zweimal | Neue Version erscheint | ⬜ | ⬜ | ⬜ |

(Hinweis zur Quelle der ✅ bei iPad: Du hast gemeldet, dass der Offline-Betrieb am Handy einwandfrei läuft. Welche Teile F1–F4 genau geprüft wurden, ist nicht einzeln erfasst; bitte bei Gelegenheit bestätigen. Der iPad-Speicher der installierten App ist vom Safari-Tab getrennt.)

### G Soundbibliothek

| Nr. | Schritte | Erwartung | Win | Mac | iPad |
|---|---|---|---|---|---|
| G1 | Bibliothek öffnen | Sounds mit Größe, Dauer, Verwendung | ⬜ | ⬜ | ⬜ |
| G2 | Mehrere Dateien importieren, per Drag-and-drop und per Dialog | Alle erscheinen; Drag-and-drop nur am PC | ⬜ | ⬜ | – |
| G3 | Zwei Pads mit demselben Sound belegen (Auswahl im Pad-Dialog) | Beide spielen, Bibliothek zeigt „2 Pads“ | ⬜ | ⬜ | ⬜ |
| G4 | Verwendeten Sound löschen | Rückfrage nennt Anzahl, Pads sind danach leer | ⬜ | ⬜ | ⬜ |
| G5 | Sound umbenennen, F5 | Name bleibt | ⬜ | ⬜ | ⬜ |
| G6 | Dieselbe Datei zweimal importieren | Nur ein Eintrag in der Bibliothek | ⬜ | ⬜ | ⬜ |

### H Tastatur und MIDI

| Nr. | Schritte | Erwartung | Win | Mac | iPad |
|---|---|---|---|---|---|
| H1 | Pad-Dialog: „Taste wählen“ (z. B. Q), Live-Modus, Q drücken | Pad startet, erneutes Drücken stoppt | ⬜ | ⬜ | ⬜ (nur mit Tastatur) |
| H2 | Dieselbe Taste einem zweiten Pad derselben Bank geben | Meldung, Taste wird nicht doppelt vergeben | ⬜ | ⬜ | ⬜ |
| H3 | Esc im Live-Modus | STOP ALL | ⬜ | ⬜ | ⬜ |
| H4 | MIDI-Controller anschließen, „MIDI lernen“ (Chrome/Edge) | Note wird erkannt, Pad lässt sich damit starten | ⬜ | – | nicht möglich |
| H5 | Safari oder iPad: Anzeige oben | „MIDI nicht verfügbar in diesem Browser“ | – | ⬜ | ⬜ |

### I Dauerbetrieb und Latenz (nur durch Hören und Ausprobieren)

Es gibt **keine gemessene Latenz**. Die App verspricht daher keine Broadcast-Latenz. Beurteile subjektiv:

| Nr. | Schritte | Erwartung | Win | Mac | iPad |
|---|---|---|---|---|---|
| I1 | Pad antippen, auf Verzögerung achten (mit Kopfhörer, dann mit Lautsprecher/Bluetooth) | Ton kommt spürbar sofort; Bluetooth ist durch das Gerät oft deutlich träger | ⬜ | ⬜ | ⬜ |
| I2 | 1 Stunde App laufen lassen, in der Zeit mehrfach Pads und Loops | Kein Aufhängen, keine Aussetzer, Speicher steigt nicht spürbar | ⬜ | ⬜ | ⬜ |
| I3 | iPad: Stummschalter, anderer App-Wechsel, Anruf/Siri und zurück | Ton kommt nach der Rückkehr wieder (ggf. ein Tipp nötig) | – | – | ⬜ |
| I4 | iPad: Bildschirm sperren und entsperren | App reagiert weiter | – | – | ⬜ |

## 3. Fehler erkennen und melden

Schick mir bei jedem Fehler:

1. **Was du getan hast** (Nummer aus der Tabelle, z. B. „C2“).
2. **Was passiert ist** und was du erwartet hast.
3. **Gerät, Browser und Version** (z. B. „iPad, Safari, iPadOS …“).
4. **Die Meldung in der Statuszeile** oben und ein Bildschirmfoto.
5. Am PC zusätzlich: Taste **F12**, Reiter **Konsole**, rote Meldungen kopieren. Am iPad geht das nur über einen Mac (Safari, Menü „Entwickler“); sonst reicht das Bildschirmfoto.

Bei Problemen mit dem Aufbau auf GitHub: Reiter **Actions**, roten Lauf anklicken, Fehlermeldung kopieren.

## 4. Nicht getestet und nicht versprochen

- **Latenz und Aussetzer** unter Last sind nicht gemessen.
- **Sehr große Projekte** (mehrere hundert MB) sind nicht erprobt, besonders nicht am iPad.
- **MIDI** ist nur mit echtem Controller in Chrome oder Edge möglich und bisher nicht mit Hardware geprüft.
- **Speicherlöschung durch Safari:** Safari kann Webseitendaten löschen. Regelmäßige ZIP-Exporte sind deine Sicherung.
- **Sicherheit:** Der Live-Modus-Schutz verhindert Fehlbedienung, ist aber keine Zugriffskontrolle.
