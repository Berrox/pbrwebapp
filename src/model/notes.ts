// Notizen: Datenmodell und Speicherlogik ohne Browser-Abhängigkeit (daher testbar).
import { uuid } from "./ids";

export interface Note { id: string; title: string; text: string }
export const NOTE_TITLE_MAX = 100, NOTE_TEXT_MAX = 100_000, MAX_NOTES = 200;
export type SaveState = "idle" | "saving" | "saved" | "error";

export interface NotesBackend {
  loadAll(): Promise<Note[]>;
  save(note: Note, order: number): Promise<void>;
  saveOrder(notes: Note[]): Promise<void>;
  remove(id: string): Promise<void>;
}
export const newNote = (title = "Neue Notiz"): Note => ({ id: uuid(), title, text: "" });

export function moveItem<T>(arr: T[], index: number, dir: -1 | 1): T[] {
  const j = index + dir;
  if (index < 0 || j < 0 || j >= arr.length) return arr;
  const copy = [...arr];
  [copy[index], copy[j]] = [copy[j], copy[index]];
  return copy;
}

/** Verwaltet die Notizen im Speicher und schreibt Änderungen verzögert (Entprellung) in den Speicher. */
export class NotesStore {
  notes: Note[] = [];
  onList: () => void = () => {};  // Liste hat sich geändert (neu zeichnen)
  onState: () => void = () => {}; // Speicherstatus hat sich geändert
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private inFlight = 0;
  private errors = new Set<string>();
  private everSaved = false;

  constructor(private backend: NotesBackend, private delayMs = 600) {}

  /** "saved" wird erst gemeldet, wenn alles tatsächlich geschrieben ist. */
  get state(): SaveState {
    if (this.errors.size) return "error";
    if (this.timers.size || this.inFlight) return "saving";
    return this.everSaved ? "saved" : "idle";
  }
  async load(): Promise<void> {
    this.notes = await this.backend.loadAll();
    this.reset();
  }
  /** Ersetzt alle Notizen (Projektimport). Ersetzt, statt zu ergänzen, daher keine Duplikate. */
  replaceAll(notes: Note[]): void {
    this.notes = notes.map((n) => ({ ...n }));
    this.reset();
  }
  private reset(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear(); this.errors.clear(); this.everSaved = false;
    this.onList(); this.onState();
  }
  async add(title?: string): Promise<Note> {
    const n = newNote(title);
    this.notes.push(n);
    this.onList();
    await this.write(n.id);
    return n;
  }
  edit(id: string, patch: Partial<Pick<Note, "title" | "text">>): void {
    const n = this.notes.find((x) => x.id === id);
    if (!n) return;
    if (patch.title !== undefined) n.title = patch.title.slice(0, NOTE_TITLE_MAX);
    if (patch.text !== undefined) n.text = patch.text.slice(0, NOTE_TEXT_MAX);
    const old = this.timers.get(id);
    if (old) clearTimeout(old);
    this.timers.set(id, setTimeout(() => void this.write(id), this.delayMs));
    this.onState();
  }
  async remove(id: string): Promise<void> {
    const t = this.timers.get(id);
    if (t) clearTimeout(t);
    this.timers.delete(id);
    this.notes = this.notes.filter((n) => n.id !== id);
    this.errors.delete(id);
    this.onList();
    await this.run("remove:" + id, () => this.backend.remove(id));
  }
  async move(id: string, dir: -1 | 1): Promise<void> {
    this.notes = moveItem(this.notes, this.notes.findIndex((n) => n.id === id), dir);
    this.onList();
    await this.run("order", () => this.backend.saveOrder(this.notes.map((n) => ({ ...n }))));
  }
  /** Schreibt alle noch wartenden Änderungen sofort (Ausblenden, Verlassen der Seite, Export). */
  async flush(): Promise<void> {
    const ids = [...this.timers.keys()];
    ids.forEach((id) => clearTimeout(this.timers.get(id)));
    await Promise.all(ids.map((id) => this.write(id)));
  }
  private async write(id: string): Promise<void> {
    this.timers.delete(id);
    const i = this.notes.findIndex((n) => n.id === id);
    if (i < 0) { this.onState(); return; }
    await this.run(id, () => this.backend.save({ ...this.notes[i] }, i));
  }
  private async run(key: string, op: () => Promise<void>): Promise<void> {
    this.inFlight++; this.onState();
    try { await op(); this.errors.delete(key); this.everSaved = true; }
    catch { this.errors.add(key); }
    finally { this.inFlight--; this.onState(); }
  }
}
