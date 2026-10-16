// The search engine, tested against the real books.
//
// lib/search.ts has no runtime imports, so Node (which strips TypeScript types
// natively) loads it directly. Nothing here reimplements anything from
// hymnals.ts: the indexes are built from the JSON with the engine's own
// `buildIndex`.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { authorName, buildIndex, highlightRanges, normalize, search } from "../lib/search.ts";

const load = (name) =>
  JSON.parse(fs.readFileSync(new URL(`../data/hymnals/${name}.json`, import.meta.url), "utf8"));

const collection = load("brethren");
const otherSongs = load("other-songs");
const pendingSongs = JSON.parse(
  fs.readFileSync(new URL("../data/pending-songs.json", import.meta.url), "utf8"),
).songs;

// Registry order: the collection first, so ties go to it.
const indexes = [buildIndex(collection), buildIndex(otherSongs)];

const COLLECTION = collection.id;
const OTHER = otherSongs.id;
const otherNumber = (title) => otherSongs.hymns.find((h) => h.title === title).number;

const find = (query, options) => search(indexes, query, options);
const refs = (query, options) => find(query, options).hits.map((h) => `${h.bookId}:${h.number}`);
const ref = (bookId, number) => `${bookId}:${number}`;
const other = (title) => ref(OTHER, otherNumber(title));

const stripTabs = (line) => line.replace(/^\t+/, "");

