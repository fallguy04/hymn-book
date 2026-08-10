/**
 * Minimal PDF text extractor for eHymnbook.pdf.
 *
 * This file exists instead of a PDF dependency because we need something no
 * general-purpose extractor gives us: the *typographic* signals the hymnal
 * encodes. Stanza breaks in this book are a 30pt text leading where a normal
 * line break is 15pt, and hymn headings are distinguished from body text by
 * sitting 9pt further left. A library that flattens the page to a string
 * throws exactly that away — which is how the original data ended up chunked
 * into uniform four-line verses.
 *
 * Scope is deliberately narrow: uncompressed xref, Flate content streams,
 * simple fonts with ToUnicode CMaps. That is what Ghostscript 9.55 emitted
 * here. It is not a general PDF reader.
 */

import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

/** Index every `N 0 obj … endobj` in the file by object number. */
function indexObjects(buf) {
  const objects = new Map();
  const re = /(\d+)\s+(\d+)\s+obj/g;
  const text = buf.toString("latin1");
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = m.index + m[0].length;
    const end = text.indexOf("endobj", start);
    if (end === -1) continue;
    objects.set(Number(m[1]), { start, end, text: text.slice(start, end) });
  }
  return { objects, text };
}

const REF = /^\s*(\d+)\s+0\s+R\s*$/;

/** Follow `N 0 R` indirection until we land on a literal. */
function resolve(objects, value) {
  let seen = 0;
  while (typeof value === "string" && REF.test(value) && seen++ < 32) {
    const num = Number(value.match(REF)[1]);
    const obj = objects.get(num);
    if (!obj) return null;
    value = obj.text;
  }
  return value;
}

/**
 * Read one key out of a dictionary body. Handles nested `<<>>` and `[]` so
 * that `/Resources<</Font 12 0 R>>` doesn't confuse the scan.
 */
function dictGet(body, key) {
  const at = body.indexOf(`/${key}`);
  if (at === -1) return null;
  let i = at + key.length + 1;
  while (i < body.length && /\s/.test(body[i])) i++;
  if (body[i] === "<" && body[i + 1] === "<") {
    let depth = 0;
    const start = i;
    while (i < body.length) {
      if (body[i] === "<" && body[i + 1] === "<") { depth++; i += 2; continue; }
      if (body[i] === ">" && body[i + 1] === ">") { depth--; i += 2; if (depth === 0) break; continue; }
      i++;
    }
    return body.slice(start, i);
  }
  if (body[i] === "[") {
    const start = i;
    let depth = 0;
    while (i < body.length) {
      if (body[i] === "[") depth++;
      else if (body[i] === "]") { depth--; if (depth === 0) { i++; break; } }
      i++;
    }
    return body.slice(start, i);
  }
  const rest = body.slice(i);
  const ref = rest.match(/^(\d+\s+0\s+R)/);
  if (ref) return ref[1];
  const token = rest.match(/^(\/?[^\s/<>[\]]+)/);
  return token ? token[1] : null;
}

/** Inflate an object's stream payload. */
function streamOf(buf, fileText, objects, objNum) {
  const obj = objects.get(objNum);
  if (!obj) return null;
  const marker = obj.text.match(/stream\r?\n/);
  if (!marker) return null;
  const start = obj.start + marker.index + marker[0].length;
  const end = fileText.indexOf("endstream", start);
  const raw = buf.subarray(start, end);
  try {
    return inflateSync(raw);
  } catch {
    return null;
  }
}

/** Parse a ToUnicode CMap into a code → string map. */
function parseCMap(text) {
  const map = new Map();
  const hex = (h) =>
    String.fromCodePoint(...(h.match(/.{1,4}/g) ?? []).map((c) => parseInt(c, 16)));

  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      const lo = parseInt(m[1], 16);
      const hi = parseInt(m[2], 16);
      const dstStart = parseInt(m[3], 16);
      for (let c = lo; c <= hi; c++) {
        map.set(c, String.fromCodePoint(dstStart + (c - lo)));
      }
    }
  }
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      map.set(parseInt(m[1], 16), hex(m[2]));
    }
  }
  return map;
}

