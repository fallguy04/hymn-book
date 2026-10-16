/**
 * The search engine behind the hymnal's search box.
 *
 * Pure and dependency-free on purpose: no runtime imports, so it runs unchanged
 * in the browser bundle, under `node --test` (Node strips the types natively),
 * and in a worker if it ever needs to. `lib/hymnals.ts` wires it to the real
 * books; nothing in here knows the books exist.
 *
 * The owner's brief was "only worry about text and search for close matches".
 * The people typing are a congregation on phones, mostly from memory, so the
 * engine forgives everything a printed book does that a person would not:
 * punctuation ("Holy, Holy, Holy!"), elided spellings ("ev'ry", "heav'n",
 * "o'er", "'tis"), British spellings ("saviour"), line breaks in the middle of
 * a phrase, and small typos.
 *
 * Shape of the module, top to bottom:
 *   1. normalize     — one function that turns any text into comparable words
 *   2. buildIndex    — per-book index, built once
 *   3. search        — number lookups, phrase / any-order matching, ranking
 *   4. highlightRanges — where to put <mark> in the original text
 */

/* ------------------------------------------------------------------------ */
/* 1. Normalisation                                                          */
/* ------------------------------------------------------------------------ */

/** Every glyph a keyboard or a typesetter uses for an apostrophe. */
const APOSTROPHES = /[\u2018\u2019\u201B\u02BC`\u00B4]/g;

const ASCII = /^[\x00-\x7f]*$/;

/** Letters NFKD leaves whole, folded by hand. */
const LETTER_FOLDS: Record<string, string> = {
  æ: "ae",
  œ: "oe",
  ß: "ss",
  ø: "o",
  đ: "d",
  ł: "l",
  ı: "i",
};

/**
 * Lowercase, strip diacritics, and make every apostrophe a plain one.
 *
 * Apostrophes are folded first: U+00B4 (acute accent) has a compatibility
 * decomposition into a space and a combining mark, so letting NFKD see it first
 * would turn "ev´ry" into "ev ́ry".
 */
function fold(s: string): string {
  s = s.replace(APOSTROPHES, "'");
  if (ASCII.test(s)) return s.toLowerCase();
  return s
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[æœßøđłı]/g, (c) => LETTER_FOLDS[c]);
}

/**
 * Words the books spell with an apostrophe that stands for dropped letters,
 * and the word they mean. Whole-word, after folding.
 *
 * Derived from a scan of every apostrophised word in both books (about 680
 * spellings, 550 distinct once the case and the curl of the apostrophe are
 * folded), each checked against a dictionary. The generic rules in `expandWord`
 * cover the regular shapes — "lov'd" → "loved", "heav'n" → "heaven" — so this
 * table is only the words they get wrong, plus the bare fragments the printer
 * left dangling ("th'", "thro'").
 */
const ELISIONS: Record<string, string> = {
  // Bare fragments with the apostrophe at the end.
  "th'": "the",
  "t'": "to",
  "thro'": "through",
  "tho'": "though",
  "altho'": "although",
  // A vowel other than "e" went missing, or none did.
  "vict'ry": "victory",
  "mem'ry": "memory",
  "mem'": "memory",
  "hist'ries": "histories",
  "treas'ry": "treasury",
  "rapt'rous": "rapturous",
  "tim'rous": "timorous",
  "pois'nous": "poisonous",
  "glor'ous": "glorious",
  "vig'rous": "vigorous",
  "tempest'ous": "tempestuous",
  "ign'rance": "ignorance",
  "commem'rate": "commemorate",
  "wond'rous": "wondrous",
  "conq'ror": "conqueror",
  "conq'rors": "conquerors",
  "conqu'ror": "conqueror",
  "conq'ring": "conquering",
  "conqu'ring": "conquering",
  "streng'th": "strength",
  "tho't": "thought",
  "abra'am": "abraham",
  "beth'lem": "bethlehem",
  "heavn'ly": "heavenly",
  "heaven'ly": "heavenly",
  "darkn'd": "darkened",
  "carry'd": "carried",
  "cans't": "canst",
  "towr's": "towers",
  "powr's": "powers",
  "pow'": "power",
  "pris'ners": "prisoners",
  "pard'ning": "pardoning",
  "murm'ring": "murmuring",
  "lab'rer": "laborer",
  "lab'rers": "laborers",
  "glit'ring": "glittering",
  "calv'ry": "calvary",
  "sorr'wing": "sorrowing",
  "foll'wing": "following",
  "foll'wer": "follower",
  "tort'ring": "torturing",
};

/** Leading apostrophes that stand for a dropped first syllable. */
const LEADING_ELISIONS: Record<string, string> = {
  "'tis": "tis",
  "'twas": "twas",
  "'twill": "twill",
  "'twould": "twould",
  "'twere": "twere",
  "'mid": "amid",
  "'midst": "midst",
  "'round": "round",
  "'neath": "beneath",
  "'scape": "escape",
  "'till": "till",
  "'gainst": "against",
  "'bove": "above",
  "'bout": "about",
  "'cause": "because",
};

/**
 * Spelling variants, applied after elisions so "o'er" and "oer" end up at the
 * same place. Includes the apostrophe-free forms of elisions that are too short
 * for typo tolerance to rescue ("oer" is three letters; fuzzy matching starts
 * at four).
 */
const SPELLINGS: Record<string, string> = {
  oh: "o", // "OH, for a thousand tongues" is what people sing as "O for a thousand tongues"
  oer: "over",
  eer: "ever",
  neer: "never",
  een: "even",
  thro: "through",
  tho: "though",
  altho: "although",
  blest: "blessed",
  mid: "amid",
  neath: "beneath",
  amidst: "midst",
  amongst: "among",
  whilst: "while",
  towards: "toward",
  upwards: "upward",
  downwards: "downward",
  afterwards: "afterward",
  halleluiah: "hallelujah",
  hallelujahs: "hallelujah",
  alleluia: "hallelujah",
  hosannah: "hosanna",
  imanuel: "immanuel",
  emmanuel: "immanuel",
  emanuel: "immanuel",
  sceptre: "scepter",
  sceptres: "scepters",
  lustre: "luster",
  centre: "center",
  centres: "centers",
  mould: "mold",
  moulds: "molds",
  moulder: "molder",
  mouldering: "moldering",
  grey: "gray",
  defence: "defense",
  offence: "offense",
  pretence: "pretense",
  fulfil: "fulfill",
  enrol: "enroll",
  judgement: "judgment",
  judgements: "judgments",
  plough: "plow",
  ploughed: "plowed",
  ploughing: "plowing",
  jewelled: "jeweled",
  travelled: "traveled",
  traveller: "traveler",
  travellers: "travelers",
  travelling: "traveling",
};

/** British "-our" → American "-or" for the words that actually take it. */
const OUR_WORDS =
  /^(dis)?(hon|fav|col|lab|neighb|endeav|vig|rig|harb|od|splend|ferv|ard|val|hum|behavi|clam|parl|tum|rum|succ|arm|cand|sav|savi|flav|ranc|vap|demean)our(s|ed|ing|er|ers|able|ably|ite|ites|ful|less|y)?$/;

/** British "-ise" → American "-ize" for the verbs people actually write. */
const ISE_WORDS =
  /^(baptis|realis|organis|sympathis|recognis|tranquil+is|civilis|criticis|evangelis|harmonis|immortalis|solemnis|authoris|apologis|emphasis|characteris|memorialis|spiritualis|patronis|utilis)(e|es|ed|ing)$/;

function spell(w: string): string {
  const direct = SPELLINGS[w];
  if (direct !== undefined) return direct;
  if (w.length > 4 && w.includes("our") && OUR_WORDS.test(w)) return w.replace("our", "or");
  if (w.length > 5 && ISE_WORDS.test(w)) return w.replace("is", "iz");
  return w;
}

/** Pronouns that take 'd as "would"/"had" — a contraction, not a participle. */
const PRONOUN_D = /^(i|we|you|he|she|they|who|it|that|there|what|where|how)'d$/;

/**
 * One word as the books or a person typed it → the word(s) it stands for, with
 * no apostrophes. Can return more than one word separated by a space. Expects
 * folded input.
 */
function expandWord(w: string, aliases = true): string {
  const respell = aliases ? spell : (x: string) => x;
  if (w.indexOf("'") === -1) return respell(w);

  const whole = ELISIONS[w];
  if (whole !== undefined) return whole;

  // A trailing apostrophe is a closing quote, a possessive plural ("Jesus'")
  // or a word the printer cut short. None of them mean extra letters.
  w = w.replace(/'+$/, "");
  if (w.charCodeAt(0) === 39 /* ' */) {
    const lead = LEADING_ELISIONS[w];
    if (lead !== undefined) return lead;
    w = w.replace(/^'+/, ""); // an opening quote: 'How long?'
  }
  if (w.indexOf("'") === -1) return respell(w);

  const known = ELISIONS[w];
  if (known !== undefined) return known;

  // Th'eternal, th'angelic: "the" with its vowel run into the next word.
  if (w.startsWith("th'") && /^[aeiouy]/.test(w.slice(3))) return "the " + expandWord(w.slice(3), aliases);

  // Poetic contractions of over, ever and even, alone or inside a longer word:
  // o'er, o'erflow, ne'er, whate'er, e'en.
  w = w.replace(/o'er/g, "over").replace(/e'er/g, "ever").replace(/e'en/g, "even");

  if (w.endsWith("'s")) {
    // Possessives (and the printer's "he's", "it's") just lose the apostrophe,
    // after the word itself has had its own elisions undone: Calv'ry's → calvarys.
    const base = expandWord(w.slice(0, -2), aliases);
    return base.indexOf(" ") === -1 ? base + "s" : base;
  } else if (PRONOUN_D.test(w)) {
    w = w.replace("'", ""); // I'd → id
  } else if (w.endsWith("'d")) {
    w = w.slice(0, -2) + "ed"; // lov'd → loved, bless'd → blessed
  } else if (/n't$|'(ll|re|ve|m|st|lt)$/.test(w)) {
    w = w.replace("'", ""); // can't, I'll, we're, I've, I'm, may'st, thou'lt
  }

  // What is left is a vowel swallowed mid-word: heav'n, giv'n, ev'ry, pow'r,
  // wand'ring. In the overwhelming majority it was an "e".
  return respell(w.replace(/'/g, "e"));
}

/** Hymn text repeats itself endlessly; remember what each spelling became. */
const expanded = new Map<string, string>();

function expandCached(raw: string): string {
  let norm = expanded.get(raw);
  if (norm === undefined) {
    if (expanded.size > 30000) expanded.clear(); // queries are user input; bound the memory
    norm = expandWord(fold(raw));
    expanded.set(raw, norm);
  }
  return norm;
}

/** A word found in a piece of text, located in the *original* string. */
interface Word {
  start: number;
  end: number;
  /** Normalised form: one or more space-separated words, never empty. */
  norm: string;
  /** The spelling it was made from, with its repairs but before any alias. */
  raw: string;
}

const CHUNK = /[\p{L}\p{M}\p{N}'\u2018\u2019\u201B\u02BC`\u00B4]+/gu;

