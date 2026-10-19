import { randomBytes } from "node:crypto";
import { sql } from "./db";
import { COMMUNITY_FROM, type CommunitySong, type SongStatus } from "./community";

/**
 * Songs added from the app, waiting for (or past) the maintainer's say-so.
 *
 * The person who adds one sees it straight away on their own phone; this is
 * where it waits until it's approved for everyone. Each row carries its own
 * review token, sent only in the maintainer's email, so approving needs no
 * account and no shared secret in the environment.
 */

let ready: Promise<void> | null = null;

/**
 * Created when the first song is added, so a deploy needs no separate
 * database step and merely opening the app never touches the schema.
 */
function ensureTable(): Promise<void> {
  ready ??= (async () => {
    await sql!`
      CREATE TABLE IF NOT EXISTS song_submissions (
        id          serial PRIMARY KEY,
        title       text NOT NULL,
        author      text,
        meter       text NOT NULL DEFAULT '',
        stanzas     jsonb NOT NULL,
        refrains    jsonb NOT NULL DEFAULT '[]',
        requester   text,
        status      text NOT NULL DEFAULT 'pending',
        token       text NOT NULL,
        created_at  timestamptz NOT NULL DEFAULT now(),
        reviewed_at timestamptz
      )
    `;
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

export interface Submission extends CommunitySong {
  id: number;
  requester: string | null;
  status: SongStatus;
  createdAt: string;
}

type Row = {
  id: number;
  title: string;
  author: string | null;
  meter: string;
  stanzas: string[][];
  refrains: number[];
  requester: string | null;
  status: SongStatus;
  created_at: string;
};

const toSong = (row: Row): CommunitySong => ({
  number: COMMUNITY_FROM + row.id,
  title: row.title,
  author: row.author,
  meter: row.meter,
  stanzas: row.stanzas,
  refrains: row.refrains,
});

export async function createSubmission(
  song: Omit<CommunitySong, "number">,
  requester: string | null,
): Promise<{ song: CommunitySong; id: number; token: string }> {
  await ensureTable();
  const token = randomBytes(24).toString("base64url");
  const rows = (await sql!`
    INSERT INTO song_submissions (title, author, meter, stanzas, refrains, requester, token)
    VALUES (${song.title}, ${song.author}, ${song.meter}, ${JSON.stringify(song.stanzas)}::jsonb,
            ${JSON.stringify(song.refrains)}::jsonb, ${requester}, ${token})
    RETURNING id, title, author, meter, stanzas, refrains, requester, status, created_at
  `) as Row[];
  return { song: toSong(rows[0]), id: rows[0].id, token };
}

/**
 * Postgres's "no such table". Reading never creates the table, so opening the
 * app changes nothing in the database; until the first song is added there is
 * simply nothing to read.
 */
const missingTable = (error: unknown) => (error as { code?: string }).code === "42P01";

/** Every approved song, oldest first. */
export async function approvedSongs(): Promise<CommunitySong[]> {
  const rows = (await sql!`
    SELECT id, title, author, meter, stanzas, refrains, requester, status, created_at
    FROM song_submissions WHERE status = 'approved' ORDER BY id
  `.catch((error) => {
    if (missingTable(error)) return [];
    throw error;
  })) as Row[];
  return rows.map(toSong);
}

/** Where the songs added on one phone stand, by number. Nothing else about them. */
export async function statusesOf(numbers: number[]): Promise<Record<number, SongStatus>> {
  const ids = numbers.map((n) => n - COMMUNITY_FROM).filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return {};
  const rows = (await sql!`
    SELECT id, status FROM song_submissions WHERE id = ANY(${ids})
  `.catch((error) => {
    if (missingTable(error)) return [];
    throw error;
  })) as { id: number; status: SongStatus }[];
  return Object.fromEntries(rows.map((r) => [COMMUNITY_FROM + r.id, r.status]));
}

/** A submission, only for someone holding its review token. */
export async function submissionFor(id: number, token: string): Promise<Submission | null> {
  if (!Number.isInteger(id) || !token) return null;
  const rows = (await sql!`
    SELECT id, title, author, meter, stanzas, refrains, requester, status, created_at
    FROM song_submissions WHERE id = ${id} AND token = ${token}
  `.catch((error) => {
    if (missingTable(error)) return [];
    throw error;
  })) as Row[];
  const row = rows[0];
  return row
    ? { ...toSong(row), id: row.id, requester: row.requester, status: row.status, createdAt: row.created_at }
    : null;
}

export async function review(id: number, token: string, status: "approved" | "rejected"): Promise<boolean> {
  const rows = await sql!`
    UPDATE song_submissions SET status = ${status}, reviewed_at = now()
    WHERE id = ${id} AND token = ${token}
    RETURNING id
  `;
  return rows.length > 0;
}
