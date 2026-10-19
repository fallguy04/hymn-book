/**
 * Turn words pasted from anywhere into a song file for songs/.
 *
 * Hymnary.org's "Representative Text", a songbook PDF, a lyrics site, or a
 * plain typed list all lay a hymn out differently: verse numbers at the start
 * of lines ("1 O to be like Thee!"), a refrain written out once and then
 * pointed at ("[Refrain]"), lines starting in lower case, a heading or two
 * copied along with the words. This takes any of those and writes the format
 * songs/README.md describes, so adding a song is copy, paste, answer three
 * questions.
 *
 * Plain JavaScript with no imports, so the build script, the tests, and any
 * later in-app version can all use it.
 */

/** Headings that come along when copying from hymn sites; not part of the song. */
const NOISE = /^(representative text|full text|lyrics|text|words|hymnary\.org.*|public domain)\s*:?$/i;

/** "Refrain:" or "Chorus" on a line of its own, optionally with words after a colon. */
const LABEL = /^\s*(?:refrain|chorus)\s*(?::\s*(.*))?$/i;

/** "[Refrain]" / "(Chorus)" left at the end of a verse to say "sing it here". */
const POINTER = /\s*[[(](?:refrain|chorus)[\])]\s*$/i;

/** "1 O to be like Thee", "2. Full of…", "3) Lowly…" */
const VERSE_NUMBER = /^\s*(\d{1,2})[.)]?\s+(\S.*)$/;

const capitalise = (line) =>
  line.replace(/^([“"‘'(]*)(\p{Ll})/u, (_, lead, letter) => lead + letter.toUpperCase());

/**
 * Pasted text → stanzas, in singing order, with the refrain written once
 * where it first appears.
 *
 * @returns {{ blocks: { refrain: boolean, lines: string[] }[] }}
 */
export function parsePastedSong(text) {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""));

  // Numbered verses mark where each verse starts, so blank lines don't have
  // to; without numbers, blank lines are the only way to tell.
  const numbered = lines.filter((l) => VERSE_NUMBER.test(l)).length >= 2;

  const blocks = [];
  let current = null;
  /** Verse numbers come in order, so "3 more lines" inside verse 1 isn't verse 3. */
  let nextVerse = 1;
  let seenRefrain = false;
  /** Inside a second copy of the refrain, which is dropped. */
  let skipping = false;

  const open = (refrain) => {
    current = { refrain, lines: [] };
    blocks.push(current);
    skipping = false;
  };

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (NOISE.test(trimmed)) continue;

    if (!trimmed) {
      if (!numbered) {
        current = null;
        skipping = false;
      }
      continue;
    }

    const label = trimmed.match(LABEL);
    if (label) {
      if (seenRefrain) {
        current = null;
        skipping = true;
      } else {
        seenRefrain = true;
        open(true);
        if (label[1]) current.lines.push(label[1]);
      }
      continue;
    }

    const line = trimmed.replace(POINTER, "");
    const verse = numbered ? line.match(VERSE_NUMBER) : null;
    if (verse && Number(verse[1]) === nextVerse) {
      nextVerse++;
      open(false);
      current.lines.push(verse[2]);
      continue;
    }

    if (skipping) continue;
    if (!current) open(false);
    if (line) current.lines.push(line);
  }

  const kept = blocks.filter((b) => b.lines.length);
  for (const block of kept) block.lines = block.lines.map(capitalise);
  return { blocks: kept };
}

/* ------------------------------------------------------------------------ */
/* Meter                                                                     */
/* ------------------------------------------------------------------------ */

/** A rough syllable count: vowel groups, less a silent final e or -ed. */
function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|[^laeiouy]e)$/, "").replace(/^y/, "");
  return Math.max(1, (w.match(/[aeiouy]{1,2}/g) ?? []).length);
}

const lineSyllables = (line) => line.split(/[\s—–-]+/).reduce((n, w) => n + syllables(w), 0);

/**
 * A guess at the meter, from the verses: syllables per line, taking the most
 * common count across verses at each line so one odd word ("bless-ed") doesn't
 * decide it. A guess, to be checked: English spelling and hymn elisions defeat
 * any simple counter now and then.
 */
export function guessMeter(blocks) {
  const verses = blocks.filter((b) => !b.refrain);
  if (verses.length === 0) return "";
  const length = verses[0].lines.length;
  const alike = verses.filter((v) => v.lines.length === length);
  const pattern = [];
  for (let i = 0; i < length; i++) {
    const counts = alike.map((v) => lineSyllables(v.lines[i]));
    const tally = new Map();
    for (const c of counts) tally.set(c, (tally.get(c) ?? 0) + 1);
    pattern.push([...tally.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]);
  }
  const refrain = blocks.some((b) => b.refrain) ? " with refrain" : "";
  return pattern.join(".") + refrain;
}

/* ------------------------------------------------------------------------ */
/* Title and file                                                            */
/* ------------------------------------------------------------------------ */

const SMALL = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);

/** "O to be like Thee! Blessed Redeemer" → "O to Be Like Thee" */
export function guessTitle(blocks) {
  const first = blocks[0]?.lines[0] ?? "";
  const phrase = first.split(/[!,;:.?]/)[0].trim();
  return phrase
    .split(/\s+/)
    .map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

/** "O to Be Like Thee" → "o-to-be-like-thee", the file name and the song's lasting key. */
export const slugify = (title) =>
  title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * The song file, in the songs/README.md format. Lines alternate in and out the
 * way a hymnal sets them when a stanza has an even number of lines; pass
 * `indent: false` for a song that shouldn't.
 */
export function formatSongFile({ title, author, meter, source }, blocks, { indent = true } = {}) {
  const headers = [`Title: ${title}`];
  if (author) headers.push(`Author: ${author}`);
  if (meter) headers.push(`Meter: ${meter}`);
  if (source) headers.push(`Source: ${source}`);

  const stanzas = blocks.map(({ refrain, lines }) => {
    const set = lines.map((line, i) =>
      indent && lines.length % 2 === 0 && lines.length >= 4 && i % 2 === 1 ? `\t${line}` : line,
    );
    return (refrain ? ["Refrain:", ...set] : set).join("\n");
  });

  return `${headers.join("\n")}\n\n${stanzas.join("\n\n")}\n`;
}
