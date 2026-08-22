-- Hymnal backing store. Two small tables, no user accounts.
--
-- Run against the Neon project with:
--   psql "$DATABASE_URL" -f db/schema.sql
-- It is idempotent, so re-running is safe.

-- ---------------------------------------------------------------------------
-- Sync codes
--
-- Moving favorites, tunes and settings between devices without making anyone
-- create an account. You get a short code on one device and type it on
-- another; the payload is whatever the store holds, and it expires on its own.
--
-- Deliberately holds no personal data: no email, no name, no device id. If
-- this table leaked, it would reveal which hymn numbers somebody starred.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_codes (
  -- Short, human-transcribable, ambiguous characters excluded (see lib/sync.ts).
  code        TEXT PRIMARY KEY,
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Short-lived by design: a code is for carrying data across the room, not
  -- for storage. Expired rows are swept on write.
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sync_codes_expires_at_idx ON sync_codes (expires_at);

-- ---------------------------------------------------------------------------
-- Song suggestions
--
-- Raised from the search screen when a search finds nothing — the moment
-- somebody has just discovered the app does not have what they wanted, and
-- the only moment they know exactly what to ask for. `query` is what they had
-- typed, captured so the suggestion carries its own context.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS song_suggestions (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title       TEXT NOT NULL,
  note        TEXT,
  query       TEXT,
  hymnal_id   TEXT,
  status      TEXT NOT NULL DEFAULT 'new',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS song_suggestions_status_idx ON song_suggestions (status, created_at DESC);
