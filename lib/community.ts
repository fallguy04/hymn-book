/**
 * Songs people add from the app, as the server sends them and the phone
 * keeps them.
 *
 * Numbered from 1000 up, by the order they were added, so they can never
 * collide with the songs built from songs/*.txt, whose ids count up from 1.
 * A star or a place on one of these survives in the same way.
 */

export const COMMUNITY_FROM = 1000;

export type SongStatus = "pending" | "approved" | "rejected";

export interface CommunitySong {
  number: number;
  title: string;
  author: string | null;
  meter: string;
  stanzas: string[][];
  refrains: number[];
}

export const isCommunityNumber = (n: number): boolean => n >= COMMUNITY_FROM;