/** The little pieces a printer's stray space splits a word into. */
const STRAY_TAILS = new Set(["s", "d", "r", "rs", "ry"]);

/** Hyphenations the books keep and nobody types any more: "To-day" is "today". */
const HYPHENATED: Record<string, string> = {
  "to-day": "today",
  "to-morrow": "tomorrow",
  "to-night": "tonight",
};

/**
 * Find the words in `text`.
 *
 * A word is a run of letters and digits with apostrophes allowed anywhere in
 * it, so "ev’ry" and "'Tis" stay whole. The books have a few scanning glitches
 * that would otherwise split words in two, and they are repaired here rather
 * than in the data: "Christian ‘s", "Appear’ d", "pow’ r", "‘T is".
 */
function scan(text: string): Word[] {
  const chunks: { start: number; end: number; raw: string }[] = [];
  CHUNK.lastIndex = 0;
  for (let m = CHUNK.exec(text); m !== null; m = CHUNK.exec(text)) {
    chunks.push({ start: m.index, end: m.index + m[0].length, raw: m[0] });
  }

  const words: Word[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const { start } = chunks[i];
    let { end, raw } = chunks[i];
    const next = chunks[i + 1];
    if (next && next.start === end + 1 && text.charCodeAt(end) === 45 /* - */) {
      const compound = HYPHENATED[fold(raw) + "-" + fold(next.raw)];
      if (compound !== undefined) {
        words.push({ start, end: next.end, norm: compound, raw: compound });
        i++;
        continue;
      }
    }
    if (next && next.start === end + 1 && text.charCodeAt(end) === 32) {
      const a = fold(raw);
      const b = fold(next.raw);
      const joined =
        (/[\p{L}]'$/u.test(a) && STRAY_TAILS.has(b)) || // Appear' d, pow' r
        (/\p{L}$/u.test(a) && (b === "'s" || b === "'d")) || // Christian 's
        (a === "'t" && b === "is"); // 'T is
      if (joined) {
        raw += next.raw;
        end = next.end;
        i++;
      }
    }
    const norm = expandCached(raw);
    if (norm) words.push({ start, end, norm, raw });
  }
  return words;
}

/**
 * Text → comparable text: lowercase, no diacritics, hymnal elisions expanded
 * ("ev’ry" → "every", "o'er" → "over"), British spellings Americanised, and
 * every other non-letter, non-digit turned into a single space.
 */
export function normalize(text: string): string {
  return scan(text)
    .map((w) => w.norm)
    .join(" ");
}

/** Normalised words of a string, one array entry per word. */
function words(text: string): string[] {
  const out: string[] = [];
  for (const w of scan(text)) {
    if (w.norm.indexOf(" ") === -1) out.push(w.norm);
    else out.push(...w.norm.split(" "));
  }
  return out;
}

/**
 * The words of a query, plus one more spelling of its last word.
 *
 * The last word is probably unfinished, and a spelling alias can swallow the
 * unfinished form: "tho" is on its way to "thou" but means "though", "thro" is
 * on its way to "throne". So when an alias changed the last word, the spelling
 * it was typed in is kept as well, and either one may match.
 */
function queryWords(text: string): { tokens: string[]; lastAlt: string | null } {
  const scanned = scan(text);
  const tokens: string[] = [];
  for (const w of scanned) {
    if (w.norm.indexOf(" ") === -1) tokens.push(w.norm);
    else tokens.push(...w.norm.split(" "));
  }
  if (tokens.length > MAX_TOKENS) return { tokens: tokens.slice(0, MAX_TOKENS), lastAlt: null };

  let lastAlt: string | null = null;
  if (scanned.length > 0) {
    const typed = expandWord(fold(scanned[scanned.length - 1].raw), false).split(" ").pop();
    if (typed && typed !== tokens[tokens.length - 1]) lastAlt = typed;
  }
  return { tokens, lastAlt };
}

/**
 * Names only. Strips years ("Henry F. Lyte, 1847" → "Henry F. Lyte") and
 * everything from a translator or composer credit onward, so a search for "73"
 * can't land on "1873" and "Seiss" isn't mistaken for an author.
 */
export function authorName(author: string | null | undefined): string {
  if (!author) return "";
  return author
    .replace(/\b(?:translat\w*|music)\b[\s\S]*$/i, "")
    .replace(/\bc\.?\s*(?=\d{4})/gi, "")
    .replace(/\b\d{4}\b/g, " ")
    .replace(/\bpublished\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/[\s,;:.]+$/, ""); // what the dates were hanging from
}

/* ------------------------------------------------------------------------ */
/* 2. Index                                                                  */
/* ------------------------------------------------------------------------ */

/** Which part of a hymn a result was found in. */
export type MatchedOn = "number" | "firstLine" | "title" | "author" | "text";

/** The part of a hymn this engine reads. `Hymn` in hymnals.ts satisfies it. */
export interface SearchableHymn {
  number: number;
  /** Empty for the hymns the book leaves untitled. */
  title: string;
  author: string | null;
  /** Stanzas of lines; lines may carry leading tabs for indentation. */
  stanzas: string[][];
}

/** The part of a book this engine reads. `Hymnal` in hymnals.ts satisfies it. */
export interface SearchableBook {
  id: string;
  /** Does a hymn's number mean anything to the reader? Absent means yes. */
  numbered?: boolean;
  hymns: SearchableHymn[];
}

/**
 * One hymn, prepared for searching.
 *
 * The strings are what a person (or a test) can read; the typed arrays are the
 * same text as ids into the book's vocabulary, which is what matching actually
 * walks — an integer compare per word instead of a string compare.
 */
export interface IndexEntry {
  number: number;
  /** What the app shows as the hymn's name: the title, else the first line. */
  displayTitle: string;
  /** Normalised first line (just the first line, not the line after it). */
  firstLine: string;
  /** Normalised title; empty when the hymn is untitled. */
  title: string;
  /** Normalised author *name* — no years, no translator credits. */
  author: string;
  /**
   * The whole text, one normalised string per stanza with its lines joined by
   * spaces, so a phrase that wraps onto the next line still matches.
   */
  stanzaText: string[];
  /** The original lines of each stanza, tabs stripped, for snippets. */
  lines: string[][];

  // Word ids — see above.
  fl: Int32Array;
  ti: Int32Array;
  au: Int32Array;
  st: Int32Array[];
  /** For each stanza, the word offset at which each line starts. */
  ls: Int32Array[];
}

/** A book, indexed. Build once; searching never mutates the entries. */
export interface BookIndex {
  id: string;
  numbered: boolean;
  entries: IndexEntry[];
  /** id → word */
  vocab: string[];
  /** word → id */
  ids: Map<string, number>;
  /** Per-token match tables, kept so each keystroke only pays for what changed. */
  cache: Map<string, Uint8Array>;
}

const stripTabs = (line: string): string => line.replace(/^\t+/, "");

/** Build the search index for one book. */
export function buildIndex(book: SearchableBook): BookIndex {
  const vocab: string[] = [];
  const ids = new Map<string, number>();
  const intern = (w: string): number => {
    let id = ids.get(w);
    if (id === undefined) {
      id = vocab.length;
      vocab.push(w);
      ids.set(w, id);
    }
    return id;
  };
  const toIds = (ws: string[]): Int32Array => Int32Array.from(ws, intern);

  const entries: IndexEntry[] = book.hymns.map((hymn) => {
    const lines = hymn.stanzas.map((stanza) => stanza.map(stripTabs));
    const st: Int32Array[] = [];
    const ls: Int32Array[] = [];
    const stanzaText: string[] = [];
    let firstLineWords: string[] = [];

    lines.forEach((stanza, si) => {
      const all: number[] = [];
      const starts: number[] = [];
      const parts: string[] = [];
      stanza.forEach((line, li) => {
        const ws = words(line);
        if (si === 0 && li === 0) firstLineWords = ws;
        starts.push(all.length);
        for (const w of ws) all.push(intern(w));
        if (ws.length) parts.push(ws.join(" "));
      });
      st.push(Int32Array.from(all));
      ls.push(Int32Array.from(starts));
      stanzaText.push(parts.join(" "));
    });

    const titleWords = words(hymn.title);
    const authorWords = words(authorName(hymn.author));
    return {
      number: hymn.number,
      displayTitle: hymn.title || lines[0]?.[0] || `Hymn ${hymn.number}`,
      firstLine: firstLineWords.join(" "),
      title: titleWords.join(" "),
      author: authorWords.join(" "),
      stanzaText,
      lines,
      fl: toIds(firstLineWords),
      ti: toIds(titleWords),
      au: toIds(authorWords),
      st,
      ls,
    };
  });

  return { id: book.id, numbered: book.numbered !== false, entries, vocab, ids, cache: new Map() };
}

/* ------------------------------------------------------------------------ */
/* 3. Search                                                                 */
/* ------------------------------------------------------------------------ */

export interface Hit {
  bookId: string;
  number: number;
  /** Higher is better. Only meaningful relative to other scores from one call. */
  score: number;
  matchedOn: MatchedOn;
  /** True when the match needed typo tolerance. */
  fuzzy: boolean;
  /**
   * For text matches: the line that matched and the one after it, from the
   * original text, joined with " / ". Null for every other kind of match.
   */
  snippet: string | null;
}

export interface SearchOptions {
  /** Most hits to return. The total is always the full count. Default 40. */
  limit?: number;
}

export interface SearchOutput {
  hits: Hit[];
  /** How many hymns matched before `limit` was applied. */
  total: number;
}

/** A query past this many words is the same query to anyone who typed it. */
const MAX_TOKENS = 30;

/** Fewer words than this and ignoring one leaves too little to trust. */
const MIN_WORDS_TO_DROP_ONE = 3;

/** ...and of those that are left, this many must be words of four letters or more. */
const MIN_SUBSTANTIAL_WORDS_LEFT = 2;

/** "26", "#26", "hymn 26", "no. 26", "number 26" — the prefixes can stack. */
const NUMBER_QUERY = /^\s*(?:(?:hymns?|numbers?|nums?|no|nr)\b\.?\s*)*(?:#\s*)?(\d{1,4})\s*$/i;

interface ParsedQuery {
  tokens: string[];
  /** See `queryWords`. */
  lastAlt: string | null;
  /** The number being asked for, as a string, when the query is number-like. */
  number: string | null;
}

function parseQuery(raw: string): ParsedQuery {
  const m = NUMBER_QUERY.exec(raw);
  if (m) {
    // Books without meaningful numbers fall back to a text search for the figures.
    return { tokens: [m[1]], lastAlt: null, number: String(parseInt(m[1], 10)) };
  }
  return { ...queryWords(raw), number: null };
}

/** How many edits a typed word may be off by: none under 4 letters, 1 to 7, 2 beyond. */
function allowedEdits(token: string): number {
  if (token.length < 4 || /\d/.test(token)) return 0;
  return token.length >= 8 ? 2 : 1;
}

/**
 * Is the Damerau–Levenshtein distance (adjacent swaps count as one edit) from
 * `a` to `b` at most `max`? Bails out as soon as no alignment can get there.
 */
function withinEdits(a: string, b: string, max: number): boolean {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return false;
  if (a === b) return true;

  let prev2: number[] = [];
  let prev: number[] = [];
  for (let j = 0; j <= lb; j++) prev.push(j);
  for (let i = 1; i <= la; i++) {
    const row: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (
        i > 1 &&
        j > 1 &&
        a.charCodeAt(i - 1) === b.charCodeAt(j - 2) &&
        a.charCodeAt(i - 2) === b.charCodeAt(j - 1)
      ) {
        d = Math.min(d, prev2[j - 2] + 1);
      }
      row.push(d);
      if (d < rowMin) rowMin = d;
    }
    if (rowMin > max) return false;
    prev2 = prev;
    prev = row;
  }
  return prev[lb] <= max;
}

/**
 * Does `word` count as the typed `token`? The last token is what the person is
 * still typing, so it may be only the start of a word.
 */
function wordMatches(token: string, word: string, last: boolean, fuzzy: boolean): boolean {
  if (word === token || (last && word.startsWith(token))) return true;
  if (!fuzzy) return false;
  const edits = allowedEdits(token);
  if (edits === 0) return false;
  if (withinEdits(token, word, edits)) return true;
  // Mid-typing *and* a typo: compare against the same number of letters.
  return last && word.length > token.length && withinEdits(token, word.slice(0, token.length), edits);
}

/**
 * For one token, which of the book's words match it: 1 exact (or a prefix, for
 * the last token), 2 only with typo tolerance, 0 not at all.
 */
function tokenTable(ix: BookIndex, token: string, last: boolean, fuzzy: boolean): Uint8Array {
  const key = `${fuzzy ? "~" : "="}${last ? "$" : "^"}${token}`;
  const cached = ix.cache.get(key);
  if (cached) return cached;

  const { vocab } = ix;
  const table = new Uint8Array(vocab.length);
  const exact = ix.ids.get(token);
  if (exact !== undefined) table[exact] = 1;
  if (last) {
    for (let i = 0; i < vocab.length; i++) if (vocab[i].startsWith(token)) table[i] = 1;
  }
  if (fuzzy && allowedEdits(token) > 0) {
    for (let i = 0; i < vocab.length; i++) {
      if (table[i] === 0 && wordMatches(token, vocab[i], last, true)) table[i] = 2;
    }
  }

  if (ix.cache.size > 400) ix.cache.clear();
  ix.cache.set(key, table);
  return table;
}

/**
 * "ev ry" → "every". Someone who types the book's words without its
 * punctuation may put a space where the book has an apostrophe ("heav nly",
 * "o er", "death s", "to day"). Two neighbouring words are joined only when the
 * result is a word this book actually has, so ordinary queries are untouched.
 */
function glueSplitWords(ix: BookIndex, tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const next = tokens[i + 1];
    if (next !== undefined && next.length <= 6) {
      const joined = HYPHENATED[tokens[i] + "-" + next] ?? expandWord(tokens[i] + "'" + next);
      if (joined.indexOf(" ") === -1 && ix.ids.has(joined)) {
        out.push(joined);
        i++;
        continue;
      }
    }
    out.push(tokens[i]);
  }
  return out;
}

