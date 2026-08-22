/**
 * Build data/hymnals/other-songs.json from the Open Hymnal Project.
 *
 *   node scripts/build-other-songs.mjs [--report]
 *
 * Source: openhymnal.org, whose whole purpose is a freely distributable
 * database of public-domain hymnody. Two files, both fetched once by
 * scripts/fetch-open-hymnal.sh:
 *
 *   - the ABC bundle, which carries each hymn's title, attribution, copyright
 *     line, and — for the verses not set against the music — real poetic line
 *     breaks in its `W:` fields.
 *   - the ThML/XML build, which carries every verse, but as run-together
 *     prose with the line breaks thrown away.
 *
 * Neither alone is enough: the XML has all the verses without their shape, the
 * ABC has the shape for only some of them. So we learn each hymn's line
 * structure from its `W:` stanzas and use it to re-break the prose — and then
 * check that work against the `W:` stanzas themselves. A hymn is only included
 * if every verse we can check round-trips exactly. Anything that doesn't is
 * dropped rather than guessed at, because a mis-broken stanza is worse than an
 * absent one in a book people sing from.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";

const SONGS_DIR = "songs";
const ABC_DIR = "vendor/open-hymnal/abc";
const XML = "vendor/open-hymnal/openhymnal.xml";
const COLLECTION = "data/hymnals/brethren.json";
const OUT = "data/hymnals/other-songs.json";

if (!existsSync(ABC_DIR) || !existsSync(XML)) {
  console.error("✗ Source files missing — run scripts/fetch-open-hymnal.sh first");
  process.exit(1);
}

const report = process.argv.includes("--report");

// ---------------------------------------------------------------------------
// Parse the ABC bundle: attribution, copyright, and true line structure
// ---------------------------------------------------------------------------

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

/**
 * "Words: Henry F. Lyte, 1847.  Music: …" → "Henry F. Lyte"
 *
 * Note the name itself contains periods ("Henry F. Lyte"), so the credit can't
 * be cut at the first one — it runs to the year, or failing that to whatever
 * field comes next.
 */
