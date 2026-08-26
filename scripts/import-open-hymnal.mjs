#!/usr/bin/env node
/**
 * Turn Open Hymnal ABC scores into songs/*.txt drafts.
 *
 * Why ABC and not the ThML build: ThML stores each verse as one run of prose,
 * and prose cannot be broken back into lines reliably — capitalisation marks
 * sentences, not lines ("Amazing grace! How sweet the sound" capitalises "How"
 * mid-line, and leaves "I once was lost" looking like the same line as what
 * precedes it). The ABC lyric lines are hyphenated per note, which gives an
 * exact syllable count for every word. With the hymn's metre, that turns into
 * the real line breaks — the one thing songs/README.md says no automated
 * source gets right.
 *
 * Every file it writes is a DRAFT and says so. Proofread against a printed
 * copy before trusting it.
 *
 *   node scripts/import-open-hymnal.mjs        # writes songs/*.txt
 *   node scripts/import-open-hymnal.mjs --dry  # report only
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ABC = "vendor/open-hymnal/abc";
const OUT = "songs";
const dry = process.argv.includes("--dry");

/**
 * The books this app can print: everything below was published in or before
 * 1930 and is public domain in the United States. `verse` and `refrain` are
 * syllables per line — the metre — and are what recovers the line breaks.
 */
const HYMNS = [
  { file: "When_I_Survey_The_Wondrous_Cross-Hamburg.abc", slug: "when-i-survey-the-wondrous-cross",
    title: "When I Survey the Wondrous Cross", meter: "L.M.", verse: [8, 8, 8, 8] },
  { file: "O_Sacred_Head_Now_Wounded-Passion_Chorale-Herzlich_Tut_Mich_Verlangen.abc", slug: "o-sacred-head-now-wounded",
    title: "O Sacred Head, Now Wounded", meter: "7s. 6s. D.", verse: [7, 6, 7, 6, 7, 6, 7, 6] },
  { file: "My_Faith_Looks_Up_To_Thee-Olivet.abc", slug: "my-faith-looks-up-to-thee",
    title: "My Faith Looks Up to Thee", meter: "6.6.4.6.6.6.4", verse: [6, 6, 4, 6, 6, 6, 4] },
  { file: "Abide_With_Me-Eventide.abc", slug: "abide-with-me",
    title: "Abide with Me", meter: "10s.", verse: [10, 10, 10, 10] },
  // The Open Hymnal text is the "Beautiful Savior" translation, which is not
  // the wording of "Fairest Lord Jesus" — same German hymn, different English.
  // Titled for what it actually says.
  { file: "Beautiful_Savior-Crusaders_Hymn.abc", slug: "beautiful-savior",
    title: "Beautiful Savior", meter: "5.5.8.5.5.8", verse: [5, 5, 8, 5, 5, 8] },
  { file: "A_Mighty_Fortress_Is_Our_God-Ein_Feste_Burg_Rhythmic.abc", slug: "a-mighty-fortress-is-our-god",
    title: "A Mighty Fortress Is Our God", meter: "8.7.8.7.5.5.5.6.7", verse: [8, 7, 8, 7, 5, 5, 5, 6, 7] },
  { file: "Jesus_Loves_Me-untitled.abc", slug: "jesus-loves-me",
    title: "Jesus Loves Me", meter: "7s. with refrain", verse: [7, 7, 7, 7], refrain: [5, 5, 5, 6] },
  { file: "Praise_To_The_Lord_The_Almighty-Lobe_Den_Herren.abc", slug: "praise-to-the-lord-the-almighty",
    title: "Praise to the Lord, the Almighty", meter: "14.14.4.7.8", verse: [14, 14, 4, 7, 8] },
  { file: "Immortal_Invisible_God_Only_Wise-St_Denio.abc", slug: "immortal-invisible",
    title: "Immortal, Invisible", meter: "11s.", verse: [11, 11, 11, 11] },
  { file: "Beneath_The_Cross_Of_Jesus-St_Christopher.abc", slug: "beneath-the-cross-of-jesus",
    title: "Beneath the Cross of Jesus", meter: "7.6.8.6.8.6.8.6", verse: [7, 6, 8, 6, 8, 6, 8, 6] },
  { file: "Blessed_Assurance-Blessed_Assurance-Assurance.abc", slug: "blessed-assurance",
    title: "Blessed Assurance", meter: "9.10.9.9 with refrain", verse: [9, 10, 9, 9], refrain: [9, 9, 9, 9] },
  { file: "Take_My_Life_And_Let_It_Be-Mozart.abc", slug: "take-my-life-and-let-it-be",
    title: "Take My Life and Let It Be", meter: "7s.", verse: [7, 7, 7, 7] },
  { file: "To_God_Be_the_Glory-To_God_Be_the_Glory.abc", slug: "to-god-be-the-glory",
    title: "To God Be the Glory", meter: "11s. with refrain", verse: [11, 11, 11, 11], refrain: [6, 6, 6, 6, 11, 11] },
  { file: "It_Is_Well_With_My_Soul-It_Is_Well-Ville_Du_Havre.abc", slug: "it-is-well-with-my-soul",
    title: "It Is Well with My Soul", meter: "11.8.11.9 with refrain", verse: [11, 8, 11, 9], refrain: [6, 9] },
  { file: "The_Old_Rugged_Cross-Old_Rugged_Cross.abc", slug: "the-old-rugged-cross",
    title: "The Old Rugged Cross", meter: "12.9.12.8 with refrain", verse: [12, 9, 12, 8], refrain: [9, 9, 9, 9] },
  { file: "Holy_Holy_Holy-Nicaea.abc", slug: "holy-holy-holy",
    title: "Holy, Holy, Holy", meter: "11.12.12.10", verse: [11, 12, 12, 10] },
  { file: "Blest_Be_The_Tie_That_Binds-Dennis.abc", slug: "blest-be-the-tie-that-binds",
    title: "Blest Be the Tie That Binds", meter: "S.M.", verse: [6, 6, 8, 6] },
  { file: "The_Churchs_One_Foundation-Aurelia.abc", slug: "the-churchs-one-foundation",
    title: "The Church's One Foundation", meter: "7s. 6s. D.", verse: [7, 6, 7, 6, 7, 6, 7, 6] },
  { file: "Now_Thank_We_All_Our_God-Nun_Danket.abc", slug: "now-thank-we-all-our-god",
    title: "Now Thank We All Our God", meter: "6.7.6.7.6.6.6.6", verse: [6, 7, 6, 7, 6, 6, 6, 6] },
  { file: "For_The_Beauty_Of_The_Earth-Dix.abc", slug: "for-the-beauty-of-the-earth",
    title: "For the Beauty of the Earth", meter: "7s. with refrain", verse: [7, 7, 7, 7], refrain: [7, 7] },
  { file: "More_Love_To_Thee-More_Love_To_Thee.abc", slug: "more-love-to-thee",
    title: "More Love to Thee", meter: "6.4.6.4.6.6.4.4", verse: [6, 4, 6, 4, 6, 6, 4, 4] },
  { file: "I_Need_Thee_Every_Hour-I_Need_Thee_Every_Hour.abc", slug: "i-need-thee-every-hour",
    title: "I Need Thee Every Hour", meter: "6.4.6.4 with refrain", verse: [6, 4, 6, 4], refrain: [7, 6, 7, 4] },
  { file: "Rock_of_Ages-Toplady.abc", slug: "rock-of-ages",
    title: "Rock of Ages", meter: "7s.", verse: [7, 7, 7, 7, 7, 7] },
];

