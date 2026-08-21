/**
 * Harvest first-line → author pairs from Hymnary.org's public scripture API.
 *
 *   node scripts/harvest-authors.mjs
 *
 * The hymnal prints no authors, so attribution has to come from outside the
 * book. Hymnary's text pages sit behind a proof-of-work bot shield — which is
 * them saying plainly not to bulk-scrape, so we don't. Their documented
 * scripture API is open, and happens to key its results by first line with the
 * author attached, which is exactly the join we need.
 *
 * The API caps a response at 100 entries, alphabetically. So query whole books
 * first and only drill into chapters where a response comes back full and is
 * therefore truncated — roughly 400 requests instead of 1,189, at a delay that
 * respects the 5s Crawl-delay in their robots.txt.
 *
 * Output is a raw harvest at data/hymnary-harvest.json. Matching it against our
 * hymns, and deciding what to actually believe, is scripts/match-authors.mjs —
 * kept separate so the slow network pass runs once.
 */

import { writeFileSync, existsSync, readFileSync } from "node:fs";

const OUT = "data/hymnary-harvest.json";
const DELAY_MS = 3000;
const PAGE_CAP = 100; // a full response means the result was cut off
const USER_AGENT = "hymn-book-research/1.0 (congregational hymnal; contact via github.com/fallguy04/hymn-book)";

/** Books of the Bible with chapter counts, for drilling into truncated results. */
const BOOKS = {
  Genesis: 50, Exodus: 40, Leviticus: 27, Numbers: 36, Deuteronomy: 34,
  Joshua: 24, Judges: 21, Ruth: 4, "1 Samuel": 31, "2 Samuel": 24,
  "1 Kings": 22, "2 Kings": 25, "1 Chronicles": 29, "2 Chronicles": 36,
  Ezra: 10, Nehemiah: 13, Esther: 10, Job: 42, Psalms: 150, Proverbs: 31,
  Ecclesiastes: 12, "Song of Solomon": 8, Isaiah: 66, Jeremiah: 52,
  Lamentations: 5, Ezekiel: 48, Daniel: 12, Hosea: 14, Joel: 3, Amos: 9,
  Obadiah: 1, Jonah: 4, Micah: 7, Nahum: 3, Habakkuk: 3, Zephaniah: 3,
  Haggai: 2, Zechariah: 14, Malachi: 4,
  Matthew: 28, Mark: 16, Luke: 24, John: 21, Acts: 28, Romans: 16,
  "1 Corinthians": 16, "2 Corinthians": 13, Galatians: 6, Ephesians: 6,
  Philippians: 4, Colossians: 4, "1 Thessalonians": 5, "2 Thessalonians": 3,
  "1 Timothy": 6, "2 Timothy": 4, Titus: 3, Philemon: 1, Hebrews: 13,
  James: 5, "1 Peter": 5, "2 Peter": 3, "1 John": 5, "2 John": 1, "3 John": 1,
  Jude: 1, Revelation: 22,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Resume where a previous run stopped; the sweep takes a while. */
const harvest = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { entries: {}, done: [] };
const done = new Set(harvest.done);

let requests = 0;

async function query(reference) {
  if (done.has(reference)) return null;

  const url = `https://hymnary.org/api/scripture?reference=${encodeURIComponent(reference)}`;
  await sleep(DELAY_MS);
  requests++;

  let data;
  try {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) {
      console.log(`  ${reference}: HTTP ${response.status}`);
      return null;
    }
    data = await response.json();
  } catch (error) {
    console.log(`  ${reference}: ${String(error).slice(0, 60)}`);
    return null;
  }

  if (!data || typeof data !== "object") return null;

  let added = 0;
  for (const [firstLine, info] of Object.entries(data)) {
    if (!info?.author || harvest.entries[firstLine]) continue;
    harvest.entries[firstLine] = { author: info.author, title: info.title ?? "", meter: info.meter ?? "" };
    added++;
  }

  done.add(reference);
  harvest.done = [...done];
  writeFileSync(OUT, JSON.stringify(harvest, null, 1));

  const count = Object.keys(data).length;
  console.log(
    `  ${reference}: ${count} results, +${added} new (total ${Object.keys(harvest.entries).length})`,
  );
  return count;
}

for (const [book, chapters] of Object.entries(BOOKS)) {
  const count = await query(book);

  // A full page means the response was truncated; go chapter by chapter.
  if (count === PAGE_CAP) {
    for (let chapter = 1; chapter <= chapters; chapter++) {
      await query(`${book} ${chapter}`);
    }
  }
}

console.log(
  `\n✓ ${Object.keys(harvest.entries).length} first-line/author pairs from ${requests} requests → ${OUT}`,
);
