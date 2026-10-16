import brethren from "@/data/hymnals/brethren.json";
import otherSongs from "@/data/hymnals/other-songs.json";

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
  /**
   * Indices into `stanzas` that are the recurring refrain rather than a verse.
   * Absent on hymns that have none — which is all 558 of the collection, since
   * the printed book sets no refrains.
   */
  refrains?: number[];
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
  /**
   * Whether a hymn's number is part of its identity. In the collection it is —
   * people call for "hymn 73" and the number is printed on the page. In "Other
   * Songs" the numbers are just positions in an alphabetical list, so putting
   * "Hymn 1" above a song implies a name it doesn't have. They still order and
   * address the songs; they're only kept off the page furniture.
   *
   * Absent means true, so a book has to opt out.
   */
  numbered?: boolean;
  /**
   * Whether songs can be added to this book. The collection cannot take any —
   * it is the text of a printed book with 558 hymns in it, and offering to add
   * a 559th misrepresents what it is. "Other Songs" is the book that grows.
   *
   * Absent means false, so a book has to opt in.
   */
  expandable?: boolean;
  sections: Section[];
  hymns: Hymn[];
}

/** Does this book's numbering mean anything to the person holding it? */
export const isNumbered = (hymnal: Hymnal): boolean => hymnal.numbered !== false;

/** Can a song be added to this book? */
export const isExpandable = (hymnal: Hymnal): boolean => hymnal.expandable === true;

/**
 * Whether this book's sections actually divide it into anything.
 *
 * The collection is organised topically and the headings do real work — they
 * are how you find a hymn for a funeral. "Other Songs" carries a single
 * section named after the book, so every divider it drew announced "OTHER
 * SONGS" above a list of other songs, and its contents opened onto one
 * collapsed row you had to expand before you could see the book at all.
 *
 * Derived rather than declared: a book that grows real sections gets its
 * headings back without anyone remembering to set a flag.
 */
export const hasSections = (hymnal: Hymnal): boolean =>
  hymnal.sections.length > 1 || hymnal.sections.some((s) => (s.subsections?.length ?? 0) > 0);

/**
 * Registered hymnals, in the order they should appear in the book switcher.
 *
 * To add another book, generate a JSON file matching the `Hymnal` shape above
 * and add it here — nothing else in the app needs to change.
 *
 * "Other Songs" is public-domain hymnody from the Open Hymnal Project, built
 * by scripts/build-other-songs.mjs. It is deliberately not a copy of any
 * copyrighted hymnal: songs still in copyright are not reproduced here.
 */
const HYMNALS: Hymnal[] = [brethren as Hymnal, otherSongs as Hymnal];

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

/** The book new songs go into, if there is one. */
export const expandableHymnal = (): Hymnal | undefined => HYMNALS.find(isExpandable);

export const getHymnal = (id: string): Hymnal | undefined => byId.get(id);

export const getDefaultHymnal = (): Hymnal =>
  HYMNALS.find((h) => h.isDefault) ?? HYMNALS[0];

export const getHymn = (hymnal: Hymnal, number: number): Hymn | undefined =>
  indexes.get(hymnal.id)?.get(number);

/** The hymn to show when a lookup fails — the first in the book. */
export const firstHymn = (hymnal: Hymnal): Hymn => hymnal.hymns[0];

/**
 * ["THE GOSPEL", "INVITATIONS AND WARNINGS"] for the eyebrow above a title.
 * Empty where the book isn't divided — there is no "where in the book" to tell
 * someone when the answer is always the same place.
 */
export const sectionPath = (hymnal: Hymnal, number: number): string[] =>
  hasSections(hymnal) ? (sectionPaths.get(hymnal.id)?.get(number) ?? []) : [];

export const hymnRange = (hymnal: Hymnal): [number, number] => [
  hymnal.hymns[0].number,
  hymnal.hymns[hymnal.hymns.length - 1].number,
];

/**
 * Fold every apostrophe glyph to one.
 *
 * The two books disagree: the collection prints 1,810 curly apostrophes and no
 * straight ones, "Other Songs" 70 straight and no curly. Without folding, a
 * term containing an apostrophe can only ever match one of them — and iOS
 * smart punctuation means "'Tis So Sweet" was unfindable by its own first word.
 */
