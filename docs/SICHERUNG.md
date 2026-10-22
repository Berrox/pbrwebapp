# Sicherungserinnerung und Export-Prüfungen

## Erinnerung
- Beim Export merkt sich die App auf dem Gerät den Zeitpunkt (Download gestartet). Ob du die Datei wirklich abgelegt hast, kann die App nicht wissen.
- In den Projekt-Werkzeugen (Bearbeiten-Modus) steht immer „💾 Letzter Export vor X Tagen“.
- **Ab 14 Tagen oder wenn noch nie exportiert wurde** (und es etwas zu sichern gibt) erscheint zusätzlich oben in der Kopfleiste ein oranger Hinweis, in beiden Modi. Tippen darauf startet im Bearbeiten-Modus den Export, im Live-Modus kommt nur ein Hinweis.
- Der Zeitpunkt gilt pro Gerät und Browser, nicht pro Projekt. Ein Import setzt ihn nicht zurück.
- Die 14 Tage sind fest eingestellt.

## Ausgeblendete Pads
Pads über der aktuellen Pad-Anzahl einer Bank werden jetzt mit exportiert, sofern sie Inhalt haben (Name, Sound, Notiz, Einstellungen). Leere ausgeblendete Pads werden nicht gespeichert. Die Pad-Anzahl der Bank bleibt beim Import unverändert, die Pads sind nach Erhöhen der Anzahl wieder da. Projektformat Version 6.

## Warnung vor zu großen Projekten
Vor dem Export werden die Größen der Sounds geprüft:
- **Über 150 MB Audio:** Hinweis, dass Export und Import viel Arbeitsspeicher brauchen und auf dem iPad scheitern können.
- **Nicht mehr importierbar** (Audio über 500 MB, eine Datei über 150 MB oder mehr als 2000 Sounds): Warnung mit der Möglichkeit abzubrechen.
Nach dem Export wird zusätzlich die fertige ZIP-Größe gegen die Importgrenze geprüft. Die Prüfung ist eine Schätzung vor dem Erzeugen der Datei.

## Manuelle Tests
| Nr. | Schritte | Erwartung | Win | Mac | iPad |
|---|---|---|---|---|---|
| N1 | Neues Projekt mit einem Sound, noch nie exportiert | Oranger Hinweis „Noch nie exportiert“ | ⬜ | ⬜ | ⬜ |
| N2 | Exportieren | Hinweis verschwindet, Projekt-Werkzeuge zeigen „Letzter Export gerade eben“ | ⬜ | ⬜ | ⬜ |
| N3 | Gerätedatum um 14 Tage vorstellen, App neu laden | Oranger Hinweis „vor 14 Tagen“ | ⬜ | ⬜ | – |
| N4 | Hinweis im Live-Modus antippen | Meldung, nichts wird exportiert | ⬜ | ⬜ | ⬜ |
| N5 | Pad-Anzahl verkleinern (Pad mit Notiz ausblenden), exportieren, ändern, importieren, Anzahl erhöhen | Ausgeblendetes Pad samt Notiz und Einstellungen ist da | ⬜ | ⬜ | ⬜ |
| N6 | Projekt über 150 MB exportieren | Warnung, Abbrechen möglich | ⬜ | ⬜ | ⬜ |
