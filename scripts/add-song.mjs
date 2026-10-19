/**
 * Add a song to More Songs from words copied anywhere.
 *
 *   npm run add-song                      words from the clipboard (macOS)
 *   npm run add-song -- --file words.txt  words from a file
 *   pbpaste | npm run add-song            words piped in
 *
 * It asks for whatever it can't work out (title, author, meter, why it's safe
 * to include), suggesting an answer for each, then writes songs/<title>.txt
 * and rebuilds the book. Every question can be answered up front instead:
 *
 *   --title "O to Be Like Thee" --author "Thomas O. Chisholm"
 *   --meter "10.9.10.9 with refrain" --source "public domain (1897)"
 *   --no-indent   leave every line flush left
 *   --yes         take the suggestions without asking
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { formatSongFile, guessMeter, guessTitle, parsePastedSong, slugify } from "../lib/song-text.ts";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

function readWords() {
  const file = flag("file");
  if (file) return readFileSync(file, "utf8");
  if (!process.stdin.isTTY) return readFileSync(0, "utf8");
  try {
    return execFileSync("pbpaste", { encoding: "utf8" });
  } catch {
    console.error("Copy the words first, or pass --file words.txt.");
    process.exit(1);
  }
}

const words = readWords();
const { blocks } = parsePastedSong(words);
if (blocks.filter((b) => !b.refrain).length === 0) {
  console.error("Couldn't find any verses in that. Copy just the words of the song and try again.");
  process.exit(1);
}

const interactive = process.stdin.isTTY && !has("yes");
const prompt = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;

async function ask(question, suggestion, given) {
  if (given !== undefined) return given;
  if (!prompt) return suggestion;
  const answer = (await prompt.question(`${question}${suggestion ? ` [${suggestion}]` : ""}: `)).trim();
  return answer || suggestion;
}

const verses = blocks.filter((b) => !b.refrain).length;
console.log(`\nFound ${verses} ${verses === 1 ? "verse" : "verses"}${blocks.some((b) => b.refrain) ? " and a refrain" : ""}.\n`);

const title = await ask("Title", guessTitle(blocks), flag("title"));
const author = await ask("Author", "", flag("author"));
const meter = await ask("Meter (a guess from the syllables; check it)", guessMeter(blocks), flag("meter"));
const source = await ask(
  "Why it's safe to include (published before 1930 is public domain)",
  "public domain",
  flag("source"),
);
prompt?.close();

if (!title) {
  console.error("A song needs a title.");
  process.exit(1);
}

const path = `songs/${slugify(title)}.txt`;
if (existsSync(path) && !has("force")) {
  console.error(`${path} already exists. Pass --force to replace it.`);
  process.exit(1);
}

writeFileSync(path, formatSongFile({ title, author, meter, source }, blocks, { indent: !has("no-indent") }));
console.log(`\n✓ wrote ${path}`);

const build = spawnSync(process.execPath, ["scripts/build-other-songs.mjs"], { stdio: "inherit" });
process.exitCode = build.status ?? 1;
