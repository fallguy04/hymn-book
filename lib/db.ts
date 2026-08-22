import { neon } from "@neondatabase/serverless";

/**
 * The one place a database connection is made.
 *
 * Everything here is optional infrastructure: the hymnal is a static corpus
 * that works fully offline, and suggestions and sync are extras layered on
 * top. So a missing DATABASE_URL is not a crash — callers check `hasDatabase`
 * and degrade rather than failing the page.
 */
export const hasDatabase = Boolean(process.env.DATABASE_URL);

export const sql = hasDatabase ? neon(process.env.DATABASE_URL!) : null;