/** Everything `evaluate` needs about one query against one book. */
interface Plan {
  n: number;
  /** Bit k is set for token k. */
  full: number;
  /** Per vocabulary id: which tokens it can stand for, as a bit set. */
  pm: Int32Array;
  /** A token position that matches any word at all, or -1. For misremembered words. */
  wild: number;
}

function makePlan(
  ix: BookIndex,
  tokens: string[],
  lastAlt: string | null,
  fuzzy: boolean,
  wild = -1,
): Plan {
  const n = tokens.length;
  const pm = new Int32Array(ix.vocab.length);
  const add = (table: Uint8Array, k: number) => {
    for (let i = 0; i < table.length; i++) if (table[i] !== 0) pm[i] |= 1 << k;
  };
  tokens.forEach((token, k) => {
    if (k === wild) return;
    add(tokenTable(ix, token, k === n - 1, fuzzy), k);
    if (k === n - 1 && lastAlt !== null) add(tokenTable(ix, lastAlt, true, fuzzy), k);
  });
  return { n, full: (1 << n) - 1, pm, wild };
}

/** Index of the first place the tokens appear in order, side by side, or -1. */
function findPhrase(w: Int32Array, plan: Plan): number {
  const { n, pm, wild } = plan;
  for (let i = 0, end = w.length - n; i <= end; i++) {
    let k = 0;
    while (k < n && (k === wild || (pm[w[i + k]] & (1 << k)) !== 0)) k++;
    if (k === n) return i;
  }
  return -1;
}

