/**
 * Rebuild data/hymnals/brethren.json from eHymnbook.pdf.
 *
 *   node scripts/extract-hymns.mjs
 *
 * The hymnal is typeset so that structure is carried by geometry rather than
 * markup: hymn headings sit at x=72 while body text sits at x=81, and the text
 * leading is 15–16pt between lines of a stanza but 30–31pt between stanzas.
 * Reading those two signals is the whole job — and getting the second one
 * wrong is what produced the previous dataset, in which every stanza was
 * forced to four lines regardless of meter.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { extractPages } from "./pdf.mjs";
import { validate } from "./validate-hymns.mjs";

const PDF = "eHymnbook.pdf";
const OUT_DIR = "data/hymnals";
const OUT = `${OUT_DIR}/brethren.json`;
const AUTHORS = "data/authors.json";
const CORRECTIONS = "data/corrections.json";
const LEGACY = "data/hymns.legacy.json";

const HEADING_X = 76; // headings left of this; body right of it
const STANZA_GAP = 25; // leading above this starts a new stanza
const PAGE_NUMBER_X = 450; // contents-page numbers sit in the right margin
const LAST_HYMN = 558;

/** Ligatures come out of the CMap as single codepoints; spell them out. */
const normalize = (s) =>
  s.replace(/ﬀ/g, "ff").replace(/ﬁ/g, "fi").replace(/ﬂ/g, "fl")
    .replace(/ﬃ/g, "ffi").replace(/ﬄ/g, "ffl");

/**
 * Collapse the book's meter abbreviations. The printed text is inconsistent
 * about periods and spacing ("C.M.", "CM.", "C. M."), which silently broke
 * meter matching in the tune drawer.
 */
function normalizeMeter(raw) {
  let m = normalize(raw).trim().replace(/\s+/g, " ");
  // The book sets a lowercase L where it means a one: "l0s and 8s", "l2s".
  m = m.replace(/\bl(?=\ds\b)/g, "1");
  m = m.replace(/\bC\.?\s?M\.?\b/g, "C.M.")
    .replace(/\bL\.?\s?M\.?\b/g, "L.M.")
    .replace(/\bS\.?\s?M\.?\b/g, "S.M.")
    .replace(/\bH\.?\s?M\.?\b/g, "H.M.")
    .replace(/\bP\.?\s?M\.?\b/g, "P.M.")
    .replace(/\bC\.?\s?P\.?\s?M\.?\b/g, "C.P.M.")
    .replace(/\bS\.?\s?P\.?\s?M\.?\b/g, "S.P.M.");
  m = m.replace(/\s*,\s*/g, ", ").replace(/\s+\.$/, ".");
  // Some meters are printed with a trailing comma ("L.M,"); once the
  // abbreviation is expanded that leaves a stray ", ." to tidy away.
  m = m.replace(/,\s*\.?$/, ".").replace(/\.{2,}/g, ".");
  if (!/[.\]]$/.test(m)) m += ".";
  return m;
}

/**
 * The meter line is pushed to roughly column 21 with spaces. Body lines are
 * indented too, but never past six spaces, so the threshold cleanly separates
 * them without having to guess at meter spellings.
 */
const isMeterLine = (text) => /^ {12,}\S/.test(text);

/** Leading spaces encode the book's indentation; keep the depth, not the spaces. */
function indentOf(text) {
  const spaces = text.match(/^ */)[0].length;
  return Math.min(3, Math.floor(spaces / 2));
}

const clean = (s) => normalize(s).trim().replace(/\s+/g, " ");

// ---------------------------------------------------------------------------
// Pass 1 — walk every page and cut the stream into hymns
// ---------------------------------------------------------------------------

const pages = extractPages(PDF);

