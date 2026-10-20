import Link from "next/link";

/**
 * A page that doesn't exist. Offline, the service worker answers any unknown
 * path with the hymnal itself, so this is only ever seen with a connection —
 * from a mistyped address or a link to something that has since moved.
 *
 * `body` is `overflow: hidden`, so the page brings its own scrolling container.
 */
export default function NotFound() {
  return (
    <main className="h-full overflow-y-auto font-serif text-paper-ink">
      <div className="mx-auto flex min-h-full max-w-[28rem] flex-col items-center justify-center px-6 py-12 text-center">
        <h1 className="text-3xl">Page not found</h1>
        <p className="mt-3 font-sans text-sm leading-relaxed text-paper-muted">
          We couldn&rsquo;t find that page, but every hymn is still in the hymnal.
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="flex min-h-12 items-center justify-center rounded-xl bg-paper-accent px-6 py-3 font-sans text-sm font-semibold text-paper transition-transform active:scale-95"
          >
            Back to the hymnal
          </Link>
        </div>
      </div>
    </main>
  );
}
