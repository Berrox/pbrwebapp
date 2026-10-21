# Notizen

## Entscheidungen
- **Pro Projekt:** eine gemeinsame Notizliste. Bankwechsel ändert sie nie. Beim Export ist sie ein eigener Block (`notes`).
- **Darstellung:** Breite Bildschirme: Spalte rechts neben den Pads. Schmale Bildschirme: unter den Pads, höchstens 40 % der Höhe. Kopfleiste mit STOP ALL bleibt immer frei.
- **Speichern:** Automatisch ca. 0,6 s nach der letzten Eingabe sowie beim Verlassen des Feldes, Ausblenden und Schließen der Seite. Die Anzeige „✓ Gespeichert“ erscheint erst nach erfolgreichem Schreiben in IndexedDB.
- **Live-Modus:** Notizen lesbar und scrollbar, aber schreibgeschützt; Anlegen, Verschieben und Löschen sind ausgeblendet. Eine Option zum Bearbeiten im Live-Modus gibt es bewusst nicht.
- **Ein- und Ausblenden** (Schalter „📝 Notizen“) verändert nur die Sichtbarkeit; Pads, Wiedergabe und Bänke sind nicht betroffen. Der Zustand wird pro Gerät gemerkt (kein Teil des Projekts).
- **Projektformat:** Version 2 (Feld `notes`: `id`, `title`, `text`, Reihenfolge = Reihenfolge der Liste). Version-1-Projekte bleiben importierbar. Ein Import **ersetzt** das gesamte Projekt inklusive Notizen (auch dann, wenn die importierte Datei keine Notizen enthält).

## Grenzen
- Reiner Text, keine Formatierung; Titel max. 100, Text max. 100 000 Zeichen, max. 200 Notizen.
- Bei gleichzeitigem Bearbeiten auf zwei Geräten gibt es keinen Abgleich.
- Auf dem iPad kann die Bildschirmtastatur den unteren Teil des Notizbereichs verdecken; das Feld scrollt beim Tippen in den sichtbaren Bereich. Ungetestet.
- Im Live-Modus ignorieren Tastenkürzel für Pads Eingaben, solange der Fokus in einem Notizfeld liegt. Esc (STOP ALL) funktioniert immer.

## Manuelle Tests
| Nr. | Schritte | Erwartung | Win | Mac | iPad |
|---|---|---|---|---|---|
| J1 | „📝 Notizen“ einschalten, „+ Notiz“, Titel und mehrzeiligen Text eingeben | Notiz erscheint, Status „Speichern …“ dann „✓ Gespeichert“ | ⬜ | ⬜ | ⬜ |
| J2 | Loop starten, Notizen aus- und einschalten | Loop läuft weiter, Pads unverändert, Text unverändert | ⬜ | ⬜ | ⬜ |
| J3 | Bank wechseln | Notizen bleiben gleich | ⬜ | ⬜ | ⬜ |
| J4 | Schnell tippen, sofort F5 / App schließen und neu öffnen | Text nach dem Neustart vollständig da (bei sehr schnellem Schließen ggf. letzte Zeichen fehlend: bitte melden) | ⬜ | ⬜ | ⬜ |
| J5 | Notiz löschen | Rückfrage; nach „Abbrechen“ bleibt sie | ⬜ | ⬜ | ⬜ |
| J6 | Projekt exportieren, ändern, importieren | Notizen mit Titeln, Texten und Reihenfolge zurück, keine Doppelten | ⬜ | ⬜ | ⬜ |
| J7 | Live-Modus | Notizen lesbar, Felder nicht änderbar, keine Anlegen/Löschen-Tasten, STOP ALL sichtbar | ⬜ | ⬜ | ⬜ |
| J8 | Viele lange Notizen anlegen | Bereich scrollt, Pad-Raster bleibt nutzbar | ⬜ | ⬜ | ⬜ |
| J9 | iPad quer und hochkant, Tastatur einblenden | Eingabe bleibt nutzbar | – | – | ⬜ |
