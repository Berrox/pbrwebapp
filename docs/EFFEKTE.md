# Soundeffekte & Filter

## Wo finde ich was?
- **Global:** Menü „Mehr“ (⋯): Schalter **Globale Effekte** (schnell an/aus, auch im Live-Modus) und **Soundeffekte & Filter → Öffnen** (nur im Bearbeiten-Modus).
- **Pro Pad:** Pad-Dialog, aufklappbare Zeile **Effekte**. Auswahl: *Keine Effekte (Original)* (Standard), *Globale Effekte übernehmen*, *Eigene Effekte*.
- Hall und EQ gibt es weiterhin im Bereich **Klang** des Pad-Dialogs.

## Die acht Effekte
Jeder Effekt hat eine Karte mit Ein/Aus-Schalter, Preset, Reglern mit Prozentanzeige, „Erweiterte Einstellungen“ (wo vorhanden) und **Zurücksetzen**. Die Regler erscheinen nach dem Einschalten. Ändert man einen Regler, steht das Preset auf „Eigene Einstellung“. Die **Intensität** (bei Mischeffekten „Anteil“) skaliert den Effekt.

| Effekt | Regler (erweitert kursiv) | Presets |
|---|---|---|
| **Kassetten-Tape** | Intensität, Höhenverlust, Rauschen, Wow & Flutter, *Sättigung*, *Knackser* | Saubere Kassette, Alte Kassette, Stark abgenutztes Tape |
| **Vinyl / Schallplatte** | Intensität, Vinyl-Rauschen, Knistern und Knackser, Höhenverlust, *Tonhöhenschwankung* (33 U/min) | Saubere Schallplatte, Alte Schallplatte, Starkes Vinyl-Knistern |
| **Radio- und Telefonfilter** | Intensität, Tiefen abschneiden, Höhen abschneiden, *Mittenbetonung*, *Mono* | Altes Radio, Telefon, Kleines Küchenradio |
| **Tiefpass / Hochpass** | Intensität, Höhen abschneiden (bis 200 Hz), Tiefen abschneiden (bis 2 kHz) | Dumpf, Dünn, Bandpass |
| **Verzerrung** | Anteil, Stärke, *Klang dunkel bis hell* | Warm, Crunch, Fuzz |
| **Chorus** | Anteil, Geschwindigkeit, Tiefe | Dezent, Breit, Seekrank |
| **Lo-Fi / Bitcrusher** | Anteil, Körnung (Bit-Tiefe 12 bis 3), *Höhenverlust* | Leicht, Knusprig, Extrem |
| **Echo / Delay** | Anteil, Abstand (60 bis 900 ms), Wiederholungen | Slapback, Klassisches Echo, Dub-Echo |

Reihenfolge der Kette: Tape, Vinyl, Radio, Filter, Verzerrung, Chorus, Lo-Fi, Echo. Die Tabellen- und Kartenreihenfolge ist dieselbe.

## Verhalten
- Pad-Lautstärke und Fades, **dann Soundeffekte**, dann EQ und Hall, dann Master. Pads ohne Effekte bekommen **keine zusätzlichen Audio-Knoten** und klingen wie bisher.
- **Gebaut werden nur eingeschaltete Effekte** (CPU). Schaltest du bei laufendem Pad einen weiteren Effekt ein, wird die Kette einmal neu aufgebaut (dabei kann es kurz knacken). Vorhandene Effekte lassen sich beliebig oft ein- und ausschalten, ohne Umbau. Die **A/B-Vorschau** baut alle Effekte vor, dort knackt nichts.
- **Rauschen, Knistern und Tonhöhenschwankungen** gehören zur Wiedergabe: Sie starten mit dem Pad, folgen Lautstärke und Ausblenden und enden mit dem Pad (Stopp, Ende, STOP ALL). Es gibt keinen Dauer-Rauschgenerator.
- **Echo:** Nach dem Ende eines Pads klingt es noch kurz aus (höchstens 6 Sekunden), **STOP ALL beendet es sofort**.
- Änderungen an Reglern, Presets und Schaltern wirken bei laufenden Pads weich und ohne Neustart.
- **A/B-Vergleich:** *A: Original* und *B: Mit Effekten* schalten bei laufender Wiederholung live um. Im Pad-Dialog betrifft A/B nur die Soundeffekte (EQ und Hall bleiben an).
- Die Originaldatei wird nie verändert. Gruppen, Stop-Ziele, Loop, One-Shot und Lautstärkeregler bleiben unverändert. Kopieren und Tauschen von Pads nimmt die Effekte mit.

## Technik
Web Audio: Biquad-Filter, WaveShaper (Sättigung, Verzerrung, Bit-Reduktion), Verzögerungsleitungen mit Schwingungen (Wow/Flutter, Chorus, Plattenteller), Rückkopplung (Echo), geseedete Muster für Rauschen (rosa) und Knistern. Pro eingeschaltetem Effekt entstehen 5 bis 15 Audio-Knoten.

## Speicherung und Export
Globale Einstellungen in der Datenbank (Bereich „settings“), pad-eigene Einstellungen am Pad. Projektformat **Version 10** (`effects`, `fxMode`, `fxOwn`). Projekte aus Version 9 und älter importieren; fehlende Effekte sind aus.

