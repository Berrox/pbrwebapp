# Kopfleiste, Fades, Restzeit, Kopieren/Tauschen

## Funktionen
- **☀ Wach: AN/AUS:** Hält den Bildschirm wach, aber **nur im Live-Modus** und solange die App sichtbar ist (Bildschirmsperre-API „Screen Wake Lock“). Zustände: *AUS*, *AN (nur Live)* (wartet auf den Live-Modus), *AN ✓* (Sperre aktiv), *Fehler, tippen* (vom Gerät abgelehnt, ein Tippen versucht es erneut), *nicht verfügbar* (Browser unterstützt es nicht). Die Einstellung wird auf dem Gerät gespeichert, Standard AUS.
- **Restzeit auf laufenden Pads:** Fortschrittsbalken unten im Pad und oben rechts die Restzeit („−1:23“, unter 10 s mit Zehntel). Loops zeigen „∞ Loop“. Bei geschnittenen Samples zählt nur der Ausschnitt.
- **Master-Lautstärke:** Regler in der Kopfleiste mit Prozentanzeige, immer erreichbar, auch im Live-Modus. Wirkt zusätzlich zur Pad-Lautstärke auf alles, auch auf ausblendende Sounds. Gilt pro Gerät und wird dort gespeichert (nicht im Projekt).
- **Ein-/Ausblenden pro Pad (0 bis 10 s):** Pad-Dialog. Einblenden beim Start, Ausblenden beim Stoppen per Tipp, bei Stop-Regeln (Crossfade) und bei One-Shots am Ende. **STOP ALL stoppt immer sofort** und beendet auch Sounds, die noch ausblenden. Bei kurzen One-Shots werden beide Zeiten auf je die halbe Länge begrenzt. Während des Ausblendens zeigt das Pad bereits „nicht laufend“, der Ton ist aber noch kurz hörbar.
- **Kopieren/Tauschen:** Pad-Dialog, Bereich „Kopieren / Tauschen“. Kopieren ersetzt den Inhalt des Ziels (mit Rückfrage, wenn es belegt ist). Tauschen vertauscht die Inhalte; Stop-Ziele anderer Pads folgen dem Inhalt. **Tasten und MIDI-Noten bleiben an der Position** und werden nicht kopiert. Beide Pads werden gestoppt. Die Aktion wirkt sofort und verwirft ungespeicherte Eingaben im Dialog.
- **Uhrzeit und Stoppuhr:** Uhrzeit (Gerätezeit) mit Sekunden. Stoppuhr per Tippen starten/anhalten (⏱), Zurücksetzen (↺) nur bei angehaltener Uhr. Sie läuft über Zeitstempel, zählt also auch bei gedrosseltem Browser richtig und überlebt ein Neuladen.

## Projektformat Version 5
Pads: optionale Felder `fadeIn`, `fadeOut` (Sekunden, 0 bis 30). Ältere Versionen (1 bis 4) bleiben importierbar. Master-Lautstärke, Wach-Schalter und Stoppuhr sind Geräteeinstellungen und stehen nicht im Projekt.

## Manuelle Tests
| Nr. | Schritte | Erwartung | Win | Mac | iPad |
|---|---|---|---|---|---|
| M1 | Wach auf AN, Live-Modus, Display-Zeit abwarten | Bildschirm bleibt an; im Bearbeiten-Modus „AN (nur Live)“ | – | – | ⬜ |
| M2 | App in den Hintergrund, zurück | Sperre wird neu angefordert („AN ✓“) | – | – | ⬜ |
| M3 | One-Shot starten | Balken füllt sich, Restzeit zählt herunter, am Ende verschwindet die Anzeige | ⬜ | ⬜ | ⬜ |
| M4 | Loop starten | „∞ Loop“ | ⬜ | ⬜ | ⬜ |
| M5 | Master herunterziehen, während Pads laufen | Alles wird leiser, Pad-Regler unverändert; nach F5 bleibt der Wert | ⬜ | ⬜ | ⬜ |
| M6 | Pad mit Einblenden 2 s und Ausblenden 3 s: starten, stoppen, One-Shot ausspielen | Hörbar weich ein, beim Stoppen und am Ende aus | ⬜ | ⬜ | ⬜ |
| M7 | Während ein Pad ausblendet: STOP ALL | Sofort still | ⬜ | ⬜ | ⬜ |
| M8 | Intro-Gruppe (exklusiv) mit Ausblenden | Altes Intro blendet aus, während das neue startet | ⬜ | ⬜ | ⬜ |
| M9 | Pad kopieren auf leeres und belegtes Ziel; Pads tauschen | Inhalt wie erwartet, Tasten bleiben, Rückfrage bei belegtem Ziel | ⬜ | ⬜ | ⬜ |
| M10 | Stoppuhr starten, F5, weiterlaufen lassen, anhalten, zurücksetzen | Zählt korrekt weiter, Reset nur im Stillstand | ⬜ | ⬜ | ⬜ |
| M11 | Kopfleiste auf dem iPad hoch und quer | Alle Elemente erreichbar (Umbruch in zweite Zeile), STOP ALL sichtbar | – | – | ⬜ |
| M12 | Export, ändern, Import | Ein-/Ausblendzeiten zurück | ⬜ | ⬜ | ⬜ |
