# Pad-Dialog (Variante B: zwei Spalten mit Vorschau)

**Links:** große Vorschau des Pads (Farbe, Name, Taste/MIDI, Notiz, passende Schriftfarbe), „Probehören“, Name, Farbpalette (8 Farben) und „Eigene Farbe“.
**Rechts:** Karte **Ton** (Datei mit Name, Länge und Größe, „Wellenform / Schnitt“, neue Datei oder Sound aus der Bibliothek, Lautstärke, Loop, Ein-/Ausblenden), darunter aufklappbare Zeilen mit Kurzfassung: **Klang**, **Verhalten**, **Steuerung**, **Notiz** (nur bei „Notizen anzeigen“), **Kopieren / Tauschen**.
**Unten fest:** Pad leeren, Abbrechen, Speichern. Auf schmalen Bildschirmen stehen die Spalten untereinander.

- Die Vorschau und die Kurzfassungen aktualisieren sich bei jeder Eingabe.
- „Klang“ klappt von selbst auf, wenn das Pad EQ oder Hall hat. Alle anderen Bereiche starten zugeklappt.
- Die Funktionen sind unverändert (Speichern, Abbrechen, Probehören, Kopieren, Gruppen, Tasten, MIDI, Klang).
- **Neu gegenüber vorher:** Farbpalette, Vorschau-Kachel, Kurzfassungen, Dateiinfo (Name · Länge · Größe) statt „Audiodatei zugewiesen“, Loop als Schalter. „Probehören“ steht jetzt links unter der Vorschau.

## Manuelle Tests
| Nr. | Schritte | Erwartung | Win | Mac | iPad |
|---|---|---|---|---|---|
| Q1 | Pad im Bearbeiten-Modus antippen | Dialog zweispaltig, Titel und Untertitel („Pad 3 · Bank …“) stimmen | ⬜ | ⬜ | ⬜ |
| Q2 | Name tippen, Palettenfarbe und eigene Farbe wählen | Vorschau und Farbfeld oben folgen sofort, Schrift gut lesbar (auch bei Gelb) | ⬜ | ⬜ | ⬜ |
| Q3 | Taste und MIDI-Note setzen | Kurzfassung „Steuerung“ und Vorschau zeigen sie | ⬜ | ⬜ | ⬜ |
| Q4 | Klang, Verhalten, Notiz aufklappen und ändern | Kurzfassung in der Zeile aktualisiert sich | ⬜ | ⬜ | ⬜ |
| Q5 | Probehören mit Regler bewegen, Stopp | Wie bisher | ⬜ | ⬜ | ⬜ |
| Q6 | Speichern, Pad neu öffnen | Alle Werte da, Loop-Schalter stimmt | ⬜ | ⬜ | ⬜ |
| Q7 | Kopieren / Tauschen | Funktioniert wie bisher | ⬜ | ⬜ | ⬜ |
| Q8 | iPad hochkant | Spalten untereinander, Fußleiste bleibt sichtbar, Scrollen im mittleren Teil | – | – | ⬜ |
| Q9 | Pad leeren, Abbrechen, Esc | Wie bisher (Esc ändert nichts) | ⬜ | ⬜ | ⬜ |
