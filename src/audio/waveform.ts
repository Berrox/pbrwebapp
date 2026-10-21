/** Größter Betrag je Spalte (über alle Kanäle) für die Wellenform-Anzeige. Werte 0 bis 1. */
export function computePeaks(channels: Float32Array[], buckets: number): Float32Array {
  const peaks = new Float32Array(buckets);
  const len = channels[0]?.length ?? 0;
  if (!len) return peaks;
  const per = len / buckets;
  for (let b = 0; b < buckets; b++) {
    const from = Math.floor(b * per);
    const to = Math.max(from + 1, Math.floor((b + 1) * per));
    let m = 0;
    for (const ch of channels) for (let i = from; i < to && i < len; i++) { const v = Math.abs(ch[i]); if (v > m) m = v; }
    peaks[b] = Math.min(1, m);
  }
  return peaks;
}
