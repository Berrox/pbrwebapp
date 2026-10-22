# Oberfläche (ruhiger)

- **Kopfleiste:** STOP ALL, Modus (Live mit Schloss, Bearbeiten mit Stift), Master-Lautstärke, Uhrzeit, Stoppuhr, „⋯“. Der orange Export-Hinweis erscheint nur, wenn die Sicherung überfällig ist.
- **Menü „Mehr“ (⋯):** Bildschirm wach halten, Notizen anzeigen, Helligkeit (100/70/40 %), Stoppuhr zurücksetzen, Status (Offline, MIDI, letzter Export). Das Menü ist nicht modal: STOP ALL und die Pads bleiben bedienbar. Es schließt per Tippen außerhalb, erneutes Tippen auf ⋯ oder Esc (Esc schließt zuerst das Menü und löst dann **nicht** STOP ALL aus).
- **Meldungen:** kurze Einblendung unten in der Mitte (3 bis 9 Sekunden, je nach Länge). Der Text steht zusätzlich in einem versteckten Statusfeld für Screenreader.
- **Pads:** Schriftfarbe automatisch dunkel oder weiß nach Hintergrund, lange Namen kleiner (22/18/15 px). Laufende Pads: weißer (bei hellen Pads dunkler) Rand, Fortschrittsbalken, Restzeit.
- **Bank-Tabs:** Farbstreifen oben. Die Farbe stellst du im Bearbeiten-Modus bei den Bank-Werkzeugen („Farbe“) ein, ohne Auswahl gibt es eine feste Palettenfarbe pro Bank. Gespeichert im Projekt (Format Version 7).
- **Symbole:** einfarbige Linien-Symbole statt Emoji in den Knöpfen.
- **Helligkeit:** legt eine halbdunkle Ebene über die Oberfläche (30 % oder 60 %). Dialoge des Bearbeiten-Modus liegen darüber und werden **nicht** mit abgedunkelt. Gespeichert pro Gerät.

## Manuelle Tests
| Nr. | Schritte | Erwartung | Win | Mac | iPad |
|---|---|---|---|---|---|
| O1 | Live-Modus ansehen (quer, hochkant) | Kopfleiste aufgeräumt, nichts verdeckt STOP ALL | ⬜ | ⬜ | ⬜ |
| O2 | ⋯ antippen, Schalter und Helligkeit bedienen, außerhalb tippen | Menü öffnet/schließt, Werte werden übernommen, Pads bleiben nutzbar | ⬜ | ⬜ | ⬜ |
| O3 | Menü offen, Esc drücken | Nur das Menü schließt, nichts wird gestoppt | ⬜ | ⬜ | – |
| O4 | Etwas speichern/importieren | Meldung erscheint unten und verschwindet | ⬜ | ⬜ | ⬜ |
| O5 | Helle (Gelb) und dunkle Pad-Farben, langer Name | Schrift gut lesbar, Name passt | ⬜ | ⬜ | ⬜ |
| O6 | Laufendes Pad hell und dunkel | Rand, Balken und Restzeit gut erkennbar | ⬜ | ⬜ | ⬜ |
| O7 | Bankfarbe ändern, F5, Export/Import | Streifen bleibt | ⬜ | ⬜ | ⬜ |
| O8 | Notizen im Menü ein/aus | Notizbereich und Pad-Notizen erscheinen/verschwinden | ⬜ | ⬜ | ⬜ |
| O9 | Wach-Schalter im Menü | Zustandstext darunter stimmt | – | – | ⬜ |
| O10 | Helligkeit 40 %, F5 | Bleibt gespeichert | ⬜ | ⬜ | ⬜ |
| O11 | Alle Pads belegt, Menü „⋯“ öffnen | Menü liegt über den Pads, alle Schalter bedienbar | ⬜ | ⬜ | ⬜ |
