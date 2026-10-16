import type { Metadata } from "next";
import { notFound } from "next/navigation";
import App, { type HymnAddress } from "@/components/App";
import { getHymn, getHymnal, isNumbered } from "@/lib/hymnals";
import { ROUTES, hymnHeading, primaryName, spokenFirstLine } from "@/lib/books";

/**
 * A page per hymn: /hymn/245 in the Hymnal, /song/12 in More Songs.
 *
 * Every one is built ahead of time, so a shared link opens on the hymn even
 * before the app has started, and a message preview names it ("Hymn 245 ·
 * Our God is love") instead of saying "Hymnal" for every link. Offline, the
 * service worker answers these addresses with the app's shell, which reads
 * the hymn from the address itself.
 */

interface Params {
  kind: string;
  n: string;
}

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return Object.entries(ROUTES).flatMap(([id, kind]) =>
    (getHymnal(id)?.hymns ?? []).map((hymn) => ({ kind, n: String(hymn.number) })),
  );
}

function resolve({ kind, n }: Params): HymnAddress | null {
  const hymnalId = Object.keys(ROUTES).find((id) => ROUTES[id] === kind);
  const book = hymnalId ? getHymnal(hymnalId) : undefined;
  const number = Number(n);
  return book && getHymn(book, number) ? { hymnalId: book.id, number } : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const address = resolve(await params);
  if (!address) return {};
  const book = getHymnal(address.hymnalId)!;
  const hymn = getHymn(book, address.number)!;
  const title = isNumbered(book)
    ? `${hymnHeading(book, hymn)} · ${primaryName(book, hymn)}`
    : primaryName(book, hymn);
  const description = `“${spokenFirstLine(hymn)}…” — ${book.title}.`;
  return {
    title,
    description,
    openGraph: { title, description, siteName: "Hymnal", type: "article" },
  };
}

export default async function HymnPage({ params }: { params: Promise<Params> }) {
  const address = resolve(await params);
  if (!address) notFound();
  return <App initial={address} />;
}
