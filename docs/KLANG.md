# Klang pro Pad: EQ und Hall

Pad-Dialog (Bearbeiten-Modus), zugeklappter Bereich **Klang (EQ und Hall)**. Er klappt von selbst auf, wenn das Pad Klang-Einstellungen hat.

- **EQ:** Tiefen (120 Hz), Mitten (1 kHz), Höhen (6 kHz), je −12 bis +12 dB in ganzen dB. Frequenzen und Güte sind fest.
- **Hall:** Menge 0 bis 100 % (5-%-Schritte) und Größe *Raum* (0,7 s), *Halle* (2 s), *Kirche* (3,5 s). Alle Pads gleicher Größe teilen sich einen Hall-Raum. Der Hall-Raum wird im Programm erzeugt (abklingendes Rauschen), es gibt keine zusätzlichen Dateien.
- **Klang zurücksetzen** stellt alles auf aus.

## Verhalten
- **Ohne Einstellungen** bekommt ein Pad keine zusätzlichen Audio-Knoten und läuft wie bisher.
- **Reihenfolge:** Pad-Lautstärke und Fades, dann EQ, dann Hall-Anteil. Der Master-Regler wirkt auf alles, auch auf den Hall.
- **Laufendes Pad:** Änderungen im Dialog sind sofort hörbar (weich). „Abbrechen“ oder Esc stellt den gespeicherten Klang wieder her.
- **Stoppen eines Pads:** Der Hall klingt noch bis zur Länge des Hall-Raums nach. Das Pad zeigt dabei bereits „nicht laufend“.
- **STOP ALL:** schaltet auch den Hall sofort ab.
- Kopieren und Tauschen von Pads nimmt den Klang mit.
- **Projektformat Version 8:** Felder `eqLow`, `eqMid`, `eqHigh` (dB), `reverb` (0 bis 1), `reverbSize` am Pad. Ältere Projekte (1 bis 7) importieren ohne Klang.

## Probehören
Der Knopf **Probehören** im Klang-Bereich spielt den Ton des Pads (oder den in der Bibliothek gewählten Sound) **wiederholt** mit den gerade eingestellten Werten und mit der Lautstärke des Reglers, ohne Ein- und Ausblenden. EQ-, Hall- und Lautstärkeregler wirken dabei sofort. Der Knopf wird zu **Stopp**. Das Probehören endet beim Schließen des Dialogs und bei STOP ALL. Gespeicherte Schnittpunkte gelten für den Ton des Pads. Eine neu gewählte, noch nicht gespeicherte Datei lässt sich erst nach dem Speichern probehören.

## Grenzen (nicht gebaut oder ungeprüft)
- Keine frei einstellbaren Frequenzen oder Güte, keine eigene Nachhallzeit pro Pad, keine Effekte auf dem Master, kein Spektrum.
- Der erzeugte Hall klingt brauchbar, aber nicht wie ein Studiohall.
- **Rechenlast und Verzögerung auf dem iPad sind nicht gemessen.** Bitte mit vielen gleichzeitig laufenden Pads mit Hall testen.
- Beim nachträglichen Einschalten von Klang an einem **bereits laufenden** Pad wird die Audio-Kette umgebaut. Dabei kann ein kurzes Knacken auftreten.
- Ein Hall-Raum (Faltung) wird erst beim ersten Bedarf erzeugt. Der erste Start eines Pads mit Hall kann dadurch einen Moment länger dauern.

## Manuelle Tests
| Nr. | Schritte | Erwartung | Win | Mac | iPad |
|---|---|---|---|---|---|
| P1 | Pad ohne Klang abspielen | Klingt wie bisher | ⬜ | ⬜ | ⬜ |
| P2 | Loop starten, Dialog öffnen, Tiefen hochziehen, dann Höhen herunter | Klang ändert sich sofort und weich in die erwartete Richtung | ⬜ | ⬜ | ⬜ |
| P3 | Hall 40 %, Größe Raum, Halle, Kirche | Nachhall hörbar länger je Größe | ⬜ | ⬜ | ⬜ |
| P4 | Pad mit Hall stoppen | Hall klingt noch kurz aus | ⬜ | ⬜ | ⬜ |
| P5 | Pad mit Hall stoppen und sofort STOP ALL | Hall ist sofort weg | ⬜ | ⬜ | ⬜ |
| P6 | Klang ändern, „Abbrechen“ | Gespeicherter Klang kommt zurück | ⬜ | ⬜ | ⬜ |
| P7 | Speichern, F5, Pad starten | Einstellungen gelten | ⬜ | ⬜ | ⬜ |
| P8 | Export, ändern, Import | Klang zurück | ⬜ | ⬜ | ⬜ |
| P9 | Pad kopieren | Klang wird mitkopiert | ⬜ | ⬜ | ⬜ |
| P10 | 8 Pads gleichzeitig, alle mit Hall und EQ | Kein Knistern oder Aussetzer, App bleibt flüssig | ⬜ | ⬜ | ⬜ |
| P11 | Master und Pad-Lautstärke ändern bei Hall | Hall folgt dem Master, Pad-Lautstärke wirkt auf Pad und Hall-Anteil | ⬜ | ⬜ | ⬜ |
| P12 | Pad mit Sound, Klang-Bereich, „Probehören“, Regler bewegen | Ton wiederholt sich, Klang ändert sich sofort, „Stopp“ beendet, Dialog schließen beendet ebenfalls | ⬜ | ⬜ | ⬜ |
