// Farben: lesbare Schriftfarbe nach Hintergrund, Schriftgröße nach Namenslänge. Reine Logik.
const lin = (c: number): number => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };

export function luminance(hex: string): number | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
/** Kontrastverhältnis nach WCAG (1 bis 21). Ungültige Farben ergeben 1. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  if (la === null || lb === null) return 1;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
const DARK = "#111111", LIGHT = "#ffffff";
/** Dunkle oder weiße Schrift, je nachdem, was auf dem Hintergrund besser lesbar ist. */
export const textColorFor = (bg: string): string => (contrastRatio(bg, DARK) > contrastRatio(bg, LIGHT) ? DARK : LIGHT);
export const isLightColor = (bg: string): boolean => textColorFor(bg) === DARK;
/** Schriftgröße in px für den Pad-Namen: lange Namen werden kleiner. */
export function padFontSize(name: string): number {
  const n = [...name].length;
  return n <= 14 ? 22 : n <= 26 ? 18 : 15;
}
