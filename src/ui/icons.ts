// Einfarbige Linien-Symbole (erben die Textfarbe). Feste, eigene Symbole, niemals Benutzertext.
const svg = (body: string): string => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
export const ICONS = {
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  pencil: svg('<path d="M4 20l4-1 11-11-3-3L5 16l-1 4z"/>'),
  play: svg('<path d="M8 5v14l11-7z"/>'),
  pause: svg('<path d="M8 6v12M16 6v12"/>'),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="1"/>'),
} as const;

export function setIconText(el: HTMLElement, icon: keyof typeof ICONS, text: string): void {
  el.replaceChildren();
  el.insertAdjacentHTML("afterbegin", ICONS[icon]);
  el.append(document.createTextNode(text)); // Text als Textknoten, nie als HTML
}