describe("normalize", () => {
  test("lowercases, strips diacritics and punctuation, collapses space", () => {
    assert.equal(normalize("  Holy,  HOLY — holy!  "), "holy holy holy");
    assert.equal(normalize("Café, naïve Zoë"), "cafe naive zoe");
    assert.equal(normalize("As I have loved you.—John 13:34."), "as i have loved you john 13 34");
    assert.equal(normalize("!!"), "");
    assert.equal(normalize("   "), "");
  });

  test("every apostrophe glyph is the same apostrophe", () => {
    for (const apostrophe of ["'", "’", "‘", "‛", "`", "´"]) {
      assert.equal(normalize(`${apostrophe}Tis so sweet`), "tis so sweet");
      assert.equal(normalize(`ev${apostrophe}ry`), "every");
    }
  });

  // Derived from the data: every apostrophised word in both books, with
  // frequencies, was listed and checked against a dictionary. These are the
  // shapes that occur, with the common words and the irregular ones.
  const elisions = {
    "ev’ry": "every",
    "ev’rywhere": "everywhere",
    "ev’ning": "evening",
    "heav’n": "heaven",
    "heav’nly": "heavenly",
    "heav’n’s": "heavens",
    "o’er": "over",
    "o’erflow": "overflow",
    "O’erwhelm’d": "overwhelmed",
    "e’er": "ever",
    "ne’er": "never",
    "whate’er": "whatever",
    "where’er": "wherever",
    "e’en": "even",
    "pow’r": "power",
    "pow’rs": "powers",
    "flow’r": "flower",
    "flow’ry": "flowery",
    "pray’r": "prayer",
    "giv’n": "given",
    "forgiv’n": "forgiven",
    "ris’n": "risen",
    "wand’ring": "wandering",
    "sov’reign": "sovereign",
    "lov’d": "loved",
    "bless’d": "blessed",
    "call’d": "called",
    "glorifi’d": "glorified",
    "carry’d": "carried",
    "vict’ry": "victory",
    "mem’ry": "memory",
    "tho’t": "thought",
    "Abra’am": "abraham",
    "’tis": "tis",
    "’twas": "twas",
    "’mid": "amid",
    "’round": "round",
    "th’ eternal": "the eternal",
    "th’angelic": "the angelic",
    "thro’": "through",
    "tho’": "though",
    "God’s": "gods",
    "Jesus’": "jesus",
    "Calv’ry’s": "calvarys",
    "I’ll": "ill",
    "can’t": "cant",
    "I’d": "id",
    "may’st": "mayst",
  };
  for (const [raw, expected] of Object.entries(elisions)) {
    test(`${raw} → ${expected}`, () => assert.equal(normalize(raw), expected));
  }

  test("repairs the stray spaces the scan left inside words", () => {
    assert.equal(normalize("The Christian ‘s Wants"), "the christians wants");
    assert.equal(normalize("Appear’ d a shining throng"), "appeared a shining throng");
    assert.equal(normalize("But there’s a pow’ r which man"), "but theres a power which man");
    assert.equal(normalize("‘T is here he humbly asks"), "tis here he humbly asks");
  });

  test("spelling variants meet in the middle", () => {
    assert.equal(normalize("saviour"), normalize("savior"));
    assert.equal(normalize("Saviour’s honour and colour"), "saviors honor and color");
    assert.equal(normalize("labour, neighbour, endeavour"), "labor neighbor endeavor");
    assert.equal(normalize("sceptre lustre mould"), "scepter luster mold");
    assert.equal(normalize("baptised and organised"), "baptized and organized");
    assert.equal(normalize("To-day, to-morrow"), "today tomorrow");
    assert.equal(normalize("Oh, for a thousand tongues"), normalize("O for a thousand tongues"));
  });

  test("real words that only look like British spellings are left alone", () => {
    assert.equal(normalize("our hour, your four, pour devour"), "our hour your four pour devour");
  });

  test("every apostrophised word in both books normalises to apostrophe-free words", () => {
    const seen = new Set();
    for (const book of [collection, otherSongs]) {
      for (const hymn of book.hymns) {
        for (const line of [hymn.title, ...hymn.stanzas.flat().map(stripTabs)]) {
          for (const [word] of line.matchAll(/[\p{L}'’‘]*['’‘][\p{L}'’‘]*/gu)) seen.add(word);
        }
      }
    }
    assert.ok(seen.size > 400, `expected a few hundred distinct apostrophised words, got ${seen.size}`);
    for (const word of seen) {
      const out = normalize(word);
      assert.doesNotMatch(out, /['’‘`´]/, `${word} → ${out}`);
    }
  });
});

describe("authorName", () => {
  test("names only: no years, no translator or composer credits", () => {
    assert.equal(authorName("Henry F. Lyte, 1847"), "Henry F. Lyte");
    assert.equal(
      authorName("Martin Luther, 1529. Translation composite circa 1868 Pennsylvania Lutheran Church Book"),
      "Martin Luther",
    );
    assert.equal(authorName("Martin Rinkart, c.1636. Translated Catherine Winkworth, 1856"), "Martin Rinkart");
    assert.equal(authorName("Isaac Watts"), "Isaac Watts");
    assert.equal(authorName("William Wordsworth"), "William Wordsworth");
    assert.equal(authorName(null), "");
  });
});

describe("index", () => {
  test("entries carry number, display title, normalised fields and per-stanza text", () => {
    const entry = indexes[0].entries.find((e) => e.number === 1);
    assert.equal(entry.displayTitle, "Eternity of God.");
    assert.equal(entry.title, "eternity of god");
    assert.equal(entry.firstLine, "through endless years thou art the same");
    assert.equal(
      entry.stanzaText[0],
      "through endless years thou art the same o thou eternal god ages to come shall know thy name and tell thy works abroad",
    );
    assert.equal(entry.stanzaText.length, collection.hymns[0].stanzas.length);
    assert.equal(entry.lines[0][1], "O thou eternal God!", "tabs are stripped from the original lines");
  });

  test("untitled hymns are shown by their first line", () => {
    const untitled = collection.hymns.filter((h) => !h.title);
    assert.equal(untitled.length, 19);
    for (const h of untitled) {
      const entry = indexes[0].entries.find((e) => e.number === h.number);
      assert.equal(entry.displayTitle, stripTabs(h.stanzas[0][0]));
      assert.equal(entry.title, "");
    }
  });

  test("authors are indexed as names, without years", () => {
    const lyte = indexes[1].entries.find((e) => e.number === otherNumber("Abide with Me"));
    assert.equal(lyte.author, "henry f lyte");
    const luther = indexes[1].entries.find((e) => e.number === otherNumber("A Mighty Fortress Is Our God"));
    assert.equal(luther.author, "martin luther");
  });
});

describe("search: finding hymns by what people remember", () => {
  test("holy holy holy → Other Songs 'Holy, Holy, Holy' first", () => {
    assert.equal(refs("holy holy holy")[0], other("Holy, Holy, Holy"));
  });

  test("nearer my god to thee → Collection 498 first", () => {
    assert.equal(refs("nearer my god to thee")[0], ref(COLLECTION, 498));
  });

  test("jesus lover of my soul → Collection 491 first", () => {
    assert.equal(refs("jesus lover of my soul")[0], ref(COLLECTION, 491));
  });

  test("the book's ev'ry is found by every", () => {
    assert.equal(refs("come thou fount of every blessing")[0], ref(COLLECTION, 84));
    assert.equal(refs("come thou fount")[0], ref(COLLECTION, 84));
    assert.equal(refs("come thou fount of ev'ry blessing")[0], ref(COLLECTION, 84));
  });

  test("amazing grace → Other Songs 'Amazing Grace' first", () => {
    assert.equal(refs("amazing grace")[0], other("Amazing Grace"));
  });

  test("typos still find it: amazin grace, amazing grase", () => {
    for (const query of ["amazin grace", "amazing grase", "amazing garce", "amazign grace"]) {
      const top3 = refs(query, { limit: 3 });
      assert.ok(top3.includes(other("Amazing Grace")), `${query} → ${top3}`);
    }
    for (const hit of find("amazing grase").hits) assert.equal(hit.fuzzy, true);
  });

  test("a phrase that wraps onto the next line: 'sweet the sound that saved'", () => {
    const top3 = refs("sweet the sound that saved", { limit: 3 });
    assert.ok(top3.includes(other("Amazing Grace")), String(top3));
  });

  test("it is well with my soul → first; 'it is well' → top 2", () => {
    const wanted = other("It Is Well with My Soul");
    assert.equal(refs("it is well with my soul")[0], wanted);
    assert.ok(refs("it is well", { limit: 2 }).includes(wanted));
  });

  test("'Tis So Sweet, however it is typed", () => {
    const wanted = other("'Tis So Sweet to Trust in Jesus");
    for (const query of ["'tis so sweet", "tis so sweet", "’tis so sweet", "TIS SO SWEET", "'Tis so sweet!"]) {
      assert.equal(refs(query)[0], wanted, query);
    }
  });

  test("savior and saviour give identical result sets", () => {
    const a = find("savior", { limit: 1000 });
    const b = find("saviour", { limit: 1000 });
    assert.deepEqual(a, b);
    assert.ok(a.total > 50);
  });

  test("Oh, for a thousand tongues is found as O for a thousand tongues", () => {
    assert.equal(refs("o for a thousand tongues")[0], ref(COLLECTION, 26));
    assert.equal(refs("oh for a thousand tongues")[0], ref(COLLECTION, 26));
  });

  test("the book's To-day and To-morrow are found as today and tomorrow", () => {
    assert.deepEqual(find("to-day", { limit: 1000 }), find("today", { limit: 1000 }));
    assert.ok(find("today").total > 10);
    assert.ok(refs("tomorrow", { limit: 3 }).includes(ref(COLLECTION, 229)), "Wait not for To-morrow");
    assert.deepEqual(highlightRanges("Wait not for To-morrow.", "tomorrow"), [[13, 22]]);
  });

  test("title words and the book's topical titles are searchable", () => {
    assert.equal(refs("eternity of god")[0], ref(COLLECTION, 1));
    assert.equal(find("eternity of god").hits[0].matchedOn, "title");
  });

  test("a phrase typed with the last word unfinished", () => {
    assert.equal(refs("come thou fo")[0], ref(COLLECTION, 84));
    assert.equal(refs("amazing gra")[0], other("Amazing Grace"));
  });

  test("words in the wrong order still find the hymn, below phrase matches", () => {
    const hits = find("blessing every fount", { limit: 5 }).hits;
    assert.ok(hits.some((h) => h.bookId === COLLECTION && h.number === 84));
    assert.ok(hits[0].score < 600, "any-order matches rank below phrase matches");
  });

  test("an extra or misremembered word still points at the hymn", () => {
    assert.ok(refs("come thou fount of all blessing", { limit: 3 }).includes(ref(COLLECTION, 84)));
    assert.ok(refs("amazing grace how sour the sound", { limit: 3 }).includes(other("Amazing Grace")));
    for (const hit of find("amazing grace how sour the sound").hits) assert.equal(hit.fuzzy, true);
  });

  test("a space where the book has an apostrophe: 'ev ry', 'heav nly', 'o er', 'death s'", () => {
    const cases = {
      "from ev ry stormy": 21,
      "heav nly father": 76,
      "come heav nly love": 497,
      "did christ o er": 256,
      "death s but a": 391,
      "i m not asham d": 482,
      "now lord we ll": 307,
      "to day the savior": 436,
    };
    for (const [query, number] of Object.entries(cases)) {
      assert.equal(refs(query)[0], ref(COLLECTION, number), query);
    }
    // ...and only where the book really has the joined word.
    assert.equal(refs("louisa m r stead")[0], other("'Tis So Sweet to Trust in Jesus"));
    assert.equal(find("louisa m r stead").hits[0].matchedOn, "author");
  });

  test("an alias never swallows a word that is still being typed", () => {
    // "tho" means "though", but on the way to "thou" it must still find hymn 84.
    assert.equal(refs("come tho")[0], ref(COLLECTION, 84));
    assert.equal(refs("come thou")[0], ref(COLLECTION, 84));
    // Likewise "thro" (through) on the way to "throne", and "mid" (amid) to "midst".
    assert.deepEqual(highlightRanges("The throne of God", "thro"), [[4, 10]]);
    assert.deepEqual(highlightRanges("Though and thou", "tho"), [
      [0, 6],
      [11, 15],
    ]);
    assert.deepEqual(highlightRanges("In the midst of it", "mid"), [[7, 12]]);
  });

  test("nonsense finds nothing", () => {
    assert.deepEqual(find("xyzzy").hits, []);
    assert.deepEqual(find("xyzzy plugh quux").hits, []);
  });

  test("a song that is not in the books is not conjured from common words", () => {
    // Nothing here is a phrase worth trusting once one word is ignored.
    assert.deepEqual(find("just as i am").hits, []);
    assert.deepEqual(find("love divine all loves excelling").hits, []);
  });
});

describe("search: numbers", () => {
  test("26, hymn 26, #26, no. 26, number 26 → Collection 26 first", () => {
    for (const query of ["26", "hymn 26", "#26", "no. 26", "No 26", "number 26", "Hymn #26", " 26 "]) {
      const hit = find(query).hits[0];
      assert.equal(`${hit.bookId}:${hit.number}`, ref(COLLECTION, 26), query);
      assert.equal(hit.matchedOn, "number", query);
      assert.equal(hit.snippet, null);
    }
  });

  test("then the numbers that start with it, in order", () => {
    assert.deepEqual(
      refs("26", { limit: 20 }),
      [26, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269].map((n) => ref(COLLECTION, n)),
    );
    assert.equal(find("26").total, 11);
  });

  test("an unnumbered book is never searched by its internal ids", () => {
    // Other Songs has songs numbered 1–42, but the numbers are not shown.
    for (const query of ["2", "20", "#42", "hymn 30"]) {
      assert.ok(!find(query).hits.some((h) => h.bookId === OTHER && h.matchedOn === "number"), query);
    }
  });

  test("73 → no Other Songs results via author years (Spafford, 1873)", () => {
    const hits = find("73", { limit: 1000 }).hits;
    assert.equal(hits[0].number, 73);
    assert.equal(hits[0].bookId, COLLECTION);
    assert.deepEqual(
      hits.filter((h) => h.bookId === OTHER),
      [],
    );
    // Not even as plain text: 1873 is not 73.
    assert.deepEqual(
      search([indexes[1]], "73").hits,
      [],
    );
    assert.deepEqual(search([indexes[1]], "1873").hits, [], "years are not indexed at all");
  });

  test("a number that is not in the book finds nothing", () => {
    assert.deepEqual(find("999").hits, []);
  });
});

describe("search: authors", () => {
  const wattsHymns = [collection, otherSongs]
    .flatMap((book) => book.hymns)
    .filter(
      (h) =>
        /\bwatts\b/i.test(h.author ?? "") ||
        /\bwatts\b/i.test([h.title, ...h.stanzas.flat()].join(" ")),
    );

  test("watts: total is the true count of Watts hymns, and exceeds the 40 shown", () => {
    const { hits, total } = find("watts", { limit: 40 });
    assert.equal(hits.length, 40);
    assert.ok(total > hits.length, `total ${total} vs ${hits.length}`);
    assert.equal(total, wattsHymns.length);
    assert.equal(find("watts", { limit: 1000 }).hits.length, wattsHymns.length);
    for (const hit of hits) {
      assert.equal(hit.matchedOn, "author");
      assert.equal(hit.fuzzy, false, "no 'wants' or 'waits' trailing behind a good answer");
    }
  });

  test("full names and surnames both work; initials in the data do not get in the way", () => {
    assert.ok(find("isaac watts").total === wattsHymns.length);
    assert.ok(find("charles wesley").total >= 21);
    assert.ok(refs("lyte", { limit: 10 }).includes(other("Abide with Me")));
  });
});

describe("search: edge cases", () => {
  test("whitespace and punctuation alone return nothing", () => {
    for (const query of ["", "   ", "!!", " ?! ", "...", "’’’", "—"]) {
      assert.deepEqual(find(query), { hits: [], total: 0 }, JSON.stringify(query));
    }
  });

  test("limit applies after merging, total counts everything", () => {
    const all = find("lord", { limit: 100000 });
    const some = find("lord", { limit: 7 });
    assert.equal(some.hits.length, 7);
    assert.equal(some.total, all.total);
    assert.deepEqual(some.hits, all.hits.slice(0, 7));
    assert.deepEqual(find("lord", { limit: 0 }).hits, []);
  });

  test("results are sorted by score, then book order, then number", () => {
    for (const query of ["holy", "love", "grace", "26", "watts", "the lord", "jesus"]) {
      const { hits } = find(query, { limit: 100000 });
      for (let i = 1; i < hits.length; i++) {
        const a = hits[i - 1];
        const b = hits[i];
        const bookOrder = (id) => (id === COLLECTION ? 0 : 1);
        assert.ok(
          a.score > b.score ||
            (a.score === b.score &&
              (bookOrder(a.bookId) < bookOrder(b.bookId) ||
                (a.bookId === b.bookId && a.number < b.number))),
          `${query}: ${JSON.stringify(a)} before ${JSON.stringify(b)}`,
        );
      }
    }
  });

  test("books are merged by score, not interleaved by position", () => {
    // One song in Other Songs starts "Amazing grace"; the collection has none
    // that start that way. It outranks the collection's weaker matches.
    const hits = find("amazing grace").hits;
    assert.equal(hits[0].bookId, OTHER);
    assert.ok(hits.slice(1).every((h) => h.score < hits[0].score));
  });

  test("exact matches always outrank fuzzy ones", () => {
    for (const query of ["jesus", "hear", "love", "grace and truth", "crown him"]) {
      const { hits } = find(query, { limit: 100000 });
      const firstFuzzy = hits.findIndex((h) => h.fuzzy);
      if (firstFuzzy >= 0) assert.ok(hits.slice(firstFuzzy).every((h) => h.fuzzy), query);
    }
  });

  test("a hit says how it matched", () => {
    const first = (q) => find(q).hits[0];
    assert.equal(first("nearer my god to thee").matchedOn, "firstLine");
    assert.equal(first("eternity of god").matchedOn, "title");
    assert.equal(first("26").matchedOn, "number");
    assert.equal(find("watts").hits[0].matchedOn, "author");
    assert.equal(first("sweet the sound that saved").matchedOn, "text");
    for (const q of ["nearer my god to thee", "eternity of god", "26", "watts"]) {
      assert.equal(first(q).snippet, null, "only text matches carry a snippet");
    }
  });

  test("text snippets are the matching line and the next, from the original text", () => {
    const hit = find("sweet the sound that saved").hits[0];
    assert.equal(hit.snippet, "AMAZING grace! how sweet the sound / That saved a wretch like me!");
    assert.ok(!hit.snippet.includes("\t"));

    // The phrase is on the second line of the stanza; the snippet starts there.
    const second = find("that saved a wretch").hits[0];
    assert.equal(second.snippet.split(" / ")[0], "That saved a wretch like me!");
    assert.equal(second.snippet.split(" / ").length, 2);

    for (const hit of find("lord", { limit: 100 }).hits) {
      if (hit.matchedOn === "text") assert.match(hit.snippet, /\S/);
    }
  });

  test("typo tolerance: nothing under 4 letters; one edit for 4–7; two for 8+", () => {
    // 3 letters: never fuzzy.
    assert.deepEqual(highlightRanges("the king", "tge"), []);
    // 4–7 letters: one edit — substitution, deletion, insertion, adjacent swap.
    assert.deepEqual(highlightRanges("the king", "kign"), [[4, 8]]);
    assert.deepEqual(highlightRanges("the king", "kinng"), [[4, 8]]);
    assert.deepEqual(highlightRanges("the king", "kng"), [], "3 letters");
    assert.deepEqual(highlightRanges("the kingdom", "kingdm"), [[4, 11]]);
    // ...but not two.
    assert.deepEqual(highlightRanges("redeeming", "redemng"), [], "7 letters, 2 edits");
    // 8+ letters: two edits.
    assert.deepEqual(highlightRanges("redeeming love", "reedeemng"), [[0, 9]]);
    assert.deepEqual(highlightRanges("redeeming love", "redeemin"), [[0, 9]], "prefix of the last word");
    // Digits are never fuzzy: 1873 is not 1874.
    assert.deepEqual(highlightRanges("Spafford, 1873", "1874"), []);
  });
});

describe("pending songs use the same engine", () => {
  const pendingIndex = buildIndex({
    id: "pending",
    numbered: false,
    hymns: pendingSongs.map((song, i) => ({ number: i, title: song.title, author: song.author ?? null, stanzas: [] })),
  });
  const titleOf = (query) =>
    search([pendingIndex], query, { limit: 3 }).hits.map((h) => pendingSongs[h.number].title);

  test("titles, with typos and punctuation", () => {
    assert.equal(titleOf("how great thou art")[0], "How Great Thou Art");
    assert.equal(titleOf("how gerat thou art")[0], "How Great Thou Art");
    assert.equal(titleOf("hallelujah for the blood")[0], "Hallelujah for the Blood");
    assert.equal(titleOf("gods wonderful people")[0], "God's Wonderful People");
    assert.equal(titleOf("feeling fine")[0], "Feelin' Fine");
  });

  test("authors, by name", () => {
    const gaither = search([pendingIndex], "gaither", { limit: 100 });
    assert.ok(gaither.total >= 3);
    assert.ok(gaither.hits.every((h) => h.matchedOn === "author"));
    assert.ok(gaither.hits.every((h) => /gaither/i.test(pendingSongs[h.number].author)));
  });
});

describe("highlightRanges", () => {
  const marked = (text, query) => highlightRanges(text, query).map(([a, b]) => text.slice(a, b));

  test("works through the book's elisions: ev’ry is found by every", () => {
    const text = "Come thou fount of ev’ry blessing";
    const ranges = highlightRanges(text, "every blessing");
    assert.deepEqual(
      ranges.map(([a, b]) => text.slice(a, b)),
      ["ev’ry", "blessing"],
    );
    assert.deepEqual(ranges, [
      [text.indexOf("ev’ry"), text.indexOf("ev’ry") + 5],
      [text.indexOf("blessing"), text.length],
    ]);
  });

  test("marks every holy in Holy, holy, holy!", () => {
    const text = "Holy, holy, holy! Lord God Almighty!";
    assert.deepEqual(marked(text, "holy holy"), ["Holy", "holy", "holy"]);
    assert.deepEqual(highlightRanges(text, "holy holy"), [
      [0, 4],
      [6, 10],
      [12, 16],
    ]);
  });

  test("the last word may be unfinished; earlier ones may not", () => {
    assert.deepEqual(marked("Amazing grace, how sweet", "amazing gra"), ["Amazing", "grace"]);
    assert.deepEqual(marked("Amazing grace, how sweet", "ama grace"), ["grace"]);
  });

  test("typos are marked when there is no exact word to mark instead", () => {
    assert.deepEqual(marked("Amazing grace, how sweet", "amazin grase"), ["Amazing", "grace"]);
    assert.deepEqual(marked("Amazing grace, a grave", "grace"), ["grace"], "exact wins over fuzzy");
  });

  test("apostrophes inside a word stay inside the range", () => {
    assert.deepEqual(marked("'Tis so sweet to trust", "tis"), ["'Tis"]);
    assert.deepEqual(marked("He’s o’er all, heav’n’s King", "over heavens"), ["o’er", "heav’n’s"]);
    assert.deepEqual(marked("The Christian ‘s Wants", "christians"), ["Christian ‘s"]);
  });

  test("ranges index the original string, in order, without overlap", () => {
    const text = "Café, ev’ry  Saviour’s honour!";
    const ranges = highlightRanges(text, "cafe every saviors honor");
    assert.deepEqual(
      ranges.map(([a, b]) => text.slice(a, b)),
      ["Café", "ev’ry", "Saviour’s", "honour"],
    );
    for (let i = 1; i < ranges.length; i++) assert.ok(ranges[i][0] >= ranges[i - 1][1]);
  });

  test("nothing to mark", () => {
    assert.deepEqual(highlightRanges("Holy, holy", ""), []);
    assert.deepEqual(highlightRanges("Holy, holy", "  !! "), []);
    assert.deepEqual(highlightRanges("", "holy"), []);
    assert.deepEqual(highlightRanges("Rock of Ages", "zebra"), []);
  });
});

describe("aggregate: first words of every collection hymn, typed from memory", () => {
  // Plain lowercase, no punctuation at all — the least help a search can get.
  const typed = (hymn, words) =>
    stripTabs(hymn.stanzas[0][0])
      .split(/\s+/)
      .map((w) => w.normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase())
      .filter(Boolean)
      .slice(0, words)
      .join(" ");

  const rankOf = (hymn, query) =>
    find(query, { limit: 40 }).hits.findIndex((h) => h.bookId === COLLECTION && h.number === hymn.number);

  test("first 3 words → in the top 3 for at least 95%", (t) => {
    let hits = 0;
    const misses = [];
    for (const hymn of collection.hymns) {
      const rank = rankOf(hymn, typed(hymn, 3));
      if (rank >= 0 && rank < 3) hits++;
      else misses.push(`${hymn.number} "${typed(hymn, 3)}" → ${rank}`);
    }
    const pct = (100 * hits) / collection.hymns.length;
    const line = `first 3 words, top 3: ${pct.toFixed(1)}% (${hits}/${collection.hymns.length})`;
    console.log(line);
    t.diagnostic(line);
    assert.ok(pct >= 95, `${line}\n${misses.join("\n")}`);
  });

  test("first 5 words → ranked first for at least 90%", (t) => {
    let hits = 0;
    const misses = [];
    for (const hymn of collection.hymns) {
      const rank = rankOf(hymn, typed(hymn, 5));
      if (rank === 0) hits++;
      else misses.push(`${hymn.number} "${typed(hymn, 5)}" → ${rank}`);
    }
    const pct = (100 * hits) / collection.hymns.length;
    const line = `first 5 words, ranked first: ${pct.toFixed(1)}% (${hits}/${collection.hymns.length})`;
    console.log(line);
    t.diagnostic(line);
    assert.ok(pct >= 90, `${line}\n${misses.join("\n")}`);
  });

  test("the same words typed the way the book prints them are found at least as often", () => {
    let hits = 0;
    for (const hymn of collection.hymns) {
      const query = stripTabs(hymn.stanzas[0][0]).split(/\s+/).slice(0, 5).join(" ");
      if (rankOf(hymn, query) === 0) hits++;
    }
    assert.ok((100 * hits) / collection.hymns.length >= 97, `${hits}`);
  });
});