function parseAuthor(credit) {
  const words = credit.match(/Words:\s*(.+?)(?=\s*(?:Music:|Setting:|copyright:)|$)/is);
  if (!words) return null;

  let name = words[1].trim().replace(/\s+/g, " ");
  // A year ends the name wherever it appears — what follows is a date, a
  // translator, or an "alt.", none of which belong in an author line.
  name = name.split(/,?\s*\(?(?:ca\.|c\.|circa)?\s*\b\d{3,4}\b/)[0].trim();
  name = name.replace(/[.,;]+$/, "").trim();
  // Translations and adaptations credit several hands in one line.
  if (/\b(?:translated|tr\.|alt\.|adapted|based on|st\.\s*\d)/i.test(name)) return null;
  // Credits that apportion verses between hands name no single author.
  if (/\bverses?\b/i.test(name)) return null;
  // Translations and adaptations name several hands; claiming one would be wrong.
  if (/\b(and|&|;|,)\b/.test(name) && name.split(/\s+/).length > 4) return null;
  if (/anon|unknown|traditional|various|source|century|psalter/i.test(name)) return null;
  if (name.split(/\s+/).length < 2 || name.length < 4) return null;
  return name;
}

const abc = new Map();
for (const file of readdirSync(ABC_DIR).filter((f) => f.endsWith(".abc"))) {
  const text = readFileSync(`${ABC_DIR}/${file}`, "utf8");

  const title = text.match(/^T:\s*(.+)$/m)?.[1]?.trim();
  if (!title) continue;

  const credits = [...text.matchAll(/^C:\s*(.+)$/gm)].map((m) => m[1].trim());
  const isPublicDomain = credits.some((c) => /copyright:\s*public domain/i.test(c));
  if (!isPublicDomain) continue;

  // `W:` fields hold verses that aren't set under the music, one poetic line
  // per field, with a blank field between stanzas.
  const stanzas = [];
  let current = [];
  for (const m of text.matchAll(/^W:(.*)$/gm)) {
    const line = m[1].trim();
    if (!line) {
      if (current.length) stanzas.push(current);
      current = [];
    } else {
      current.push(line.replace(/^\d+\.\s*/, "").trim());
    }
  }
  if (current.length) stanzas.push(current);

  abc.set(title.toLowerCase(), {
    title,
    author: parseAuthor(credits.join("  ")),
    meter: "",
    stanzas,
  });
}

// ---------------------------------------------------------------------------
// Parse the XML: every verse, as prose
// ---------------------------------------------------------------------------

const xml = readFileSync(XML, "utf8");
const proseByTitle = new Map();

for (const section of xml.split(/<div3\b/).slice(1)) {
  const title = section.match(/<h3>([\s\S]*?)<\/h3>/)?.[1];
  if (!title) continue;
  const clean = decode(title.replace(/<[^>]+>/g, "")).trim();
  // Titles carry a parenthetical list of alternate names; the ABC files don't.
  const primary = clean.replace(/\s*\(also known as[\s\S]*$/i, "").trim();

  const verses = [];
  for (const p of section.matchAll(/<p>([\s\S]*?)<\/p>/g)) {
    const body = decode(p[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    const numbered = body.match(/^(\d+)\.\s*(.+)$/);
    if (numbered) verses.push({ n: Number(numbered[1]), text: numbered[2].trim() });
  }
  if (verses.length) proseByTitle.set(primary.toLowerCase(), verses);
}

// ---------------------------------------------------------------------------
// Re-break prose into poetic lines
// ---------------------------------------------------------------------------

/**
 * Split a run-together verse into `count` lines.
 *
 * Hymn lines nearly always close on punctuation, so the candidates are the
 * punctuation marks; among those we choose the set of breaks that comes
 * closest to dividing the verse evenly, which is what a regular metre implies.
 */
function breakIntoLines(prose, count) {
  if (count <= 1) return [prose];

  const breaks = [];
  for (const m of prose.matchAll(/[,;:.!?—]["')\]]?\s+/g)) {
    breaks.push(m.index + m[0].length);
  }
  if (breaks.length < count - 1) return null;

  const target = prose.length / count;
  const chosen = [];
  for (let i = 1; i < count; i++) {
    const want = target * i;
    let best = null;
    for (const b of breaks) {
      if (chosen.includes(b)) continue;
      if (chosen.length && b <= chosen[chosen.length - 1]) continue;
      if (best === null || Math.abs(b - want) < Math.abs(best - want)) best = b;
    }
    if (best === null) return null;
    chosen.push(best);
  }

  const lines = [];
  let start = 0;
  for (const b of [...chosen, prose.length]) {
    lines.push(prose.slice(start, b).trim());
    start = b;
  }
  return lines.every((l) => l.length > 0) ? lines : null;
}

const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// ---------------------------------------------------------------------------
// Assemble, verifying every hymn against its own known line breaks
// ---------------------------------------------------------------------------

const collection = JSON.parse(readFileSync(COLLECTION, "utf8"));
const alreadyHave = new Set(
  collection.hymns.map((h) => normalize((h.stanzas?.[0]?.[0] ?? "").replace(/^\t+/, "").slice(0, 40))),
);

const kept = [];
const rejected = [];

for (const [key, entry] of abc) {
  const prose = proseByTitle.get(key);
  if (!prose) {
    rejected.push([entry.title, "no verses in the XML build"]);
    continue;
  }
  if (!entry.stanzas.length) {
    rejected.push([entry.title, "no W: stanzas, so no line structure to learn"]);
    continue;
  }

  const lineCounts = new Set(entry.stanzas.map((s) => s.length));
  if (lineCounts.size !== 1) {
    rejected.push([entry.title, "W: stanzas disagree on line count"]);
    continue;
  }
  const lines = [...lineCounts][0];
  if (lines < 2) {
    rejected.push([entry.title, "single-line stanzas"]);
    continue;
  }

  // The check that earns the trust: every verse we also have in W: form must
  // come back out of the splitter exactly as the ABC file has it.
  const known = new Map(entry.stanzas.map((st) => [normalize(st.join(" ")), st]));
  let verified = 0;
  let failed = null;

  const stanzas = [];
  for (const verse of prose.sort((a, b) => a.n - b.n)) {
    const split = breakIntoLines(verse.text, lines);
    if (!split) {
      failed = `verse ${verse.n} could not be broken into ${lines} lines`;
      break;
    }
    const truth = known.get(normalize(verse.text));
    if (truth) {
      if (normalize(split.join(" ")) !== normalize(truth.join(" ")) ||
          split.length !== truth.length ||
          split.some((l, i) => normalize(l) !== normalize(truth[i]))) {
        failed = `verse ${verse.n} did not match its known line breaks`;
        break;
      }
      verified++;
    }
    stanzas.push(split);
  }

  if (failed) {
    rejected.push([entry.title, failed]);
    continue;
  }
  if (verified === 0) {
    rejected.push([entry.title, "nothing to verify against"]);
    continue;
  }
  if (alreadyHave.has(normalize(stanzas[0][0].slice(0, 40)))) {
    rejected.push([entry.title, "already in A Collection of Hymns"]);
    continue;
  }

  kept.push({ ...entry, stanzas, verified });
}

// ---------------------------------------------------------------------------
// Hand-added songs from songs/*.txt
//
// The one source that gets line breaks right, because a person typed them. See
// songs/README.md for the format.
// ---------------------------------------------------------------------------

function parseSongFile(text, filename) {
  const body = text.replace(/\r\n/g, "\n").replace(/\t/g, "\t");
  const split = body.indexOf("\n\n");
  if (split === -1) throw new Error(`${filename}: no blank line between the headers and the first stanza`);

  const headers = {};
  for (const line of body.slice(0, split).split("\n")) {
    const m = line.match(/^([A-Za-z][A-Za-z ]*):\s*(.*)$/);
    if (m) headers[m[1].trim().toLowerCase()] = m[2].trim();
  }
  if (!headers.title) throw new Error(`${filename}: missing a Title: header`);

  const stanzas = body
    .slice(split)
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.replace(/\s+$/, ""))
        .filter((line) => line.trim())
        // A tab, or two spaces, is one step of indent — stored as tabs, the
        // same convention the extracted hymnal uses.
        .map((line) => {
          const indent = line.match(/^(\t+|(?: {2})+)/)?.[0] ?? "";
          const depth = indent.includes("\t") ? indent.length : indent.length / 2;
          return "\t".repeat(Math.min(3, depth)) + line.trim();
        }),
    )
    .filter((stanza) => stanza.length);

  if (!stanzas.length) throw new Error(`${filename}: no stanzas`);

  // A stanza opening with a bare "Refrain:" or "Chorus:" is the recurring one.
  // It has to be marked rather than left as an ordinary stanza: the reader
  // numbers stanzas as it renders them, so an unmarked refrain becomes "verse
  // 2" and every real verse after it is numbered one too high.
  const refrains = [];
  stanzas.forEach((stanza, i) => {
    if (!/^\t*(refrain|chorus)\s*:?\s*$/i.test(stanza[0])) return;
    refrains.push(i);
    stanza.shift();
  });
  const empty = refrains.find((i) => stanzas[i].length === 0);
  if (empty !== undefined) throw new Error(`${filename}: a refrain marker with no lines under it`);

  return {
    title: headers.title,
    author: headers.author || null,
    meter: headers.meter || "",
    stanzas,
    refrains,
    verified: -1, // hand-entered; nothing to verify it against
  };
}

if (existsSync(SONGS_DIR)) {
  for (const file of readdirSync(SONGS_DIR).filter((f) => f.endsWith(".txt"))) {
    try {
      const song = parseSongFile(readFileSync(`${SONGS_DIR}/${file}`, "utf8"), file);
      if (alreadyHave.has(normalize(song.stanzas[0][0].replace(/^\t+/, "").slice(0, 40)))) {
        rejected.push([song.title, "already in A Collection of Hymns"]);
        continue;
      }
      kept.push(song);
    } catch (error) {
      console.error(`✗ ${error.message}`);
      process.exitCode = 1;
    }
  }
}

kept.sort((a, b) => a.title.localeCompare(b.title));

const hymnal = {
  id: "other-songs",
  title: "Other Songs",
  subtitle: "Public-domain hymns · from the Open Hymnal Project",
  shortName: "Other Songs",
  // The numbers here are alphabetical positions, not names anybody calls a song
  // by, so they order the book without being printed over it. See `isNumbered`.
  numbered: false,
  sections: [
    {
      title: "OTHER SONGS",
      hymns: kept.map((_, i) => i + 1),
      subsections: [],
    },
  ],
  hymns: kept.map((entry, i) => ({
    number: i + 1,
    title: entry.title,
    // Only hand-added songs carry a real metre. The ABC `M:` field is a time
    // signature ("4/4"), which is a different thing and would be wrong here.
    meter: entry.verified === -1 ? entry.meter : "",
    author: entry.author,
    authorSource: entry.author ? (entry.verified === -1 ? "songs/" : "openhymnal.org") : null,
    stanzas: entry.stanzas,
    // Indices into `stanzas`. Omitted when there are none, so the 558 hymns of
    // the extracted collection — which prints no refrains at all — stay as they
    // are and the field costs nothing.
    ...(entry.refrains?.length ? { refrains: entry.refrains } : {}),
  })),
};

if (report) {
  console.log(`kept ${kept.length}:`);
  for (const k of kept) {
    const how = k.verified === -1 ? "hand-entered" : `${k.verified} verse(s) verified`;
    console.log(`  ${k.title} — ${k.author ?? "unattributed"} (${how})`);
  }
  console.log(`\nrejected ${rejected.length}:`);
  const why = {};
  for (const [, reason] of rejected) why[reason.replace(/verse \d+/, "verse N")] = (why[reason.replace(/verse \d+/, "verse N")] ?? 0) + 1;
  for (const [reason, n] of Object.entries(why).sort((a, b) => b[1] - a[1])) console.log(`  ${n}× ${reason}`);
} else {
  writeFileSync(OUT, `${JSON.stringify(hymnal, null, 2)}\n`);
  const attributed = kept.filter((k) => k.author).length;
  const handAdded = kept.filter((k) => k.verified === -1).length;
  console.log(`✓ wrote ${OUT}`);
  console.log(
    `  ${kept.length} songs (${kept.length - handAdded} from Open Hymnal, ${handAdded} from songs/), ` +
      `${attributed} attributed, ${rejected.length} rejected`,
  );
}
