import brethren from "@/data/hymnals/brethren.json";

/**
 * A line of a stanza. Leading tab characters carry the indentation the printed
 * book uses for alternating lines — one tab per indent level. Strip them with
 * `lineText` before searching or measuring.
 */
export type Line = string;

/** A stanza is an ordered list of lines. Lengths vary by meter — 4, 6, 8… */
export type Stanza = Line[];

export interface Hymn {
  number: number;
  /** Empty for the hymns the book leaves untitled; fall back to `hymnTitle`. */
  title: string;
  /** Empty for 131, 288 and 449, which print no meter at all. */
  meter: string;
  author: string | null;
  authorSource: string | null;
  stanzas: Stanza[];
}

export interface Section {
  title: string;
  hymns: number[];
  subsections?: Section[];
}

export interface Hymnal {
  id: string;
  title: string;
  subtitle: string;
  shortName: string;
  isDefault?: boolean;
  sections: Section[];
  hymns: Hymn[];
}

/**
 * Registered hymnals, in the order they should appear in the book switcher.
 *
 * To add another book, generate a JSON file matching the `Hymnal` shape above
 * and add it here — nothing else in the app needs to change. (Songs of Faith
 * and Praise would slot in this way, but its lyrics are under copyright, so no
 * data file ships with this repo.)
 */
const HYMNALS: Hymnal[] = [brethren as Hymnal];

const byId = new Map(HYMNALS.map((h) => [h.id, h]));

/** Per-hymnal number → hymn, so lookups and paging aren't linear scans. */
const indexes = new Map(
  HYMNALS.map((hymnal) => [hymnal.id, new Map(hymnal.hymns.map((h) => [h.number, h]))]),
);

/** Per-hymnal number → the section path it sits under, for the topical eyebrow. */
const sectionPaths = new Map(
  HYMNALS.map((hymnal) => {
    const paths = new Map<number, string[]>();
    const walk = (sections: Section[], trail: string[]) => {
      for (const section of sections) {
        const here = [...trail, section.title];
        for (const n of section.hymns) paths.set(n, here);
        walk(section.subsections ?? [], here);
      }
    };
    walk(hymnal.sections, []);
    return [hymnal.id, paths];
  }),
);

export const listHymnals = (): Hymnal[] => HYMNALS;

export const getHymnal = (id: string): Hymnal | undefined => byId.get(id);

export const getDefaultHymnal = (): Hymnal =>
  HYMNALS.find((h) => h.isDefault) ?? HYMNALS[0];

export const getHymn = (hymnal: Hymnal, number: number): Hymn | undefined =>
  indexes.get(hymnal.id)?.get(number);

/** The hymn to show when a lookup fails — the first in the book. */
export const firstHymn = (hymnal: Hymnal): Hymn => hymnal.hymns[0];

/** ["THE GOSPEL", "INVITATIONS AND WARNINGS"] for the eyebrow above a title. */
export const sectionPath = (hymnal: Hymnal, number: number): string[] =>
  sectionPaths.get(hymnal.id)?.get(number) ?? [];

export const hymnRange = (hymnal: Hymnal): [number, number] => [
  hymnal.hymns[0].number,
  hymnal.hymns[hymnal.hymns.length - 1].number,
];

/** Strip the indentation markers to get plain text for search and previews. */
export const lineText = (line: Line): string => line.replace(/^\t+/, "");

/** How deeply the book indents this line: 0 for flush left, 1–3 for inset. */
export const lineIndent = (line: Line): number => line.match(/^\t*/)![0].length;

/** Untitled hymns are shown by their opening line instead. */
export const hymnTitle = (hymn: Hymn): string =>
  hymn.title || lineText(hymn.stanzas[0]?.[0] ?? `Hymn ${hymn.number}`);

/** The first line, used as the stable key when matching against author data. */
export const firstLine = (hymn: Hymn): string => lineText(hymn.stanzas[0]?.[0] ?? "");

/**
 * Which digits could still lead to a real hymn given what's been typed. Lets
 * the keypad dim the keys that would be dead ends.
 */
export function reachableDigits(hymnal: Hymnal, buffer: string): Set<string> {
  const reachable = new Set<string>();
  const numbers = indexes.get(hymnal.id)!;
  for (const digit of "0123456789") {
    const candidate = buffer + digit;
    if (candidate.length > 3) break;
    if (numbers.has(Number(candidate))) {
      reachable.add(digit);
      continue;
    }
    // A prefix is worth keeping if any hymn number starts with it.
    for (const n of numbers.keys()) {
      if (String(n).startsWith(candidate)) {
        reachable.add(digit);
        break;
      }
    }
  }
  return reachable;
}

/**
 * Full-text search across numbers, titles, authors and lyrics. Ranked so that
 * an exact number wins, then title matches, then a line of the text.
 */
export interface SearchResult {
  hymn: Hymn;
  snippet: string | null;
}

export function searchHymns(hymnal: Hymnal, query: string, limit = 40): SearchResult[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  const scored: { hymn: Hymn; snippet: string | null; score: number }[] = [];

  for (const hymn of hymnal.hymns) {
    const title = hymnTitle(hymn).toLowerCase();
    const number = String(hymn.number);

    let score = -1;
    let snippet: string | null = null;

    if (number === term) score = 0;
    else if (number.startsWith(term)) score = 1;
    else if (title.startsWith(term)) score = 2;
    else if (title.includes(term)) score = 3;
    else if (hymn.author?.toLowerCase().includes(term)) score = 4;
    else {
      for (const stanza of hymn.stanzas) {
        const at = stanza.findIndex((line) => lineText(line).toLowerCase().includes(term));
        if (at !== -1) {
          score = 5;
          snippet = stanza.slice(Math.max(0, at - 1), at + 2).map(lineText).join(" / ");
          break;
        }
      }
    }

    if (score >= 0) scored.push({ hymn, snippet, score });
  }

  return scored
    .sort((a, b) => a.score - b.score || a.hymn.number - b.hymn.number)
    .slice(0, limit)
    .map(({ hymn, snippet }) => ({ hymn, snippet }));
}

/** Alphabetical author index: every attributed author and their hymns. */
export interface AuthorEntry {
  author: string;
  hymns: Hymn[];
}

export function authorIndex(hymnal: Hymnal): AuthorEntry[] {
  const grouped = new Map<string, Hymn[]>();
  for (const hymn of hymnal.hymns) {
    if (!hymn.author) continue;
    if (!grouped.has(hymn.author)) grouped.set(hymn.author, []);
    grouped.get(hymn.author)!.push(hymn);
  }
  return [...grouped.entries()]
    .map(([author, hymns]) => ({ author, hymns }))
    .sort((a, b) => surname(a.author).localeCompare(surname(b.author)));
}

/** Sort "Isaac Watts" under W, the way a printed author index reads. */
const surname = (name: string): string => name.trim().split(/\s+/).at(-1) ?? name;

/** How many hymns still have no attribution, for the index's footnote. */
export const unattributedCount = (hymnal: Hymnal): number =>
  hymnal.hymns.filter((h) => !h.author).length;
