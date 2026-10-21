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
