# Projektformat (Version 1)

Ein Projekt ist eine ZIP-Datei:

- `project.json` – Beschreibung (siehe unten)
- `audio/<sound-id>.wav|.mp3` – Original-Audiodateien (unverändert, Schnitte stehen nur in der JSON)

```json
{
  "format": "sampler-project", "version": 1, "name": "Mein Projekt", "exportedAt": "ISO-Datum",
  "banks": [{ "id": "bank-1", "name": "Intros", "columns": 4, "padCount": 12,
    "pads": [{ "index": 0, "name": "Hallo", "color": "#2563eb", "volume": 0.9, "loop": false,
               "soundId": "abc123", "start": 1.5, "end": 3.0 }] }],
  "sounds": [{ "id": "abc123", "name": "hallo.wav", "file": "audio/abc123.wav" }]
}
```

`start`/`end` (Sekunden) sind optional; fehlen sie, läuft das ganze Sample. Die Reihenfolge von `banks` ist die Reihenfolge in der App.

## Regeln beim Import
- Strenge Prüfung aller Felder; unbekannte Felder werden ignoriert.
- IDs nur `A-Z a-z 0-9 _ -`; Audiopfade nur `audio/<name>`; keine `..`, keine absoluten Pfade.
- Grenzen: ZIP max. 500 MB, Einzeldatei 150 MB, gesamt 800 MB, 3000 Einträge, project.json 5 MB.
- Neuere `version` als die App kennt: Import wird mit Hinweis abgelehnt. Ältere Versionen werden künftig umgewandelt.
- Fehlende Audiodatei: Pad wird leer importiert, die App meldet es.
- Das alte Projekt wird erst ersetzt, wenn alle neuen Daten bereit sind (eine Transaktion).
- Audiodateien werden beim Import nicht dekodiert; eine defekte Datei fällt erst beim Abspielen auf („defekt“-Meldung).

## Nachtrag (M6)
Pads können zusätzlich `"key"` (Tastencode, z. B. `KeyQ`) und `"midiNote"` (0–127) enthalten. Beide sind optional, die Formatversion bleibt 1. Ältere App-Versionen ignorieren die Felder.

## Nachtrag (Notizen, Version 2)
Neues optionales Feld `"notes": [{ "id": "…", "title": "…", "text": "…" }]`. Die Reihenfolge im Array ist die Reihenfolge in der App. Die App schreibt ab jetzt `"version": 2`. Version 1 wird weiter gelesen (dann ohne Notizen). Ältere App-Versionen lehnen Version 2 mit dem Hinweis auf eine neuere Version ab.

## Nachtrag (Wiedergaberegeln, Version 3)
Pads: optional `playMode`, `groupId`, `stopTargets`. Projekt: optional `groups`. Die App schreibt `"version": 3`; Version 1 und 2 werden weiter gelesen. Details: `docs/WIEDERGABEREGELN.md`.

## Nachtrag (Pad-Notizen, Version 4)
Pads: optionales Feld `note` (Text, höchstens 500 Zeichen). Die App schreibt `"version": 4`; Version 1 bis 3 werden weiter gelesen. Details: `docs/PADNOTIZEN.md`.

## Nachtrag (Ein-/Ausblenden, Version 5)
Pads: optionale Felder `fadeIn`, `fadeOut` (Sekunden). Die App schreibt `"version": 5`; Version 1 bis 4 werden weiter gelesen. Details: `docs/KOPFLEISTE.md`.

## Nachtrag (ausgeblendete Pads, Version 6)
`index` eines Pads darf bis 47 reichen, auch über `padCount` der Bank hinaus. Die App schreibt `"version": 6`; Version 1 bis 5 werden weiter gelesen. Details: `docs/SICHERUNG.md`.

## Nachtrag (Bankfarbe, Version 7)
Bänke: optionales Feld `color` (`#rrggbb`). Die App schreibt `"version": 7`; Version 1 bis 6 werden weiter gelesen. Details: `docs/OBERFLAECHE.md`.

## Nachtrag (EQ und Hall, Version 8)
Pads: optionale Felder `eqLow`, `eqMid`, `eqHigh` (−12 bis 12 dB), `reverb` (0 bis 1), `reverbSize` (`room`|`hall`|`church`). Die App schreibt `"version": 8`; Version 1 bis 7 werden weiter gelesen. Details: `docs/KLANG.md`.

## Nachtrag (Soundeffekte & Filter, Version 9)
Projekt: `effects` (`enabled`, `profile` mit `tape` und `radio`, Werte 0 bis 100, Schalter, Preset-Name). Pads: `fxMode` (`off`|`global`|`own`), `fxOwn` (Profil). Fehlt etwas, gilt „alles aus“. Die App schreibt `"version": 9`; Version 1 bis 8 werden weiter gelesen. Details: `docs/EFFEKTE.md`.

## Nachtrag (weitere Effekte, Version 10)
`effects.profile` und `fxOwn` können zusätzlich `vinyl`, `filter`, `distortion`, `chorus`, `lofi`, `echo` enthalten, das Tape optional `clicks`. Fehlt etwas, gilt „aus“ beziehungsweise 0. Die App schreibt `"version": 10`; Version 1 bis 9 werden weiter gelesen. Details: `docs/EFFEKTE.md`.