function startsWithPhrase(w: Int32Array, plan: Plan): boolean {
  if (w.length < plan.n) return false;
  for (let k = 0; k < plan.n; k++) {
    if (k !== plan.wild && (plan.pm[w[k]] & (1 << k)) === 0) return false;
  }
  return true;
}

/** Are all the tokens present somewhere in `w`, in any order? */
function hasAllTokens(w: Int32Array, plan: Plan): boolean {
  let seen = 0;
  for (let i = 0; i < w.length; i++) {
    seen |= plan.pm[w[i]];
    if (seen === plan.full) return true;
  }
  return false;
}

/**
 * Base score of each ranking level, best first. Fuzzy matches use a tenth of
 * it, so *every* exact level outranks *every* fuzzy one — and the tie-breaking
 * bonus (always under 10, scaled along with it) never lifts a hymn past the
 * level above it.
 *
 *   1 phrase at the start of the first line      5 phrase anywhere in the text
 *   2 phrase at the start of the title           6 all words in first line / title
 *   3 phrase anywhere in the first line          7 author
 *   4 phrase anywhere in the title               8 all words in one stanza
 */
const LEVEL_SCORE = [0, 800, 700, 600, 500, 400, 300, 200, 100];

/**
 * How a match was found, which sets how far its score is scaled down:
 * as typed, with typo tolerance, or with one of the typed words ignored.
 */
