import { test } from "node:test";
import assert from "node:assert/strict";
import { formatSongFile, guessMeter, guessTitle, parsePastedSong, slugify } from "../scripts/song-text.mjs";

// Shapes only, with placeholder words: what matters is the layout each source uses.
const hymnary = `Representative Text
1 first verse line one goes here now,
second line of the verse is here;
third line of the verse goes on now,
fourth line of the verse ends here.
Refrain:
refrain line one is sung here, sung here,
refrain line two comes after it!
3 lines in the refrain this time; [Refrain]
2 second verse line one goes here now,
second verse line two is here;
second verse line three goes on now,
second verse line four ends here. [Refrain]`;

test("hymnary.org layout: numbers, a refrain written once, pointers dropped", () => {
  const { blocks } = parsePastedSong(hymnary);
  assert.deepEqual(
    blocks.map((b) => [b.refrain, b.lines.length]),
    [
      [false, 4],
      [true, 3],
      [false, 4],
    ],
  );
  assert.equal(blocks[0].lines[0], "First verse line one goes here now,");
  assert.equal(blocks[1].lines[2], "3 lines in the refrain this time;");
  assert.ok(blocks.every((b) => b.lines.every((l) => !/refrain\]/i.test(l))));
});

test("plain paste: blank lines separate stanzas, a repeated chorus is kept once", () => {
  const { blocks } = parsePastedSong(
    "one\ntwo\n\nChorus\nsing\nsing more\n\nthree\nfour\n\nChorus:\nsing\nsing more\n",
  );
  assert.deepEqual(
    blocks.map((b) => [b.refrain, b.lines.join("/")]),
    [
      [false, "One/Two"],
      [true, "Sing/Sing more"],
      [false, "Three/Four"],
    ],
  );
});

test("a line that only starts with a number is not a verse number", () => {
  const { blocks } = parsePastedSong("Ten thousand times\nten thousand\n\n2 more lines\nhere\n");
  assert.equal(blocks.length, 2);
  assert.equal(blocks[1].lines[0], "2 more lines");
});

test("meter guess takes the common count across verses", () => {
  const blocks = [
    { refrain: false, lines: ["Come thou fount of every blessing", "Tune my heart to sing thy grace"] },
    { refrain: false, lines: ["Here I raise mine Ebenezer", "Hither by thy help I'm come"] },
    { refrain: false, lines: ["O to grace how great a debtor", "Daily I'm constrained to be"] },
  ];
  assert.equal(guessMeter(blocks), "8.7");
});

test("title, file name and file", () => {
  const blocks = [{ refrain: false, lines: ["O to be like Thee! Blessed", "b", "c", "d"] }];
  assert.equal(guessTitle(blocks), "O to Be Like Thee");
  assert.equal(slugify("'Tis So Sweet to Trust in Jesus"), "tis-so-sweet-to-trust-in-jesus");
  assert.equal(
    formatSongFile({ title: "T", author: "A", meter: "", source: "public domain" }, [
      { refrain: false, lines: ["a", "b", "c", "d"] },
      { refrain: true, lines: ["e", "f"] },
    ]),
    "Title: T\nAuthor: A\nSource: public domain\n\na\n\tb\nc\n\td\n\nRefrain:\ne\nf\n",
  );
});
