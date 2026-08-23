/**
 * Moving your favorites, tunes and settings to another device.
 *
 * No accounts, no email, no password — that was the explicit ask, and it also
 * happens to be the right shape for the problem. What's being carried is a
 * list of starred hymn numbers, not an identity, and asking someone to make an
 * account to move a dozen numbers between a phone and a tablet is a worse
 * trade than typing six characters.
 *
 * So: one device puts its data behind a short code, the other types the code
 * in. The code expires on its own. Nothing that identifies anybody is stored,
 * which is why the codes can be this short — there is very little to protect,
 * and a code that's a nuisance to read aloud wouldn't get used.
 */

/**
 * No 0/O, 1/I/L, 5/S, 8/B, 2/Z. What's left survives being read across a room,
 * written on a scrap of paper, or typed by someone who can't find their
 * glasses — which is the actual operating environment for this feature.
 */
const ALPHABET = "34679ACDEFGHJKMNPQRTUVWXY";

export const CODE_LENGTH = 6;

/** A day: long enough to finish after the service, short enough to not linger. */
export const CODE_TTL_HOURS = 24;

/** What travels. Deliberately not the whole store — see `SyncPayload`. */
export interface SyncPayload {
  /** Starred hymn numbers grouped by book id — a number alone names no song. */
  favorites: Record<string, number[]>;
  tunes: { name: string; meter: string }[];
  theme: string;
  textSize: string;
}

/** Book ids are our own, but this arrives over the wire; keep them tame. */
const BOOK_ID = /^[a-z0-9-]{1,64}$/;

const cleanNumbers = (input: unknown): number[] =>
  Array.isArray(input)
    ? input.filter((n): n is number => Number.isInteger(n) && n > 0 && n < 10000).slice(0, 2000)
    : [];

export function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  // Modulo bias is irrelevant here: the code is a short-lived lookup key for
  // non-secret data, not a token guarding anything.
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Accept what people actually type: lower case, spaces, a hyphen in the middle. */
export const normalizeCode = (input: string): string =>
  input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);

export const isCode = (input: string): boolean =>
  input.length === CODE_LENGTH && [...input].every((c) => ALPHABET.includes(c));

/** "K7PQ4M" → "K7P Q4M", which is how it gets read out loud anyway. */
export const formatCode = (code: string): string =>
  `${code.slice(0, 3)} ${code.slice(3)}`.trim();

/**
 * Keep only the fields worth carrying, and only in a shape the other device can
 * trust. Anything unrecognised is dropped rather than merged, because this data
 * arrives from a URL parameter typed by a stranger.
 */
export function sanitizePayload(input: unknown): SyncPayload | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;

  // A bare array is a code made before favorites knew about books. Those all
  // predate the second book, so they are the collection's.
  const favorites: Record<string, number[]> = {};
  if (Array.isArray(raw.favorites)) {
    const legacy = cleanNumbers(raw.favorites);
    if (legacy.length) favorites.brethren = legacy;
  } else if (raw.favorites && typeof raw.favorites === "object") {
    for (const [book, list] of Object.entries(raw.favorites as Record<string, unknown>).slice(0, 20)) {
      if (!BOOK_ID.test(book)) continue;
      const numbers = cleanNumbers(list);
      if (numbers.length) favorites[book] = numbers;
    }
  }

  const tunes = Array.isArray(raw.tunes)
    ? raw.tunes
        .filter(
          (t): t is { name: string; meter: string } =>
            Boolean(t) &&
            typeof t === "object" &&
            typeof (t as { name?: unknown }).name === "string" &&
            typeof (t as { meter?: unknown }).meter === "string",
        )
        .map((t) => ({ name: t.name.slice(0, 120), meter: t.meter.slice(0, 40) }))
        .slice(0, 500)
    : [];

  const theme = ["system", "light", "dark"].includes(raw.theme as string)
    ? (raw.theme as string)
    : "system";
  const textSize = ["s", "m", "l", "xl"].includes(raw.textSize as string)
    ? (raw.textSize as string)
    : "m";

  return { favorites, tunes, theme, textSize };
}