type Mode = 0 | 1 | 2;
const MODE_DIVISOR = [1, 10, 100];
const NUMBER_EXACT = 10000;
const NUMBER_PREFIX = 9000;

interface Scored {
  book: number;
  entry: IndexEntry;
  score: number;
  on: MatchedOn;
  fuzzy: boolean;
  /** For text matches: which stanza and which line in it. */
  stanza: number;
  line: number;
}

const lineOf = (starts: Int32Array, word: number): number => {
  let line = 0;
  for (let k = 0; k < starts.length && starts[k] <= word; k++) line = k;
  return line;
};

/**
 * Score one hymn against a plan. Null when no level matches. `lastLevel` cuts
 * the ladder short for the loosest searches, which must at least be a phrase.
 */
function evaluate(book: number, e: IndexEntry, plan: Plan, mode: Mode, lastLevel = 8): Scored | null {
  const { n } = plan;
  const fuzzy = mode > 0;
  const done = (
    level: number,
    on: MatchedOn,
    cover: number,
    extra: number,
    stanza = -1,
    line = -1,
  ): Scored => ({
    book,
    entry: e,
    score: (LEVEL_SCORE[level] + 5 * Math.min(1, cover) + extra) / MODE_DIVISOR[mode],
    on,
    fuzzy,
    stanza,
    line,
  });

  const first = e.st[0];

  // 1. The phrase opens the hymn — the single best sign it is the one wanted.
  //    A phrase that runs on into the second line still opens the first.
  if (first && startsWithPhrase(first, plan)) {
    const alsoTitle = e.ti.length > 0 && findPhrase(e.ti, plan) >= 0;
    return done(1, "firstLine", n / Math.max(1, e.fl.length), alsoTitle ? 2.5 : 0);
  }
  // 2. The phrase opens the title.
  if (e.ti.length > 0 && startsWithPhrase(e.ti, plan)) {
    const alsoFirst = findPhrase(e.fl, plan) >= 0;
    return done(2, "title", n / e.ti.length, alsoFirst ? 2.5 : 0);
  }
  // 3. The phrase is somewhere in the first line.
  if (findPhrase(e.fl, plan) >= 0) {
    const alsoTitle = e.ti.length > 0 && findPhrase(e.ti, plan) >= 0;
    return done(3, "firstLine", n / Math.max(1, e.fl.length), alsoTitle ? 2.5 : 0);
  }
  // 4. The phrase is somewhere in the title.
  if (e.ti.length > 0 && findPhrase(e.ti, plan) >= 0) {
    return done(4, "title", n / e.ti.length, 0);
  }
  // 5. The phrase is in the words, contiguous within a stanza (lines wrap freely).
  let firstStanza = -1;
  let at = 0;
  let stanzasWith = 0;
  for (let s = 0; s < e.st.length; s++) {
    const i = findPhrase(e.st[s], plan);
    if (i >= 0) {
      if (firstStanza < 0) {
        firstStanza = s;
        at = i;
      }
      stanzasWith++;
    }
  }
  if (firstStanza >= 0) {
    // A phrase that comes round again is the chorus, and a better guess.
    return done(
      5,
      "text",
      n / Math.max(1, e.st[firstStanza].length),
      Math.min(2, 0.5 * (stanzasWith - 1)),
      firstStanza,
      lineOf(e.ls[firstStanza], at),
    );
  }
  if (lastLevel < 6) return null;
  // 6. Every word is in the first line, or every word is in the title.
  if (hasAllTokens(e.fl, plan)) {
    return done(6, "firstLine", n / Math.max(1, e.fl.length), 0);
  }
  if (e.ti.length > 0 && hasAllTokens(e.ti, plan)) {
    return done(6, "title", n / e.ti.length, 0);
  }
  // 7. The author.
  if (e.au.length > 0 && hasAllTokens(e.au, plan)) {
    return done(7, "author", n / e.au.length, 0);
  }
  // 8. Every word is somewhere in one stanza.
  for (let s = 0; s < e.st.length; s++) {
    if (!hasAllTokens(e.st[s], plan)) continue;
    // Show the line holding the most of what was asked for.
    let best = 0;
    let bestCount = -1;
    const starts = e.ls[s];
    for (let k = 0; k < starts.length; k++) {
      const to = k + 1 < starts.length ? starts[k + 1] : e.st[s].length;
      let seen = 0;
      for (let i = starts[k]; i < to; i++) seen |= plan.pm[e.st[s][i]];
      let count = 0;
      for (let bits = seen; bits !== 0; bits &= bits - 1) count++;
      if (count > bestCount) {
        bestCount = count;
        best = k;
      }
    }
    return done(8, "text", n / Math.max(1, e.st[s].length), 0, s, best);
  }
  return null;
}

