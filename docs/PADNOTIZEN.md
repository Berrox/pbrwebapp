# Lautstärkeregler und Pad-Notizen

## Lautstärke
- Regler im Pad-Dialog (Bearbeiten-Modus), 0 bis 100 %, Anzeige direkt daneben („75 %“), aktualisiert sich beim Ziehen.
- Läuft das Pad gerade, ändert sich die Lautstärke **sofort und weich**. Andere Pads bleiben unberührt. „Abbrechen“ oder Esc setzt die Lautstärke des laufenden Pads zurück, „Speichern“ übernimmt sie dauerhaft.
- Ein nicht laufendes Pad hört man erst beim nächsten Start in der neuen Lautstärke.
- Es gibt keine globale Master-Lautstärke. Die Lautstärke des Geräts regelst du am Gerät.
- Gespeichert pro Pad (IndexedDB) und im Projekt-Export enthalten.

## Pad-Notizen
- Bearbeiten-Modus, Pad-Dialog, Feld „Notiz zu diesem Pad“ (bis 500 Zeichen). Nur sichtbar, wenn „📝 Notizen: AN“ eingeschaltet ist.
- Gebunden an die **Pad-ID**, nicht an Name oder Audiodatei: Umbenennen und Austauschen des Sounds behalten die Notiz am selben Pad. „Pad leeren“ löscht die Notiz mit.
- Auf dem Pad erscheint die Notiz als gekürzte Zeile „✎ …“ (nur bei AN und nur wenn vorhanden). Im Live-Modus nur lesbar.
- Leere Notizen werden nicht gespeichert und belegen keinen Platz.
- Projektformat Version 4: Feld `note` am Pad. Ältere Projekte importieren ohne Notizen.

## Schalter „📝 Notizen: AN/AUS“
Ein gemeinsamer Schalter für den projektweiten Notizbereich **und** die Pad-Notizen. Der Zustand wird auf dem Gerät gespeichert. Standard: AUS. Umschalten verändert weder Notizen noch Lautstärken noch laufende Sounds.

## Manuelle Tests
| Nr. | Schritte | Erwartung | Win | Mac | iPad |
|---|---|---|---|---|---|
| L1 | Pad starten (Loop), Pad-Dialog öffnen, Regler ziehen | Prozentzahl folgt, Lautstärke des laufenden Pads ändert sich hörbar, andere Pads unverändert | ⬜ | ⬜ | ⬜ |
| L2 | Wie L1, dann „Abbrechen“ | Lautstärke springt auf den alten Wert zurück | ⬜ | ⬜ | ⬜ |
| L3 | Speichern, F5, Pad starten | Gespeicherte Lautstärke gilt | ⬜ | ⬜ | ⬜ |
| L4 | Schalter auf AN, Notiz bei zwei Pads in verschiedenen Bänken eintragen | Notizen erscheinen auf den richtigen Pads, Bankwechsel zeigt jeweils die richtigen | ⬜ | ⬜ | ⬜ |
| L5 | Schalter auf AUS und wieder AN | Alle Notizen (Bereich und Pads) verschwinden und kommen unverändert zurück, nichts stoppt | ⬜ | ⬜ | ⬜ |
| L6 | Sound eines Pads austauschen, Pad umbenennen | Notiz bleibt am Pad | ⬜ | ⬜ | ⬜ |
| L7 | Live-Modus mit AN | Notizen lesbar, kein Eingabefeld erreichbar | ⬜ | ⬜ | ⬜ |
| L8 | Export, ändern, Import | Lautstärken und Pad-Notizen zurück | ⬜ | ⬜ | ⬜ |
| L9 | Pad-Dialog öffnen, Esc | Nichts wird gespeichert oder geleert | ⬜ | ⬜ | ⬜ |
