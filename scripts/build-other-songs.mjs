/**
 * Build data/hymnals/other-songs.json from songs/*.txt.
 *
 *   node scripts/build-other-songs.mjs [--report]
 *
 * One plain-text file per song, typed by a person. See songs/README.md.
 *
 * This used to also import public-domain hymns from the Open Hymnal Project,
 * with a round-trip check that only accepted a hymn whose line breaks could be
 * reproduced exactly. The check worked — it rejected 289 of 306 — but what
 * survived was mostly German chorales the congregation had never sung, which is
 * a strange thing to put in a book meant for them. Their own songbooks are the
 * better source, so the importer is gone; it is in the git history if a use for
 * it ever turns up.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";

const SONGS_DIR = "songs";
const COLLECTION = "data/hymnals/brethren.json";
const OUT = "data/hymnals/other-songs.json";
const IDS = "data/other-songs-ids.json";

/** The format's worked example. Documentation, not a song in the book. */
const TEMPLATE = "EXAMPLE.txt";

const report = process.argv.includes("--report");
const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function parseSongFile(text, filename) {
  const body = text.replace(/\r\n/g, "\n");
  const split = body.indexOf("\n\n");
  if (split === -1) {
    throw new Error(`${filename}: no blank line between the headers and the first stanza`);
  }

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
  };
}

const collection = JSON.parse(readFileSync(COLLECTION, "utf8"));
const alreadyHave = new Set(
  collection.hymns.map((h) =>
    normalize((h.stanzas?.[0]?.[0] ?? "").replace(/^\t+/, "").slice(0, 40)),
  ),
);

const kept = [];
const rejected = [];

if (existsSync(SONGS_DIR)) {
  for (const file of readdirSync(SONGS_DIR).filter((f) => f.endsWith(".txt"))) {
    if (file === TEMPLATE) continue;
    try {
      const song = parseSongFile(readFileSync(`${SONGS_DIR}/${file}`, "utf8"), file);
      const opening = normalize(song.stanzas[0][0].replace(/^\t+/, "").slice(0, 40));
      if (alreadyHave.has(opening)) {
        rejected.push([song.title, "already in A Collection of Hymns"]);
        continue;
      }
      kept.push({ ...song, slug: file.replace(/\.txt$/, "") });
    } catch (error) {
      console.error(`✗ ${error.message}`);
      process.exitCode = 1;
    }
  }
}

kept.sort((a, b) => a.title.localeCompare(b.title));

/**
 * Stable ids, keyed by file name.
 *
 * The book reads alphabetically, so a song's *position* shifts every time
 * another is added or removed — Amazing Grace has already moved from 5 to 2.
 * Anything holding a position (a star, a recent, the ribbon bookmark, a sync
 * code) silently came to point at a different song. Ids are assigned once and
 * never reused, so those references keep meaning what they meant.
 *
 * Keyed by file name rather than title so that correcting a typo in a title
 * doesn't orphan everyone's star.
 */
const ledger = JSON.parse(readFileSync(IDS, "utf8"));
let nextId = Math.max(0, ...Object.values(ledger.ids)) + 1;
let assigned = 0;
for (const song of kept) {
  if (ledger.ids[song.slug] === undefined) {
    ledger.ids[song.slug] = nextId++;
    assigned++;
  }
}

const hymnal = {
  id: "other-songs",
  title: "Other Songs",
  subtitle: "Songs the congregation sings, outside the collection",
  shortName: "Other Songs",
  // The numbers here are alphabetical positions, not names anybody calls a song
  // by, so they order the book without being printed over it. See `isNumbered`.
  numbered: false,
  // The book that grows. Suggestions land here; the collection is a fixed
  // printed text and cannot take a 559th hymn. See `isExpandable`.
  expandable: true,
  sections: [
    {
      title: "OTHER SONGS",
      hymns: kept.map((entry) => ledger.ids[entry.slug]),
      subsections: [],
    },
  ],
  hymns: kept.map((entry) => ({
    // A stable id, not a position. The array order is the reading order.
    number: ledger.ids[entry.slug],
    title: entry.title,
    meter: entry.meter,
    author: entry.author,
    authorSource: entry.author ? "songs/" : null,
    stanzas: entry.stanzas,
    // Omitted when there are none, so the 558 hymns of the extracted collection
    // — which prints no refrains at all — stay as they are.
    ...(entry.refrains?.length ? { refrains: entry.refrains } : {}),
  })),
};

if (report) {
  console.log(`${kept.length} songs:`);
  for (const k of kept) console.log(`  ${k.title} — ${k.author ?? "unattributed"}`);
  if (rejected.length) {
    console.log(`\nskipped ${rejected.length}:`);
    for (const [title, why] of rejected) console.log(`  ${title} — ${why}`);
  }
} else {
  writeFileSync(IDS, `${JSON.stringify(ledger, null, 2)}\n`);
  writeFileSync(OUT, `${JSON.stringify(hymnal, null, 2)}\n`);
  const attributed = kept.filter((k) => k.author).length;
  console.log(`✓ wrote ${OUT}`);
  console.log(
    `  ${kept.length} songs, ${attributed} attributed, ${rejected.length} skipped` +
      (assigned ? `, ${assigned} new id(s) assigned` : ""),
  );
}