/** ABC `w:` lines → { verseNumber: [token, …] }. */
function readLyrics(path) {
  const verses = new Map();
  let group = 0, inRun = false;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    if (!raw.startsWith("w:")) { inRun = false; continue; }
    // Verse numbers are printed only in the first staff block; after that the
    // w: lines are positional — the Nth line of each run is verse N.
    if (!inRun) { group = 0; inRun = true; }
    group += 1;
    let line = raw.slice(2);
    const m = line.match(/^\s*(\d+)\s*\.[~ ]?/);
    const n = m ? Number(m[1]) : group;
    if (m) line = line.slice(m[0].length);
    const list = verses.get(n) ?? [];
    for (const tok of line.split(/\s+/)) {
      if (!tok || "*-_|".includes(tok)) continue;   // melisma, hold, barline
      list.push(tok.replace(/~/g, " "));
    }
    verses.set(n, list);
  }
  return verses;
}

/** Hyphen-continued syllables → [word, syllableCount]. */
function toWords(tokens) {
  const out = [];
  let buf = "", syl = 0;
  for (const t of tokens) {
    const cont = t.endsWith("-");
    buf += cont ? t.slice(0, -1) : t;
    syl += 1;
    if (!cont) { out.push([buf, syl]); buf = ""; syl = 0; }
  }
  if (buf) out.push([buf, syl]);
  return out;
}

/**
 * Split words into lines of the given syllable counts. Returns [lines, rest].
 *
 * The metre alone is not enough. Some tunes carry a pickup note, so the same
 * line runs to eleven syllables in one verse and twelve in the next — Nicaea
 * does exactly this, and counting blindly walked every line of "Holy, Holy,
 * Holy" one word further along than the last. What does hold is that a hymn
 * line ends on punctuation. So aim at the metre, then take the nearest stop
 * that is also the end of a clause.
 */
