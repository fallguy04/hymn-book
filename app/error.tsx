"use client";

import { useEffect } from "react";

/**
 * How many times "Try again" has been used since this page loaded. Module
 * scope, not state: when the same fault comes straight back, React mounts this
 * component afresh, and anything held in state or a ref would start over.
 */
let attempts = 0;

/**
 * The way out when the hymnal can't start.
 *
 * Without this, Next's built-in fallback is a bare "Application error" sentence
 * with nothing to press. In the installed app there is no address bar and no
 * reload button to fall back on, so that is a dead end; the page has to carry
 * its own two exits.
 *
 * `body` is `overflow: hidden`, so the page brings its own scrolling container.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const tryAgain = () => {
    // A second attempt means re-rendering didn't cure it. Start the whole app
    // over, which also picks up a worker or a script that arrived since.
    if (attempts > 0) {
      location.reload();
      return;
    }
    attempts += 1;
    try {
      reset();
    } catch {
      location.reload();
    }
  };

  return (
    <main className="h-full overflow-y-auto font-serif text-paper-ink">
      <div className="mx-auto flex min-h-full max-w-[28rem] flex-col items-center justify-center px-6 py-12 text-center">
        <h1 className="text-3xl">Something went wrong</h1>
        <p className="mt-3 font-sans text-sm leading-relaxed text-paper-muted">
          The hymnal couldn&rsquo;t start properly, but your starred hymns and settings are still
          saved on this device.
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={tryAgain}
            className="min-h-12 rounded-xl bg-paper-accent px-6 py-3 font-sans text-sm font-semibold text-paper transition-transform active:scale-95"
          >
            Try again
          </button>
          {/* A plain link, not <Link>: a full load is the point. If client
              navigation is what's broken, it can't be what gets us out — and
              from "/" a soft navigation to "/" would not even clear the error. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="flex min-h-12 items-center justify-center rounded-xl border border-paper-rule px-6 py-3 font-sans text-sm font-semibold text-paper-ink transition-transform active:scale-95"
          >
            Back to the hymnal
          </a>
        </div>
      </div>
    </main>
  );
}
