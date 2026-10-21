// Audioformate, die die App zum Import anbietet. Ob ein Format auf dem Gerät abspielbar ist,
// entscheidet am Ende der Browser beim Dekodieren (decodeAudioData). WAV und MP3 gehen überall.
const MIME: Record<string, string> = {
  wav: "audio/wav", mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg", oga: "audio/ogg",
  opus: "audio/ogg", flac: "audio/flac", aif: "audio/aiff", aiff: "audio/aiff", caf: "audio/x-caf",
};
export const AUDIO_EXTENSIONS = Object.keys(MIME);
/** Wert für das accept-Attribut der Dateiauswahl. */
export const AUDIO_ACCEPT = "audio/*," + AUDIO_EXTENSIONS.map((e) => "." + e).join(",");

export function audioExtension(name: string): string | null {
  const e = /\.([A-Za-z0-9]{1,5})$/.exec(name)?.[1].toLowerCase();
  return e && Object.prototype.hasOwnProperty.call(MIME, e) ? e : null;
}
export function audioMime(name: string): string {
  const e = audioExtension(name);
  return e ? MIME[e] : "application/octet-stream";
}
