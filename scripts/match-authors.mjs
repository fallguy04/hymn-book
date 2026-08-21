/**
 * Match the Hymnary harvest against our hymns and propose attributions.
 *
 *   node scripts/match-authors.mjs         # report only
 *   node scripts/match-authors.mjs --write # merge exact matches into authors.json
 *
 * Deliberately conservative. It writes only exact normalized first-line
 * matches, because a wrong attribution reads exactly as authoritative as a
 * right one, and this hymnal's editors altered enough opening lines that a
 * loose match is a real risk. Near-misses are printed for a human to judge
 * rather than merged.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const HARVEST = "data/hymnary-harvest.json";
const HYMNAL = "data/hymnals/brethren.json";
const AUTHORS = "data/authors.json";

if (!existsSync(HARVEST)) {
  console.error(`✗ ${HARVEST} not found — run scripts/harvest-authors.mjs first`);
  process.exit(1);
}

const write = process.argv.includes("--write");
const harvest = JSON.parse(readFileSync(HARVEST, "utf8"));
const hymnal = JSON.parse(readFileSync(HYMNAL, "utf8"));
const authors = JSON.parse(readFileSync(AUTHORS, "utf8"));

/**
 * Reduce a first line to something comparable across two sources: case,
 * punctuation and the hymnal's elisions ("heav'n", "pow'r", "o'er") all vary
 * between the printed book and Hymnary's index.
 */
function normalize(line) {
  return line
    .toLowerCase()
    .replace(/^\t+/, "")
    .replace(/[’']/g, "")
    // Expand the elisions 19th-century hymnals use for scansion.
    .replace(/\bheavn/g, "heaven")
    .replace(/\bpowr/g, "power")
    .replace(/\boer\b/g, "over")
    .replace(/\beer\b/g, "ever")
    .replace(/\bneer\b/g, "never")
    .replace(/\bevry\b/g, "every")
    .replace(/\btis\b/g, "it is")
    .replace(/\bblest\b/g, "blessed")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Watts, Isaac, 1674-1748" → "Isaac Watts" */
function tidyName(raw) {
  let name = raw.replace(/,?\s*(?:ca\.\s*)?\d{3,4}\s*[-–]\s*\d{0,4}\.?$/, "").trim();
  name = name.replace(/,\s*$/, "");
  const parts = name.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    // "Watts, Isaac" → "Isaac Watts"; drop a parenthetical expansion.
    const given = parts[1].replace(/\([^)]*\)/g, "").trim();
    name = `${given} ${parts[0]}`.trim();
  }
  return name.replace(/\s+/g, " ").trim();
}

/** Anything that isn't a single identifiable person shouldn't be claimed. */
function isUsable(name) {
  if (!name || name.length < 4) return false;
  if (name.split(" ").length < 2) return false;
  return !/anon|unknown|various|traditional|source|century|psalter|hymnal|attr\b/i.test(name);
}

const byNormalized = new Map();
for (const [firstLine, info] of Object.entries(harvest.entries)) {
  const key = normalize(firstLine);
  if (!byNormalized.has(key)) byNormalized.set(key, info);
}

const exact = [];
const nearMisses = [];
let alreadyKnown = 0;
let agreed = 0;
let disagreed = 0;

for (const hymn of hymnal.hymns) {
  const first = (hymn.stanzas?.[0]?.[0] ?? "").replace(/^\t+/, "");
  if (!first) continue;
  const key = normalize(first);
  const hit = byNormalized.get(key);

  if (hymn.author) {
    alreadyKnown++;
    if (hit) {
      const proposed = tidyName(hit.author);
      // Cross-check the attributions already in the file against Hymnary.
      const same = proposed.split(" ").at(-1) === hymn.author.split(" ").at(-1);
      if (same) {
        agreed++;
      } else {
        disagreed++;
        nearMisses.push(`  ${hymn.number}: have "${hymn.author}", Hymnary says "${proposed}"`);
      }
    }
    continue;
  }

  if (!hit) continue;
  const name = tidyName(hit.author);
  if (!isUsable(name)) {
    nearMisses.push(`  ${hymn.number}: unusable attribution "${hit.author}"`);
    continue;
  }
  exact.push({ number: hymn.number, author: name, first });
}

console.log(`harvest: ${Object.keys(harvest.entries).length} first lines from Hymnary`);
console.log(`hymnal:  ${hymnal.hymns.length} hymns, ${alreadyKnown} already attributed`);
console.log(`cross-check on existing: ${agreed} agree, ${disagreed} disagree`);
console.log(`\nnew exact matches: ${exact.length}`);
for (const m of exact.slice(0, 60)) console.log(`  ${m.number}  ${m.author.padEnd(28)} ${m.first.slice(0, 46)}`);
if (exact.length > 60) console.log(`  … and ${exact.length - 60} more`);

if (nearMisses.length) {
  console.log(`\nfor review (${nearMisses.length}):`);
  for (const n of nearMisses.slice(0, 40)) console.log(n);
}

if (!write) {
  console.log(`\n(dry run — pass --write to merge the ${exact.length} exact matches into ${AUTHORS})`);
  process.exit(0);
}

for (const { number, author } of exact) {
  authors[number] = { author, source: "hymnary.org (scripture API, matched by first line)" };
}
writeFileSync(AUTHORS, `${JSON.stringify(authors, null, 2)}\n`);
console.log(`\n✓ merged ${exact.length} attributions into ${AUTHORS}`);
console.log("  re-run scripts/extract-hymns.mjs to fold them into the hymnal");