const HYMN_HEADING = /^(\d{1,3})(?:\s{2,}(.*))?$/;
const isSectionHeading = (t) => /^[A-Z][A-Z\s.,'’&-]+$/.test(t) && !/\d/.test(t);

/** "TABLE HYMNS.342   " — a section heading run into the next hymn's number. */
const SECTION_THEN_HYMN = /^([A-Z][A-Z\s,'’&-]*\.)\s*(\d{1,3}(?:\s{2,}.*)?)$/;

/**
 * Most headings sit at x=72, but a handful (139, 342) are typeset in the body
 * column, so position alone would drop them. The wide gap that always precedes
 * a heading is the second, independent signal.
 */
const HEADING_GAP = 32;

/** The body begins at the first page carrying hymn 1's heading. */
const firstBodyPage = pages.findIndex((page) =>
  page.some((l) => l.x <= HEADING_X && /^1\s{2,}\S/.test(normalize(l.text).trim())),
);
if (firstBodyPage < 1) {
  console.error("✗ could not locate the start of the hymn body");
  process.exit(1);
}

const hymns = [];
let current = null;
// Section headings also appear inline above the hymns they introduce. We index
// from the contents pages, but carrying the inline heading lets us cross-check
// the two against each other afterwards.
let pendingSection = null;

for (const page of pages.slice(firstBodyPage)) {
  let firstLineOfPage = true;

  for (const line of page) {
    const text = normalize(line.text);
    const trimmed = text.trim();
    if (!trimmed) continue;

    const isHeadingColumn = line.x <= HEADING_X;
    const pageBreak = firstLineOfPage;
    firstLineOfPage = false;

    // A section heading and the hymn heading beneath it can land on one
    // baseline — sometimes as separate runs, sometimes inside a single run
    // ("TABLE HYMNS.342   "). Peel the section label off either way.
    let headingText = trimmed;
    if (isHeadingColumn) {
      const split = trimmed.match(SECTION_THEN_HYMN);
      if (split) {
        pendingSection = split[1].replace(/\.$/, "");
        headingText = split[2].trim();
      } else if (line.runs.length > 1 && HYMN_HEADING.test(clean(line.runs.at(-1).text))) {
        for (const run of line.runs.slice(0, -1)) {
          const label = clean(run.text);
          if (isSectionHeading(label)) pendingSection = label.replace(/\.$/, "");
        }
        headingText = clean(line.runs.at(-1).text);
      }
    }

    const heading = headingText.match(HYMN_HEADING);
    if (heading && (isHeadingColumn || line.gap >= HEADING_GAP)) {
      const number = Number(heading[1]);
      if (number >= 1 && number <= LAST_HYMN) {
        if (current) hymns.push(current);
        current = {
          number,
          // Some hymns are genuinely untitled in the book (88, 313, 546, the
          // table hymns); the UI falls back to the first line for those.
          title: clean(heading[2] ?? ""),
          meter: "",
          lines: [],
          section: pendingSection,
        };
        continue;
      }
    }

    if (isHeadingColumn) {
      if (isSectionHeading(trimmed)) pendingSection = trimmed.replace(/\.$/, "");
      continue; // page numbers, stray marks
    }

    if (!current) continue;

    // The meter sits alone under the heading, pushed right with spaces. A few
    // hymns (85) print it a second time part-way down; drop the repeat rather
    // than letting it become a line of the stanza.
    if (isMeterLine(text)) {
      if (!current.meter) current.meter = normalizeMeter(trimmed);
      continue;
    }

    current.lines.push({
      text: clean(text),
      indent: indentOf(text),
      hardBreak: Number.isFinite(line.gap) && line.gap >= STANZA_GAP,
      pageBreak,
    });
  }
}
if (current) hymns.push(current);

// ---------------------------------------------------------------------------
// Pass 2 — resolve stanza boundaries
// ---------------------------------------------------------------------------

/**
 * A page break destroys the leading that would have told us whether a stanza
 * ended there, so those points are ambiguous. Resolve them against the hymn's
 * own rhythm: stanzas in a given hymn are almost always the same length, so
 * take the modal length of the unambiguous stanzas and break at a page
 * boundary only once the open stanza has reached it.
 */
function splitStanzas(lines) {
  if (!lines.length) return [];

  // First pass: honour only the unambiguous breaks.
  const provisional = [];
  for (const line of lines) {
    if (!provisional.length || (line.hardBreak && provisional.at(-1).length)) provisional.push([]);
    provisional.at(-1).push(line);
  }

  // Segments containing no page break are trustworthy; vote on their length.
  const counts = new Map();
  for (const stanza of provisional) {
    if (stanza.some((l, i) => i > 0 && l.pageBreak)) continue;
    counts.set(stanza.length, (counts.get(stanza.length) ?? 0) + 1);
  }
  let modal = 0;
  let best = -1;
  for (const [length, n] of counts) {
    if (n > best || (n === best && length < modal)) { modal = length; best = n; }
  }

  if (!modal || best < 1) return { stanzas: provisional.map((s) => s.map(render)), modal: 0 };

  // Second pass: also break at a page boundary once the stanza looks complete.
  const stanzas = [[]];
  for (const line of lines) {
    const open = stanzas.at(-1);
    const shouldBreak = open.length && (line.hardBreak || (line.pageBreak && open.length >= modal));
    if (shouldBreak) stanzas.push([]);
    stanzas.at(-1).push(line);
  }

  // A handful of hymns (22, 79, 90) are missing a stanza space in the printed
  // book — two stanzas run together with ordinary line leading between them.
  // An exact multiple of the hymn's own stanza length is the giveaway.
  const split = [];
  for (const stanza of stanzas) {
    if (stanza.length > modal && stanza.length % modal === 0) {
      for (let i = 0; i < stanza.length; i += modal) split.push(stanza.slice(i, i + modal));
    } else {
      split.push(stanza);
    }
  }

  return { stanzas: split.map((s) => s.map(render)), modal };
}

/** Indentation is stored as leading tabs so search can strip it with one regex. */
const render = (line) => "\t".repeat(line.indent) + line.text;

/**
 * Titles ending in a comma or semicolon aren't titles. In a few untitled hymns
 * (358) the first line of the text was set on the heading baseline, so the
 * extractor reads it as the title and the opening stanza comes out one line
 * short. Give the line back to the stanza and leave the hymn untitled.
 */
function reclaimFirstLine(hymn) {
  if (!/[,;:]$/.test(hymn.title)) return;
  const { stanzas, modal } = hymn;
  if (!modal || stanzas[0]?.length !== modal - 1) return;
  stanzas[0].unshift(hymn.title);
  hymn.title = "";
  hymn.reclaimed = true;
}

for (const hymn of hymns) {
  const { stanzas, modal } = splitStanzas(hymn.lines);
  hymn.stanzas = stanzas;
  hymn.modal = modal;
  reclaimFirstLine(hymn);
  delete hymn.lines;
  delete hymn.modal;
}

// ---------------------------------------------------------------------------
// Pass 3 — the topical table of contents, from the book's own front matter
// ---------------------------------------------------------------------------

/**
 * The contents pages list every section and hymn in order, with major sections
 * set at 18pt and subsections at 14pt. Entries are dotted leaders followed by
 * "NN   Title", so we read the hierarchy off the type size.
 */
function extractSections(pages) {
  const sections = [];
  let major = null;
  let sub = null;

  const push = (number) => {
    if (!major) return;
    const bucket = sub ?? major;
    if (!bucket.hymns.includes(number)) bucket.hymns.push(number);
  };

  for (const page of pages) {
    for (const line of page) {
      // A contents baseline is several runs: leader dots, the entry itself, a
      // spacer glyph, and the printed page number far to the right. Keep only
      // the entry — gluing the page number on would corrupt titles that end in
      // a scripture reference ("…—Rom. 1:20" + "30").
      const trimmed = line.runs
        .filter((r) => r.x < PAGE_NUMBER_X)
        .map((r) => normalize(r.text))
        .join("")
        .replace(/\.{4,}/g, "")
        .replace(/[\r\n!]/g, "")
        .trim();
      if (!trimmed) continue;

      // "343   " with nothing after it is an entry for a hymn the book leaves
      // untitled, so the trailing run of spaces has to survive the trim.
      const entry = trimmed.match(/^(\d{1,3})(?:\s{2,}|$)/);
      if (entry) {
        const n = Number(entry[1]);
        if (n >= 1 && n <= LAST_HYMN) push(n);
        continue;
      }
      if (!isSectionHeading(trimmed)) continue;

      const title = trimmed.replace(/\.$/, "");
      if (line.size >= 17) {
        major = { title, hymns: [], subsections: [] };
        sub = null;
        sections.push(major);
      } else if (line.size >= 13 && major) {
        sub = { title, hymns: [] };
        major.subsections.push(sub);
      }
    }
  }
  return sections;
}

// The front matter holds both the contents and the prefaces; only the contents
// pages carry dotted leaders, and the preface headings would otherwise be read
// as sections.
const contentsPages = pages
  .slice(0, firstBodyPage)
  .filter((page) => page.filter((l) => /\.{6,}/.test(l.text)).length >= 5);

const sections = extractSections(contentsPages);

/**
 * The contents omit a few hymns outright (139 is simply absent, and several
 * untitled ones are listed inconsistently). Attach any straggler to whichever
 * section its neighbours landed in so browsing never dead-ends.
 */
function placeStragglers(sections, hymns) {
  const owner = new Map();
  const buckets = [];
  const walk = (nodes) => {
    for (const node of nodes ?? []) {
      buckets.push(node);
      for (const n of node.hymns) owner.set(n, node);
      walk(node.subsections);
    }
  };
  walk(sections);

  let placed = 0;
  for (const hymn of hymns) {
    if (owner.has(hymn.number)) continue;
    let bucket = null;
    for (let n = hymn.number - 1; n >= 1 && !bucket; n--) bucket = owner.get(n);
    for (let n = hymn.number + 1; n <= LAST_HYMN && !bucket; n++) bucket = owner.get(n);
    if (!bucket) continue;
    bucket.hymns.push(hymn.number);
    owner.set(hymn.number, bucket);
    placed++;
  }
  for (const bucket of buckets) bucket.hymns.sort((a, b) => a - b);
  return placed;
}

// ---------------------------------------------------------------------------
// Pass 4 — merge the author overlay, validate, write
// ---------------------------------------------------------------------------

const authors = existsSync(AUTHORS) ? JSON.parse(readFileSync(AUTHORS, "utf8")) : {};

/**
 * Restore lines the printing omitted. Applied bottom-up within a hymn so that
 * inserting one line doesn't shift the position of the next.
 */
const corrections = existsSync(CORRECTIONS) ? JSON.parse(readFileSync(CORRECTIONS, "utf8")) : {};
let restored = 0;
for (const hymn of hymns) {
  const edits = corrections[hymn.number];
  if (!Array.isArray(edits)) continue;
  for (const edit of [...edits].sort((a, b) => b.stanza - a.stanza || b.line - a.line)) {
    const stanza = hymn.stanzas[edit.stanza - 1];
    if (!stanza) {
      console.error(`✗ correction for hymn ${hymn.number}: no stanza ${edit.stanza}`);
      process.exit(1);
    }
    stanza.splice(edit.line - 1, 0, edit.text);
    restored++;
  }
}
if (restored) console.log(`· ${restored} line(s) restored from data/corrections.json`);

hymns.sort((a, b) => a.number - b.number);
const stragglers = placeStragglers(sections, hymns);

// Cross-check: the section heading printed above each hymn in the body should
// agree with where the contents pages filed it. Disagreement means one of the
// two parses drifted.
const owner = new Map();
const walkOwners = (nodes) => {
  for (const node of nodes ?? []) {
    for (const n of node.hymns) owner.set(n, node.title);
    walkOwners(node.subsections);
  }
};
walkOwners(sections);
const disagreements = hymns.filter(
  (h) => h.section && owner.get(h.number) && owner.get(h.number) !== h.section,
);
if (disagreements.length) {
  console.log(
    `· ${disagreements.length} hymn(s) where the inline heading and the contents disagree: ` +
      disagreements.slice(0, 12).map((h) => `${h.number} (${h.section} vs ${owner.get(h.number)})`).join("; "),
  );
}
const reclaimed = hymns.filter((h) => h.reclaimed).map((h) => h.number);
if (reclaimed.length) console.log(`· first line recovered from the heading: ${reclaimed.join(", ")}`);
if (stragglers) console.log(`· ${stragglers} hymn(s) placed into a section by proximity`);

const hymnal = {
  id: "brethren",
  title: "A Collection of Hymns and Sacred Songs",
  subtitle: "Old German Baptist Brethren Church · 32nd Edition",
  // The book's own name, shortened. "Brethren Hymnal" was a label I invented
  // and it names a different book — this one is titled on its own title page.
  shortName: "A Collection of Hymns",
  isDefault: true,
  sections,
  hymns: hymns
    .map((h) => ({
      number: h.number,
      title: h.title,
      meter: h.meter,
      author: authors[h.number]?.author ?? null,
      authorSource: authors[h.number]?.source ?? null,
      stanzas: h.stanzas,
    })),
};

const legacy = existsSync(LEGACY) ? JSON.parse(readFileSync(LEGACY, "utf8")) : null;
const { errors, report } = validate(hymnal, legacy);

for (const line of report) console.log(line);

if (errors.length) {
  console.error(`\n✗ ${errors.length} validation error(s); nothing written:\n`);
  for (const e of errors.slice(0, 40)) console.error(`  ${e}`);
  if (errors.length > 40) console.error(`  … and ${errors.length - 40} more`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, `${JSON.stringify(hymnal, null, 2)}\n`);
console.log(`\n✓ wrote ${OUT} — ${hymnal.hymns.length} hymns, ${sections.length} sections`);