function snippetFor(e: IndexEntry, stanza: number, line: number): string {
  const lines = e.lines[stanza];
  // The matching line and the one that follows it; at the end of a stanza, the one before.
  const from = line + 1 < lines.length ? line : Math.max(0, line - 1);
  return lines.slice(from, from + 2).join(" / ");
}

/**
 * Search one or more indexed books. Results from every book are merged by
 * score; ties go to the earlier book, then the lower number.
 */
export function search(indexes: BookIndex[], query: string, options: SearchOptions = {}): SearchOutput {
  const limit = Math.max(0, options.limit ?? 40);
  const parsed = parseQuery(query);
  const found: Scored[] = [];
  const textBooks: number[] = [];

  indexes.forEach((ix, b) => {
    if (parsed.number === null || !ix.numbered) {
      textBooks.push(b);
      return;
    }
    // Number lookups: the exact number, then every number that starts with it.
    for (const entry of ix.entries) {
      const digits = String(entry.number);
      const exact = digits === parsed.number;
      if (!exact && !digits.startsWith(parsed.number)) continue;
      found.push({
        book: b,
        entry,
        score: exact ? NUMBER_EXACT : NUMBER_PREFIX,
        on: "number",
        fuzzy: false,
        stanza: -1,
        line: -1,
      });
    }
  });

  const { tokens } = parsed;
  if (tokens.length > 0 && textBooks.length > 0) {
    // The words as this book will read them: split-up words put back together.
    const queryFor = (b: number) => {
      const own = glueSplitWords(indexes[b], tokens);
      const sameEnd = own[own.length - 1] === tokens[tokens.length - 1];
      return { tokens: own, lastAlt: sameEnd ? parsed.lastAlt : null };
    };

    const runBook = (b: number, mode: Mode) => {
      const ix = indexes[b];
      const query = queryFor(b);
      const plan = makePlan(ix, query.tokens, query.lastAlt, mode > 0);
      for (const entry of ix.entries) {
        const hit = evaluate(b, entry, plan, mode);
        if (hit) found.push(hit);
      }
    };

    const before = found.length;
    for (const b of textBooks) runBook(b, 0);

    // Nothing matched as typed, so the person may have mistyped: look again,
    // tolerantly. Only then — otherwise a right answer for "watts" would arrive
    // with everything that says "wants" or "waits" trailing behind it.
    if (found.length === before && tokens.some((t) => allowedEdits(t) > 0)) {
      for (const b of textBooks) runBook(b, 1);
    }

    // Still nothing. People add a word that isn't there, or swap one for
    // another ("how sour the sound"), and the rest still points at the right
    // hymn. Try every way of dropping one word, or letting any word stand in
    // for it. Only a phrase counts, and only one with enough substance left:
    // "as I am" is in a hundred hymns and proves nothing about "just as I am".
    if (found.length === before && tokens.length >= MIN_WORDS_TO_DROP_ONE) {
      const best = new Map<IndexEntry, Scored>();
      const consider = (b: number, plan: Plan) => {
        for (const entry of indexes[b].entries) {
          const hit = evaluate(b, entry, plan, 2, 5);
          if (hit && hit.score > (best.get(entry)?.score ?? -1)) best.set(entry, hit);
        }
      };
      for (const b of textBooks) {
        const query = queryFor(b);
        const own = query.tokens;
        const substantial = own.filter((t) => t.length >= 4).length;
        for (let skip = 0; skip < own.length; skip++) {
          const left = substantial - (own[skip].length >= 4 ? 1 : 0);
          if (left < MIN_SUBSTANTIAL_WORDS_LEFT) continue;
          const rest = own.filter((_, k) => k !== skip);
          consider(b, makePlan(indexes[b], rest, skip === own.length - 1 ? null : query.lastAlt, true));
          consider(b, makePlan(indexes[b], own, query.lastAlt, true, skip));
        }
      }
      found.push(...best.values());
    }
  }

  found.sort((a, b) => b.score - a.score || a.book - b.book || a.entry.number - b.entry.number);

  const hits: Hit[] = found.slice(0, limit).map((f) => ({
    bookId: indexes[f.book].id,
    number: f.entry.number,
    score: f.score,
    matchedOn: f.on,
    fuzzy: f.fuzzy,
    snippet: f.on === "text" ? snippetFor(f.entry, f.stanza, f.line) : null,
  }));
  return { hits, total: found.length };
}