/** Walk the page tree in document order. */
function pageOrder(objects, rootNum) {
  const out = [];
  const visit = (num, depth) => {
    if (depth > 64) return;
    const obj = objects.get(num);
    if (!obj) return;
    if (/\/Type\s*\/Page[^s]/.test(obj.text)) {
      out.push(num);
      return;
    }
    const kids = dictGet(obj.text, "Kids");
    if (!kids) return;
    for (const m of kids.matchAll(/(\d+)\s+0\s+R/g)) visit(Number(m[1]), depth + 1);
  };
  visit(rootNum, 0);
  return out;
}

/** Undo PDF string escaping, returning raw bytes. */
function unescapeString(s) {
  const out = [];
  for (let i = 0; i < s.length; ) {
    if (s[i] !== "\\") {
      out.push(s.charCodeAt(i));
      i++;
      continue;
    }
    const next = s[i + 1];
    if (next >= "0" && next <= "7") {
      let oct = "";
      let j = i + 1;
      while (j < s.length && oct.length < 3 && s[j] >= "0" && s[j] <= "7") oct += s[j++];
      out.push(parseInt(oct, 8) & 0xff);
      i = j;
    } else {
      const simple = { n: 10, r: 13, t: 9, b: 8, f: 12 };
      out.push(next in simple ? simple[next] : next.charCodeAt(0));
      i += 2;
    }
  }
  return out;
}