## Grenzen
- **Lo-Fi** reduziert die Bit-Tiefe und die Höhen, eine echte Abtastraten-Reduktion gibt es nicht (dafür bräuchte es einen AudioWorklet).
- Effekte mit Tonhöhenschwankung (Tape, Vinyl, Chorus) haben je **rund 10 bis 20 ms Verzögerung**.
- Kleine Knackser beim Einschalten eines zusätzlichen Effekts bei laufendem Pad (siehe oben).
- **Rechenlast auf dem iPad ist nicht gemessen.** Je mehr Effekte gleichzeitig an sind, desto mehr. Bitte mit vielen Pads und mehreren Effekten testen.
- Ob Klang und Stärke der Presets gefallen, kann nur durch Hören beurteilt werden.

## Manuelle Tests
| Nr. | Schritte | Erwartung | Win | Mac | iPad |
|---|---|---|---|---|---|
| R1 | Mehr > Soundeffekte & Filter, Tape einschalten, Ton wählen, B: Mit Effekten | Dumpfer, Rauschen, leichtes Eiern; A schaltet auf Original | ⬜ | ⬜ | ⬜ |
| R2 | Regler bei laufender Vorschau bewegen | Weiche Änderung, kein Knacken, kein Neustart | ⬜ | ⬜ | ⬜ |
| R3 | Alle Presets von Tape und Radio während der Wiedergabe wechseln | Klingt je Preset anders, ohne Aussetzer | ⬜ | ⬜ | ⬜ |
| R4 | Pad A „Eigene Effekte: Telefon“, Pad B ohne Effekte, beide starten | Nur A klingt nach Telefon (mono, schmal), B unverändert | ⬜ | ⬜ | ⬜ |
| R5 | Pad C „Globale Effekte übernehmen“, Schnellschalter im Menü Mehr bei laufendem Pad an/aus (auch im Live-Modus) | Effekt schaltet sofort mit | ⬜ | ⬜ | ⬜ |
| R6 | Mehrere Pads mit verschiedenen Effekten gleichzeitig | Jedes klingt nach seiner Einstellung | ⬜ | ⬜ | ⬜ |
| R7 | Pad mit Tape stoppen, dann STOP ALL | Rauschen endet mit dem Pad, danach Stille | ⬜ | ⬜ | ⬜ |
| R8 | Schalter 10-mal schnell hintereinander | Keine Aussetzer, kein Hängenbleiben | ⬜ | ⬜ | ⬜ |
| R9 | Speichern, F5 | Globale und pad-eigene Einstellungen sind wieder da | ⬜ | ⬜ | ⬜ |
| R10 | Export, ändern, Import | Effekte zurück | ⬜ | ⬜ | ⬜ |
| R11 | Leeres Pad und Pad mit fehlender Datei tippen | Keine Fehlermeldung (leer) beziehungsweise normale Meldung | ⬜ | ⬜ | ⬜ |
| R12 | Live-Modus: Menü Mehr | „Öffnen“ gesperrt, Schnellschalter geht | ⬜ | ⬜ | ⬜ |
| R13 | 8 Pads gleichzeitig mit mehreren Effekten, EQ und Hall | Läuft ohne Knistern, App bleibt flüssig | ⬜ | ⬜ | ⬜ |
| R14 | Gruppen und Stop-Ziele mit Effekt-Pads | Regeln und Fades wie bisher | ⬜ | ⬜ | ⬜ |
| R15 | Vinyl: Presets Sauber, Alt, Stark | Rauschen und Knistern nehmen hörbar zu, Höhen dumpfer, leichtes Eiern | ⬜ | ⬜ | ⬜ |
| R16 | Vinyl-Pad stoppen | Knistern endet sofort mit dem Pad | ⬜ | ⬜ | ⬜ |
| R17 | Echo: Presets, Pad antippen und stoppen | Wiederholungen hörbar, klingen nach dem Stoppen kurz aus | ⬜ | ⬜ | ⬜ |
| R18 | Echo-Pad stoppen, sofort STOP ALL | Echo ist sofort weg | ⬜ | ⬜ | ⬜ |
| R19 | Filter: Tiefpass und Hochpass bis zum Anschlag | Höhen beziehungsweise Tiefen verschwinden, kein Knacken beim Ziehen | ⬜ | ⬜ | ⬜ |
| R20 | Verzerrung: Warm, Crunch, Fuzz | Zunehmend übersteuert, Lautstärke bleibt ähnlich | ⬜ | ⬜ | ⬜ |
| R21 | Chorus: Presets, Regler | Breiterer, schwebender Klang, keine Aussetzer | ⬜ | ⬜ | ⬜ |
| R22 | Lo-Fi: Leicht bis Extrem | Zunehmend körnig und dumpf | ⬜ | ⬜ | ⬜ |
| R23 | Tape: Knackser-Regler (erweitert) hochziehen | Gelegentliche Knackser, nicht störend laut | ⬜ | ⬜ | ⬜ |
| R24 | Bei laufendem Pad einen weiteren Effekt einschalten | Effekt kommt hinzu, die anderen bleiben, höchstens ein kurzes Knacken | ⬜ | ⬜ | ⬜ |