/* ------------------------------------------------------------------------ */
/* 4. Highlighting                                                           */
/* ------------------------------------------------------------------------ */

/**
 * Character ranges in `original` to wrap in <mark>: one per word that matches a
 * word of `query` — exactly, as the start of the last word (the one still being
 * typed), or, where the text holds no exact match for a query word, within
 * typo distance of it. Ranges index the original string, so they line up even
 * when the text spells "ev’ry" and the query says "every".
 */
export function highlightRanges(original: string, query: string): Array<[number, number]> {
  const { tokens, lastAlt } = queryWords(query);
  if (tokens.length === 0) return [];

  const found = scan(original).map((w) => ({ w, parts: w.norm.split(" ") }));
  const marked = new Set<number>();

  tokens.forEach((token, k) => {
    const last = k === tokens.length - 1;
    const forms = last && lastAlt !== null ? [token, lastAlt] : [token];
    let exact = false;
    found.forEach(({ parts }, i) => {
      if (parts.some((p) => forms.some((form) => wordMatches(form, p, last, false)))) {
        marked.add(i);
        exact = true;
      }
    });
    if (exact || allowedEdits(token) === 0) return;
    found.forEach(({ parts }, i) => {
      if (parts.some((p) => wordMatches(token, p, last, true))) marked.add(i);
    });
  });

  return [...marked]
    .sort((a, b) => a - b)
    .map((i): [number, number] => [found[i].w.start, found[i].w.end]);
}
