/**
 * Read and triage song suggestions.
 *
 *   node scripts/suggestions.mjs              # everything still open
 *   node scripts/suggestions.mjs --all        # including handled ones
 *   node scripts/suggestions.mjs --done 12    # mark #12 handled
 *   node scripts/suggestions.mjs --reopen 12
 *
 * A stopgap so suggestions are reachable at all — a table nobody opens is the
 * same as no suggestions box. Reads DATABASE_URL from .env.local.
 */

import { readFileSync, existsSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (existsSync(".env.local")) {
    const match = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m);
    if (match) return match[1].trim();
  }
  console.error("✗ No DATABASE_URL (checked the environment and .env.local)");
  process.exit(1);
}

const sql = neon(databaseUrl());
const args = process.argv.slice(2);

const flagValue = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? null : args[at + 1];
};

const done = flagValue("--done");
const reopen = flagValue("--reopen");

if (done) {
  await sql`UPDATE song_suggestions SET status = 'done' WHERE id = ${done}`;
  console.log(`✓ #${done} marked handled`);
  process.exit(0);
}

if (reopen) {
  await sql`UPDATE song_suggestions SET status = 'new' WHERE id = ${reopen}`;
  console.log(`✓ #${reopen} reopened`);
  process.exit(0);
}

const showAll = args.includes("--all");
const rows = showAll
  ? await sql`SELECT * FROM song_suggestions ORDER BY created_at DESC`
  : await sql`SELECT * FROM song_suggestions WHERE status = 'new' ORDER BY created_at DESC`;

if (rows.length === 0) {
  console.log(showAll ? "No suggestions yet." : "Nothing outstanding.");
  process.exit(0);
}

console.log(`${rows.length} suggestion(s)${showAll ? "" : " outstanding"}:\n`);
for (const row of rows) {
  const when = new Date(row.created_at).toLocaleString();
  const mark = row.status === "done" ? "✓" : "•";
  console.log(`${mark} #${row.id}  ${row.title}`);
  if (row.note) console.log(`     note:     ${row.note}`);
  // Worth showing when it differs: it is what they actually typed, which
  // sometimes says more about what they wanted than the title they settled on.
  if (row.query && row.query !== row.title) console.log(`     searched: ${row.query}`);
  console.log(`     ${when}${row.hymnal_id ? ` · in ${row.hymnal_id}` : ""}\n`);
}
