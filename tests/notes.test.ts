import { afterEach, describe, expect, it, vi } from "vitest";
import { strToU8, zipSync } from "fflate";
import { NOTE_TITLE_MAX, NotesStore, type Note, type NotesBackend } from "../src/model/notes";
import { ProjectError, buildProjectZip, parseProjectZip, resolveImport } from "../src/model/projectFormat";

function fakeBackend() {
  const db = new Map<string, Note & { order: number }>();
  const b = {
    db, fail: false,
    async loadAll() { return [...db.values()].sort((x, y) => x.order - y.order).map(({ order: _o, ...n }) => n); },
    async save(n: Note, order: number) { if (b.fail) throw new Error("Speicher voll"); db.set(n.id, { ...n, order }); },
    async saveOrder(ns: Note[]) { ns.forEach((n, i) => db.set(n.id, { ...n, order: i })); },
    async remove(id: string) { db.delete(id); },
  };
  return b satisfies NotesBackend & object;
}
afterEach(() => vi.useRealTimers());

describe("Notizen: Speichern", () => {
  it("meldet 'Gespeichert' erst, wenn der Speichervorgang abgeschlossen ist", async () => {
    vi.useFakeTimers();
    const b = fakeBackend();
    let release!: () => void;
    const slow: NotesBackend = { ...b, save: (n, o) => new Promise<void>((res) => { release = () => { b.db.set(n.id, { ...n, order: o }); res(); }; }) };
    const s = new NotesStore(slow);
    s.replaceAll([{ id: "a", title: "T", text: "" }]);
    s.edit("a", { text: "Hallo" });
    expect(s.state).toBe("saving");
    await vi.advanceTimersByTimeAsync(600);
    expect(s.state).toBe("saving");
    expect(b.db.size).toBe(0);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(s.state).toBe("saved");
    expect(b.db.get("a")?.text).toBe("Hallo");
  });
  it("flush (Ausblenden, Seite verlassen) speichert sofort", async () => {
    const b = fakeBackend(), s = new NotesStore(b);
    const n = await s.add("Ablauf");
    s.edit(n.id, { text: "19:00 Intro" });
    await s.flush();
    expect(b.db.get(n.id)?.text).toBe("19:00 Intro");
    expect(s.state).toBe("saved");
  });
  it("Notizen sind nach einem Neustart (neuer Store, gleicher Speicher) unverändert da", async () => {
    const b = fakeBackend(), s1 = new NotesStore(b);
    const n = await s1.add("Moderation");
    s1.edit(n.id, { text: "Zeile 1\nZeile 2" });
    await s1.flush();
    const s2 = new NotesStore(b);
    await s2.load();
    expect(s2.notes).toEqual([{ id: n.id, title: "Moderation", text: "Zeile 1\nZeile 2" }]);
  });
  it("Anlegen, Verschieben und Löschen werden gespeichert, Reihenfolge bleibt", async () => {
    const b = fakeBackend(), s = new NotesStore(b);
    const a = await s.add("A"), c = await s.add("B");
    await s.move(c.id, -1);
    const s2 = new NotesStore(b); await s2.load();
    expect(s2.notes.map((n) => n.title)).toEqual(["B", "A"]);
    await s.remove(a.id);
    expect(b.db.has(a.id)).toBe(false);
  });
  it("Speicherfehler werden angezeigt, nie als gespeichert gemeldet, und erholen sich", async () => {
    const b = fakeBackend(), s = new NotesStore(b);
    const n = await s.add("X");
    b.fail = true;
    s.edit(n.id, { text: "neu" });
    await s.flush();
    expect(s.state).toBe("error");
    b.fail = false;
    s.edit(n.id, { text: "neu2" });
    await s.flush();
    expect(s.state).toBe("saved");
  });
  it("begrenzt Titel und Text auf die erlaubte Länge", () => {
    const s = new NotesStore(fakeBackend());
    s.replaceAll([{ id: "a", title: "", text: "" }]);
    s.edit("a", { title: "x".repeat(500) });
    expect(s.notes[0].title).toHaveLength(NOTE_TITLE_MAX);
  });
});

describe("Notizen im Projekt", () => {
  const bank = { id: "b", name: "B", columns: 4, padCount: 2 };
  const notes: Note[] = [{ id: "n1", title: "Ablauf", text: "1. Intro\n2. Jingle" }, { id: "n2", title: "Hinweis", text: "Ö ä ü – Emoji 🎙" }];
  it("Export und Import erhalten Titel, Texte und Reihenfolge; wiederholter Import erzeugt keine Duplikate", () => {
    const r = resolveImport(parseProjectZip(buildProjectZip("T", [bank], new Map(), [], notes)));
    expect(r.notes).toEqual(notes);
    const s = new NotesStore(fakeBackend());
    s.replaceAll(r.notes); s.replaceAll(r.notes);
    expect(s.notes).toHaveLength(2);
  });
  it("ältere Projekte (Version 1, ohne Notizen) lassen sich weiter importieren", () => {
    const v1 = { format: "sampler-project", version: 1, name: "Alt", exportedAt: "x", sounds: [], banks: [{ ...bank, pads: [] }] };
    const r = resolveImport(parseProjectZip(zipSync({ "project.json": strToU8(JSON.stringify(v1)) })));
    expect(r.notes).toEqual([]);
  });
  it("beschädigte Notizdaten werden abgelehnt", () => {
    const mk = (n: unknown) => zipSync({ "project.json": strToU8(JSON.stringify({ format: "sampler-project", version: 2, name: "T", exportedAt: "x", sounds: [], banks: [{ ...bank, pads: [] }], notes: n })) });
    expect(() => parseProjectZip(mk("kaputt"))).toThrow(ProjectError);
    expect(() => parseProjectZip(mk([{ id: "a", title: "x", text: "" }, { id: "a", title: "y", text: "" }]))).toThrow(ProjectError);
    expect(() => parseProjectZip(mk([{ id: "a", title: "x".repeat(101), text: "" }]))).toThrow(ProjectError);
    expect(() => parseProjectZip(mk([{ id: "../x", title: "x", text: "" }]))).toThrow(ProjectError);
  });
});
