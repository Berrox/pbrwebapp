# Wiedergaberegeln pro Pad

Jedes Pad hat im Pad-Dialog (Bearbeiten-Modus) den Bereich **Wiedergabeverhalten**. Die Regeln werden **beim Start** des Pads einmal ausgewertet, direkt vor dem Abspielen. Das erneute Antippen eines laufenden Pads stoppt es weiterhin (unabhängig vom Modus).

| Modus | Beim Start werden gestoppt |
|---|---|
| Parallel abspielen (Standard) | nichts |
| Ausgewählte Pads stoppen | nur die angekreuzten Pads (in allen Bänken, gespeichert über stabile Pad-IDs) |
| Gruppe exklusiv abspielen | laufende Pads derselben Wiedergabegruppe (nur gleiche Bank, außer die Gruppe ist „bankübergreifend“) |
| Alle anderen Pads stoppen | alle anderen laufenden Pads, in allen Bänken (muss bewusst gewählt werden) |

- **Gruppen** verwaltest du im Bearbeiten-Modus unter „Gruppen“ (anlegen, umbenennen, löschen, „bankübergreifend“). Die Zuordnung eines Pads zur Gruppe ist unabhängig vom Modus: Auch ein „parallel“-Pad kann von einem Gruppen-Pad gestoppt werden.
- Gruppen ändern, umbenennen oder löschen stoppt **nie** laufende Sounds. Ein Bankwechsel löst keine Regeln aus.
- STOP ALL ist unabhängig von allen Regeln.
- Stop-Ziele: nicht das Pad selbst, keine leeren Pads. Leere Pads verschwinden beim Speichern aus der Auswahl.
- Die Einstellungen können im gesperrten Live-Modus nicht verändert werden.

## Projektformat Version 3
Pad: `playMode` (`stopSelected`|`group`|`stopOthers`, fehlt = parallel), `groupId`, `stopTargets` (Pad-IDs `<bank-id>:<index>`). Projekt: `groups` (`id`, `name`, `crossBank`). Beim Import werden unbekannte Gruppen, Selbstzuordnungen und Verweise auf nicht vorhandene Pads entfernt und gemeldet. Ältere Projekte (Version 1 und 2) bleiben importierbar.

## Manuelle Tests
| Nr. | Schritte | Erwartung | Win | Mac | iPad |
|---|---|---|---|---|---|
| K1 | Zwei Pads parallel starten | Beide laufen | ⬜ | ⬜ | ⬜ |
| K2 | Pad A „Ausgewählte stoppen“ mit Ziel B; B und C starten, dann A | B stoppt, C läuft weiter | ⬜ | ⬜ | ⬜ |
| K3 | Gruppe „Intros“ mit drei Pads (Modus „Gruppe exklusiv“); nacheinander starten | Jeweils nur das letzte läuft; Hintergrund-Pad ohne Gruppe läuft weiter | ⬜ | ⬜ | ⬜ |
| K4 | Gruppe in zwei Bänken, einmal „bankübergreifend“ an, einmal aus | An: stoppt bankübergreifend; aus: nur gleiche Bank | ⬜ | ⬜ | ⬜ |
| K5 | „Alle anderen stoppen“ | Nur das neue Pad läuft | ⬜ | ⬜ | ⬜ |
| K6 | Loop und One-Shot mit den Modi | Loop wird von der Regel gestoppt, One-Shot endet normal | ⬜ | ⬜ | ⬜ |
| K7 | Bank wechseln, Gruppe umbenennen/löschen | Laufende Sounds bleiben | ⬜ | ⬜ | ⬜ |
| K8 | Export, ändern, Import | Modi, Gruppen, Stop-Ziele zurück | ⬜ | ⬜ | ⬜ |
| K9 | Live-Modus | Regeln wirken, Einstellungen nicht änderbar | ⬜ | ⬜ | ⬜ |
