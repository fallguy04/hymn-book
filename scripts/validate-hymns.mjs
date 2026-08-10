/**
 * Validation gate for the extracted hymnal.
 *
 * Returns hard `errors` (extraction refuses to write) and a soft `report`
 * (things a human should eyeball). The soft list matters as much as the hard
 * one: the previous dataset was structurally valid JSON and still wrong on a
 * third of the book, so the report surfaces every hymn whose shape changed and
 * every stanza whose length disagrees with its declared meter.
 */

const LAST_HYMN = 558;

/** Characters that mean a font's ToUnicode map was skipped somewhere. */
const ENCODING_LEAKS = /[ÞßÕÐÑÓÔﬀﬁﬂﬃﬄ]/;

/**
 * Stanza lengths each metre can legitimately take. Hallelujah Metre is set
 * either as 6.6.6.6.8.8 or as 6.6.8.6.6.8.8.8, so both six and eight lines are
 * correct for it; the common metres double up in some hymns, which the caller
 * allows for by accepting whole multiples.
 */
const METER_LINES = {
  "C.M.": [4],
  "L.M.": [4],
  "S.M.": [4],
  "H.M.": [6, 8],
  "C.P.M.": [6],
  "S.P.M.": [6],
};

export function validate(hymnal, legacy) {
  const errors = [];
  const report = [];
  const { hymns, sections } = hymnal;

  // --- structural integrity -------------------------------------------------

  const seen = new Map();
  for (const h of hymns) {
    if (seen.has(h.number)) errors.push(`hymn ${h.number}: duplicate`);
    seen.set(h.number, h);
  }
  const missing = [];
  for (let n = 1; n <= LAST_HYMN; n++) if (!seen.has(n)) missing.push(n);
  if (missing.length) {
    errors.push(`missing ${missing.length} hymn(s): ${missing.join(", ")}`);
  }

  for (const h of hymns) {
    const at = `hymn ${h.number}`;
    if (!h.stanzas?.length) errors.push(`${at}: no stanzas`);

    h.stanzas?.forEach((stanza, i) => {
      if (!stanza.length) errors.push(`${at}: stanza ${i + 1} is empty`);
      stanza.forEach((line, j) => {
        const body = line.replace(/^\t+/, "");
        if (!body.trim()) errors.push(`${at}: stanza ${i + 1} line ${j + 1} is blank`);
        if (ENCODING_LEAKS.test(body)) {
          errors.push(`${at}: stanza ${i + 1} line ${j + 1} has an undecoded glyph: ${body}`);
        }
      });
    });
  }

  // Titles are the editors' topical labels; a few are genuinely blank in the
  // book (546), so a missing title is worth reporting but is not fatal.
  const untitled = hymns.filter((h) => !h.title).map((h) => h.number);
  if (untitled.length) report.push(`· untitled in the book: ${untitled.join(", ")}`);

  // A few hymns (131, 288, 449) run straight from the heading into the first
  // line with no meter printed at all. Real, so reported rather than fatal.
  const meterless = hymns.filter((h) => !h.meter).map((h) => h.number);
  if (meterless.length) report.push(`· no meter printed: ${meterless.join(", ")}`);

  // --- table of contents ----------------------------------------------------

  const indexed = new Set();
  const walk = (nodes) => {
    for (const node of nodes ?? []) {
      for (const n of node.hymns ?? []) indexed.add(n);
      walk(node.subsections);
    }
  };
  walk(sections);
  if (!sections?.length) errors.push("table of contents is empty");
  const unindexed = hymns.filter((h) => !indexed.has(h.number)).length;
  report.push(
    `· contents: ${sections?.length ?? 0} sections, ` +
      `${sections?.reduce((n, s) => n + s.subsections.length, 0) ?? 0} subsections, ` +
      `${indexed.size}/${hymns.length} hymns indexed` +
      (unindexed ? ` (${unindexed} unindexed)` : ""),
  );

  // --- soft signals ---------------------------------------------------------

  const stanzaCount = hymns.reduce((n, h) => n + h.stanzas.length, 0);
  const shapes = new Map();
  for (const h of hymns) {
    for (const s of h.stanzas) shapes.set(s.length, (shapes.get(s.length) ?? 0) + 1);
  }
  report.push(`· ${hymns.length} hymns, ${stanzaCount} stanzas`);
  report.push(
    `· lines per stanza: ${[...shapes.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([len, n]) => `${len}×${n}`)
      .join("  ")}`,
  );

  // Stanzas of unequal length within one hymn usually mean a page-break call
  // went the wrong way. Worth a look, but the book does contain real cases.
  const ragged = hymns
    .filter((h) => h.stanzas.length > 1 && new Set(h.stanzas.map((s) => s.length)).size > 1)
    .map((h) => h.number);
  if (ragged.length) {
    report.push(`· ${ragged.length} hymn(s) with uneven stanzas — spot-check: ${ragged.join(", ")}`);
  }

  // The book sometimes sets two stanzas of a metre as one block (double L.M.,
  // H.M. printed as eight lines), so a whole multiple is fine; anything else
  // means a stanza boundary was probably read wrong.
  // A stanza shorter than its metre usually means the printed page is missing
  // a line — hymns 155 and 197 each drop one, and the blank is visible in the
  // PDF's own line spacing. Reported, never invented.
  const short = [];
  const overlong = [];
  for (const h of hymns) {
    const allowed = METER_LINES[h.meter];
    if (!allowed) continue;
    for (const s of h.stanzas) {
      if (allowed.some((n) => s.length % n === 0)) continue;
      (s.length < Math.min(...allowed) ? short : overlong).push(h.number);
      break;
    }
  }
  if (short.length) {
    report.push(`· ${short.length} hymn(s) with a line missing from the printed page: ${short.join(", ")}`);
  }
  if (overlong.length) {
    report.push(`· ${overlong.length} hymn(s) with an unexpected stanza length: ${overlong.join(", ")}`);
  }

  if (legacy) {
    const before = new Map(legacy.map((h) => [h.number, h.verses.length]));
    const changed = hymns.filter((h) => before.get(h.number) !== h.stanzas.length);
    report.push(`· ${changed.length} hymn(s) differ in stanza count from the previous dataset`);
  }

  return { errors, report };
}