function split(words, meter, strictLast = false) {
  const lines = [];
  let i = 0;
  for (const want of meter) {
    // Every place this line could stop, with the syllable count it would have.
    const stops = [];
    let run = 0;
    for (let j = i; j < words.length; j += 1) {
      run += words[j][1];
      stops.push({ end: j + 1, got: run, closes: /[,;:.!?—]$/.test(words[j][0]) });
      if (run >= want + 4) break;
    }
    if (stops.length === 0) { lines.push({ text: "", got: 0, want }); continue; }
    const near = (a, b) => Math.abs(a.got - want) - Math.abs(b.got - want);
    // Within one syllable only. At three, "let me sing / Always, only" was
    // pulled apart as "let me sing always, / only" — a comma close enough to
    // the metre is evidence, a comma two words past it is not.
    const clausal = stops.filter((s) => s.closes && Math.abs(s.got - want) <= 1).sort(near)[0];
    let chosen = clausal ?? stops.slice().sort(near)[0];
    // A refrain's last line must not run on: the score sets the refrain across
    // two staves, so its lyric run repeats the opening phrase, and without this
    // "It is well with my soul" ended "…with my soul. It is well,".
    const last = want === meter[meter.length - 1] && lines.length === meter.length - 1;
    if (strictLast && last && chosen.got > want) {
      chosen = stops.filter((s) => s.got <= want).sort((a, b) => b.got - a.got)[0] ?? chosen;
    }
    // Hymnals set every line with a capital, whatever the sentence is doing;
    // the score lowercases continuations because it is following prose.
    const text = words.slice(i, chosen.end).map(([w]) => w).join(" ");
    lines.push({ text: text.charAt(0).toUpperCase() + text.slice(1), got: chosen.got, want });
    i = chosen.end;
  }
  return [lines, words.slice(i)];
}

/** Hymnals inset the shorter line of an alternating pair; follow the metre. */
const indent = (meter) => meter.map((n, i) => i > 0 && n < meter[i - 1]);

const report = [];
for (const h of HYMNS) {
  const path = join(ABC, h.file);
  if (!existsSync(path)) { report.push([h.title, "no ABC file"]); continue; }

  const lyrics = readLyrics(path);
  const numbers = [...lyrics.keys()].sort((a, b) => a - b);
  const verseLen = h.verse.reduce((a, b) => a + b, 0);
  const inset = indent(h.verse);

  const stanzas = [];
  let refrainWords = null;
  const notes = [];

  for (const n of numbers) {
    const words = toWords(lyrics.get(n));
    const total = words.reduce((a, [, s]) => a + s, 0);
    const [lines, rest] = split(words, h.verse);
    // The score prints the refrain on verse one's lyric line, so whatever runs
    // past the verse metre there is the refrain.
    if (rest.length && !refrainWords && h.refrain) refrainWords = rest;
    else if (rest.length) notes.push(`v${n} had ${total - verseLen} syllables left over`);

    for (const l of lines) if (l.got !== l.want) notes.push(`v${n} line ${lines.indexOf(l) + 1}: ${l.got} syllables, metre wants ${l.want}`);
    stanzas.push(lines.map((l, i) => (inset[i] ? "\t" : "") + l.text));
  }

  const out = [];
  out.push(stanzas[0]);
  if (refrainWords && h.refrain) {
    const [rl, extra] = split(refrainWords, h.refrain, true);
    const rInset = indent(h.refrain);
    out.push(["Refrain:", ...rl.map((l, i) => (rInset[i] ? "\t" : "") + l.text)]);
    for (const l of rl) if (l.got !== l.want) notes.push(`refrain line ${rl.indexOf(l) + 1}: ${l.got}, wants ${l.want}`);
    if (extra.length) notes.push(`refrain had ${extra.length} words left over`);
  } else if (h.refrain) {
    notes.push("no refrain recovered");
  }
  out.push(...stanzas.slice(1));

  // Attribution, straight from the score's own credit lines.
  const credits = readFileSync(path, "utf8").split("\n").filter((l) => l.startsWith("C: "));
  const wordsLine = credits.find((l) => /^C:\s*Words:/i.test(l)) ?? "";
  // Some scores put words, music and setting on one credit line. The book is
  // words only, so anything from "Music:" on is somebody else's contribution.
  const author = wordsLine
    .replace(/^C:\s*Words:\s*/i, "")
    .split(/\s(?:Music|Setting|Arrangement|Harmony|Tune)\b/i)[0]
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.;,]$/, "");

  const header = [
    `Title: ${h.title}`,
    author ? `Author: ${author.replace(/\.$/, "")}` : null,
    `Meter: ${h.meter}`,
    `Source: Open Hymnal Project (public domain). DRAFT — NEEDS PROOFREADING against a printed copy.`,
  ].filter(Boolean);

  const body = out.map((s) => s.join("\n")).join("\n\n");
  const text = header.join("\n") + "\n\n" + body + "\n";

  if (!dry) writeFileSync(join(OUT, `${h.slug}.txt`), text);
  report.push([h.title, notes.length ? `${notes.length} note(s): ${notes[0]}` : "clean"]);
}

console.log(dry ? "DRY RUN — nothing written\n" : `Wrote ${report.filter(([, s]) => s !== "no ABC file").length} drafts to ${OUT}/\n`);
for (const [t, s] of report) console.log(`  ${s === "clean" ? "✓" : "!"} ${t.padEnd(34)} ${s}`);