export const foldQuotes = (s: string): string => s.replace(/[\u2018\u2019\u201B`\u00B4]/g, "'");

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

// Search. The engine itself lives in ./search.ts, free of the app, so it can be
// tested on its own; everything below wires it to the registered books. The
// import sits with the code that uses it.
import {
  buildIndex,
  highlightRanges,
  normalize,
  search,
  type BookIndex,
  type MatchedOn,
} from "./search";

// So components take everything search-related from this one module.
export { highlightRanges, normalize };
export type { MatchedOn };

/**
 * One hymn a search turned up, and why.
 *
 * Search is forgiving — punctuation, "ev'ry" for "every", small typos, a phrase
 * that wraps onto the next line — so a result says how it matched. The UI can
 * then show the line that matched instead of an unexplained hymn, and say so
 * when it is only a close match.
 */
export interface SearchResult {
  hymn: Hymn;
  /** Which book this came from. Always set, so callers never have to guess. */
  hymnal: Hymnal;
  /**
   * For a match in the words: the line that matched and the one after it, as
   * printed, joined with " / ". Null for every other kind of match.
   */
  snippet: string | null;
  matchedOn: MatchedOn;
  /** True when the match needed typo tolerance, so the UI can say "close match". */
  fuzzy: boolean;
}

/** Built the first time a book is searched, then kept. */
const searchIndexes = new WeakMap<Hymnal, BookIndex>();

function searchIndex(hymnal: Hymnal): BookIndex {
  let index = searchIndexes.get(hymnal);
  if (!index) {
    index = buildIndex({ id: hymnal.id, numbered: isNumbered(hymnal), hymns: hymnal.hymns });
    searchIndexes.set(hymnal, index);
  }
  return index;
}

/**
 * Search the books at once, merged by how well each result matches rather than
 * book by book, and say how many there were before `limit` cut the list so the
 * UI can write "Showing 40 of 64".
 *
 * The books are searched in registry order, which is also how ties break: the
 * collection before "Other Songs", then by number. Pass `bookIds` to leave
 * books out.
 *
 *  - Numbers ("26", "#26", "hymn 26") look up the hymn, then every number that
 *    starts that way — but only in books whose numbers mean something.
 *  - Words match as a phrase, with the last word allowed to be unfinished, so
 *    "come thou fo" is already finding hymn 84.
 *  - If nothing matches as typed, close matches are tried: typos, a word left
 *    out, a word swapped.
 */
export function searchBooks(
  query: string,
  opts: { bookIds?: string[]; limit?: number } = {},
): { results: SearchResult[]; total: number } {
  const wanted = opts.bookIds;
  const books = wanted ? HYMNALS.filter((hymnal) => wanted.includes(hymnal.id)) : HYMNALS;
  return searchIn(books, query, opts.limit ?? 40);
}

function searchIn(
  books: Hymnal[],
  query: string,
  limit: number,
): { results: SearchResult[]; total: number } {
  const { hits, total } = search(books.map(searchIndex), query, { limit });

  const results: SearchResult[] = [];
  for (const hit of hits) {
    const hymnal = books.find((book) => book.id === hit.bookId);
    const hymn = hymnal && getHymn(hymnal, hit.number);
    if (!hymnal || !hymn) continue;
    results.push({
      hymn,
      hymnal,
      snippet: hit.snippet,
      matchedOn: hit.matchedOn,
      fuzzy: hit.fuzzy,
    });
  }
  return { results, total };
}

/**
 * Search one book, or every registered book at once.
 *
 * Kept as two functions rather than a flag because the default has to stay the
 * safe one. Mid-service, someone typing a number wants their own hymnal's 26,
 * not a list of every 26 in every book — so single-book search is what the
 * keypad and the default search use, and crossing books is a deliberate act.
 *
 * Both are thin wrappers over the same search as `searchBooks`, which is the one
 * to use when the UI wants the total as well.
 */
export function searchAllHymnals(query: string, limit = 60): SearchResult[] {
  return searchIn(HYMNALS, query, limit).results;
}

export function searchHymns(hymnal: Hymnal, query: string, limit = 40): SearchResult[] {
  return searchIn([hymnal], query, limit).results;
}

/** Alphabetical author index: every attributed author and their hymns. */
export interface AuthorEntry {
  author: string;
  hymns: Hymn[];
}

export type AuthorSort = "count" | "name";

export function authorIndex(hymnal: Hymnal, sort: AuthorSort = "count"): AuthorEntry[] {
  const grouped = new Map<string, Hymn[]>();
  for (const hymn of hymnal.hymns) {
    if (!hymn.author) continue;
    if (!grouped.has(hymn.author)) grouped.set(hymn.author, []);
    grouped.get(hymn.author)!.push(hymn);
  }
  return [...grouped.entries()]
    .map(([author, hymns]) => ({ author, hymns }))
    .sort((a, b) =>
      // By count, the index opens on the writers the book actually leans on —
      // Watts and Wesley account for a large share of it. Ties fall back to
      // surname so the ordering is stable and still reads like an index.
      sort === "count"
        ? b.hymns.length - a.hymns.length || surname(a.author).localeCompare(surname(b.author))
        : surname(a.author).localeCompare(surname(b.author)),
    );
}

/** Sort "Isaac Watts" under W, the way a printed author index reads. */
const surname = (name: string): string => name.trim().split(/\s+/).at(-1) ?? name;

/** How many hymns still have no attribution, for the index's footnote. */
export const unattributedCount = (hymnal: Hymnal): number =>
  hymnal.hymns.filter((h) => !h.author).length;

/**
 * The same number in the other books.
 *
 * A dead number is a dead end today: type 700 in a book that stops at 558 and
 * the pad just says there is no such hymn. But the person typing knows a number
 * they heard called out, and it is far more likely they are in the wrong book
 * than that they misheard — so look before saying no.
 */
export function findInOtherHymnals(
  number: number,
  exceptId: string,
): { hymnal: Hymnal; hymn: Hymn }[] {
  const found: { hymnal: Hymnal; hymn: Hymn }[] = [];
  for (const hymnal of HYMNALS) {
    if (hymnal.id === exceptId) continue;
    const hymn = getHymn(hymnal, number);
    if (hymn) found.push({ hymnal, hymn });
  }
  return found;
}
