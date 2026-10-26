// Effekt-Karten (acht Effekte): Schalter, Preset, Regler mit Prozentanzeige, Erweitert, Zurücksetzen.
// Gleiche Karten für die globalen Einstellungen und für "Eigene Effekte" eines Pads. Nur feste Texte, kein HTML aus Daten.
import { KINDS, PRESETS, applyPreset, defaultParams, type EffectProfile, type Kind, type Params } from "../model/effects";

interface Def { title: string; text: string; sliders: [key: string, label: string, advanced?: boolean][]; bools: [key: string, label: string][] }
const DEFS: Record<Kind, Def> = {
  tape: { title: "Kassetten-Tape", text: "Klingt wie eine alte Kassette: dumpfer, mit Rauschen und leichtem Eiern.",
    sliders: [["intensity", "Intensität"], ["highLoss", "Höhenverlust"], ["noise", "Rauschen"], ["wow", "Wow & Flutter"], ["saturation", "Sättigung", true], ["clicks", "Knackser", true]], bools: [] },
  vinyl: { title: "Vinyl / Schallplatte", text: "Klingt wie eine alte Schallplatte: Rauschen, Knistern und leichtes Eiern.",
    sliders: [["intensity", "Intensität"], ["noise", "Vinyl-Rauschen"], ["crackle", "Knistern und Knackser"], ["highLoss", "Höhenverlust"], ["wobble", "Tonhöhenschwankung", true]], bools: [] },
  radio: { title: "Radio- und Telefonfilter", text: "Schneidet Tiefen und Höhen ab wie ein altes Radio oder Telefon.",
    sliders: [["intensity", "Intensität"], ["lows", "Tiefen abschneiden"], ["highs", "Höhen abschneiden"], ["mid", "Mittenbetonung", true]], bools: [["mono", "Mono-Wiedergabe"]] },
  filter: { title: "Tiefpass- und Hochpassfilter", text: "Schneidet hohe oder tiefe Töne ab.",
    sliders: [["intensity", "Intensität"], ["lowpass", "Höhen abschneiden (Tiefpass)"], ["highpass", "Tiefen abschneiden (Hochpass)"]], bools: [] },
  distortion: { title: "Verzerrung", text: "Übersteuert den Klang, von warm bis kratzig.",
    sliders: [["intensity", "Anteil"], ["drive", "Stärke"], ["tone", "Klang (dunkel bis hell)", true]], bools: [] },
  chorus: { title: "Chorus", text: "Dopplung mit leichter Verstimmung für einen breiten, schwebenden Klang.",
    sliders: [["intensity", "Anteil"], ["rate", "Geschwindigkeit"], ["depth", "Tiefe"]], bools: [] },
  lofi: { title: "Lo-Fi / Bitcrusher", text: "Körnig und rau wie ein altes Digitalgerät: weniger Bit-Tiefe, dumpfere Höhen.",
    sliders: [["intensity", "Anteil"], ["crush", "Körnung (Bit-Reduktion)"], ["tone", "Höhenverlust", true]], bools: [] },
  echo: { title: "Echo / Delay", text: "Wiederholt den Ton leiser in zeitlichen Abständen.",
    sliders: [["intensity", "Anteil"], ["time", "Abstand"], ["feedback", "Wiederholungen"]], bools: [] },
};
const h = (tag: string, cls = "", text = ""): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

export function renderEffectCards(box: HTMLElement, profile: EffectProfile, onChange: (p: EffectProfile) => void): void {
  box.replaceChildren();
  const prof: EffectProfile = structuredClone(profile);
  const emit = () => onChange(structuredClone(prof));
  const rerender = () => renderEffectCards(box, prof, onChange);

  for (const kind of KINDS) {
    const def = DEFS[kind], v = prof[kind] as unknown as Params;
    const card = h("section", "fxcard"), head = h("div", "fxHead"), title = h("div");
    title.append(h("b", "", def.title), h("span", "mu", def.text));
    const sw = h("input", "tog") as HTMLInputElement;
    sw.type = "checkbox"; sw.checked = v.on === true; sw.setAttribute("aria-label", `${def.title} ein oder aus`);
    head.append(title, sw);
    const body = h("div", "fxBody"); body.hidden = !sw.checked; // Einstellungen erst nach dem Einschalten
    sw.addEventListener("change", () => { v.on = sw.checked; body.hidden = !sw.checked; emit(); });

    const presetSel = h("select") as HTMLSelectElement;
    for (const [id, p] of Object.entries(PRESETS[kind])) presetSel.append(new Option(p.label, id));
    const markCustom = () => {
      v.preset = "custom";
      if (![...presetSel.options].some((o) => o.value === "custom")) presetSel.append(new Option("Eigene Einstellung", "custom"));
      presetSel.value = "custom";
    };
    if (v.preset === "custom") markCustom();
    else presetSel.value = String(v.preset);
    presetSel.addEventListener("change", () => { Object.assign(v, applyPreset(kind, v, presetSel.value)); emit(); rerender(); });
    const presetRow = h("label", "fl"); presetRow.append(h("span", "lb", "Preset"), presetSel);
    body.append(presetRow);

    const addSlider = (parent: HTMLElement, key: string, label: string) => {
      const lab = h("label", "sr2"), wrap = h("span", "volRow");
      const inp = h("input") as HTMLInputElement;
      inp.type = "range"; inp.min = "0"; inp.max = "100"; inp.step = "1"; inp.value = String(v[key]);
      inp.setAttribute("aria-label", `${label} in Prozent`);
      const out = h("output", "", `${v[key]} %`);
      inp.addEventListener("input", () => { v[key] = Number(inp.value); out.textContent = `${inp.value} %`; markCustom(); emit(); });
      wrap.append(inp, out); lab.append(h("span", "", label), wrap); parent.append(lab);
    };
    const addBool = (parent: HTMLElement, key: string, label: string) => {
      const lab = h("label", "sr2"), cb = h("input", "tog") as HTMLInputElement;
      cb.type = "checkbox"; cb.checked = v[key] === true; cb.setAttribute("aria-label", label);
      cb.addEventListener("change", () => { v[key] = cb.checked; markCustom(); emit(); });
      lab.append(h("span", "", label), cb); parent.append(lab);
    };
    const adv = h("details");
    const hasAdv = def.sliders.some((s) => s[2]) || def.bools.length > 0;
    adv.append(h("summary", "", "Erweiterte Einstellungen"));
    for (const [key, label, advanced] of def.sliders) addSlider(advanced ? adv : body, key, label);
    for (const [key, label] of def.bools) addBool(adv, key, label);
    if (hasAdv) body.append(adv);
    const reset = h("button", "pdBtn", "Zurücksetzen") as HTMLButtonElement;
    reset.type = "button";
    reset.addEventListener("click", () => { Object.assign(v, { ...defaultParams(kind), on: v.on }); emit(); rerender(); });
    const row = h("div", "row wrap"); row.append(reset); body.append(row);
    card.append(head, body); box.append(card);
  }
}