const CONTENT_TOKEN = new RegExp(
  [
    /\[(?:[^[\]\\]|\\.)*\]\s*TJ/, // kerned show
    /\((?:[^()\\]|\\.)*\)\s*(?:Tj|')/, // plain show
    /([\d.]+)\s+TL/, // set leading
    /T\*/, // next line
    /(-?[\d.]+)\s+(-?[\d.]+)\s+(?:Td|TD)/, // relative move
    /(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm/, // set matrix
    /\/(\w+)\s+([\d.]+)\s+Tf/, // set font
    /BT|ET/,
  ]
    .map((r) => r.source)
    .join("|"),
  "g",
);

/**
 * Turn one page's content stream into positioned lines.
 *
 * Each entry is `{ x, y, gap, size, text }` where `gap` is the vertical
 * distance travelled since the previous line — the signal that separates a
 * line break (15–16) from a stanza break (30–31) from a new hymn (37+).
 */
function pageLines(content, fontMaps) {
  const lines = [];
  let buffer = [];
  let leading = 0;
  let x = 0;
  let y = null;
  let lineStartX = 0;
  let lineStartY = null;
  let gap = Infinity;
  let size = 0;
  let map = null;

  const flush = () => {
    if (buffer.length) {
      lines.push({
        x: Math.round(lineStartX * 10) / 10,
        y: lineStartY,
        gap,
        size,
        text: buffer.join(""),
      });
    }
    buffer = [];
  };

  const move = (nx, ny) => {
    flush();
    gap = lineStartY === null ? Infinity : Math.abs(lineStartY - ny);
    lineStartX = nx;
    lineStartY = ny;
    x = nx;
    y = ny;
  };

  for (const m of content.matchAll(CONTENT_TOKEN)) {
    const token = m[0];
    if (token.endsWith("TL")) {
      leading = Number(m[1]);
    } else if (token === "T*") {
      move(x, (y ?? 0) - leading);
    } else if (token.endsWith("Tm")) {
      move(Number(m[8]), Number(m[9]));
    } else if (token.endsWith("Td") || token.endsWith("TD")) {
      move(x + Number(m[2]), (y ?? 0) + Number(m[3]));
      if (token.endsWith("TD")) leading = -Number(m[3]);
    } else if (token.endsWith("Tf")) {
      size = Number(m[11]);
      map = fontMaps.get(m[10]) ?? null;
    } else if (token === "BT") {
      y = null;
      lineStartY = null;
    } else if (token === "ET") {
      flush();
    } else {
      // `'` is "advance to the next line, then show" — 86 lines in this file
      // are drawn that way, and treating them as a plain show silently welds
      // them onto the previous line.
      if (token.trimEnd().endsWith("'")) move(x, (y ?? 0) - leading);
      for (const s of token.matchAll(/\((?:[^()\\]|\\.)*\)/g)) {
        const bytes = unescapeString(s[0].slice(1, -1));
        buffer.push(
          bytes.map((b) => (map?.get(b) ?? String.fromCharCode(b))).join(""),
        );
      }
    }
  }
  flush();
  return mergeBaselines(lines);
}

/**
 * A single visual line can be emitted as several runs when the font changes
 * mid-line — section headings do this ("LORD’S" at 12.8pt, "SUPPER." at 14pt)
 * and every contents entry does it, since the leader dots, the title and the
 * page number are three separate runs on one baseline. Stitch runs that share
 * a baseline back together in reading order.
 */
function mergeBaselines(lines) {
  const byBaseline = new Map();
  for (const line of lines) {
    const key = line.y === null ? Symbol() : Math.round(line.y);
    if (!byBaseline.has(key)) byBaseline.set(key, []);
    byBaseline.get(key).push(line);
  }

  const merged = [];
  for (const runs of byBaseline.values()) {
    runs.sort((a, b) => a.x - b.x);
    merged.push({
      ...runs[0],
      size: Math.max(...runs.map((r) => r.size ?? 0)),
      gap: Math.min(...runs.map((r) => r.gap)),
      text: runs.map((r) => r.text).join(""),
      // Callers that need to tell the parts apart — a contents entry's title
      // versus its page number, or a section heading sharing a baseline with
      // the hymn heading that follows it — read the runs instead.
      runs: runs.map((r) => ({ x: r.x, size: r.size, text: r.text })),
    });
  }

  // Restore document order: down the page, then left to right.
  return merged.sort((a, b) => (b.y ?? 0) - (a.y ?? 0) || a.x - b.x);
}

/** Extract every page of the PDF as positioned lines, in document order. */
export function extractPages(path) {
  const buf = readFileSync(path);
  const { objects, text: fileText } = indexObjects(buf);

  const rootMatch = fileText.match(/\/Root\s+(\d+)\s+0\s+R/);
  const catalog = objects.get(Number(rootMatch[1]));
  const pagesRef = dictGet(catalog.text, "Pages");
  const pagesNum = Number(pagesRef.match(/(\d+)/)[1]);

  const cmapCache = new Map();
  const pages = [];

  for (const pageNum of pageOrder(objects, pagesNum)) {
    const page = objects.get(pageNum);
    const resources = resolve(objects, dictGet(page.text, "Resources"));
    const fontDict = resolve(objects, dictGet(resources ?? "", "Font"));

    const fontMaps = new Map();
    if (fontDict) {
      for (const m of fontDict.matchAll(/\/(\w+)\s+(\d+)\s+0\s+R/g)) {
        const fontObj = objects.get(Number(m[2]));
        if (!fontObj) continue;
        const toUnicode = dictGet(fontObj.text, "ToUnicode");
        if (!toUnicode) continue;
        const num = Number(toUnicode.match(/(\d+)/)[1]);
        if (!cmapCache.has(num)) {
          const stream = streamOf(buf, fileText, objects, num);
          cmapCache.set(num, stream ? parseCMap(stream.toString("latin1")) : new Map());
        }
        fontMaps.set(m[1], cmapCache.get(num));
      }
    }

    const contentsRef = dictGet(page.text, "Contents");
    const contentNum = Number(contentsRef.match(/(\d+)/)[1]);
    const content = streamOf(buf, fileText, objects, contentNum);
    if (!content) continue;

    pages.push(pageLines(content.toString("latin1"), fontMaps));
  }

  return pages;
}
