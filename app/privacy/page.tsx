import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy · Hymnal",
  description: "What the hymnal app stores, where it goes, and what it never collects.",
};

/**
 * Written to be accurate rather than reassuring.
 *
 * The previous version said no data was collected and that settings never left
 * the device. Both had stopped being true: there is an analytics script, a
 * database behind the suggestion box and the sync codes, and email delivery for
 * suggestions. A privacy policy that describes an app you no longer run is
 * worse than none, because people believe it.
 */
const UPDATED = "22 August 2026";

export default function PrivacyPolicy() {
  return (
    <main className="mx-auto max-w-[38rem] px-6 py-12">
      <header className="mb-10">
        <Link
          href="/"
          className="text-label mb-6 inline-block transition-colors hover:text-paper-accent"
        >
          ← Back to the hymnal
        </Link>
        <h1 className="font-serif text-3xl text-paper-ink">Privacy</h1>
        <p className="mt-2 font-sans text-xs text-paper-faint">Last updated {UPDATED}</p>
      </header>

      <div className="space-y-8 font-sans text-sm leading-relaxed text-paper-muted">
        <section>
          <p>
            This is the hymnal app used by the Old German Baptist Brethren Church, New Conference,
            in Modesto, California. It is free, carries no advertising, and sells nothing. There are
            no accounts and no sign-in.
          </p>
          <p className="mt-3">
            Most of what the app does happens entirely on your device. The sections below cover the
            parts that don&rsquo;t.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-paper-ink">What stays on your device</h2>
          <p>
            Your starred hymns, saved tunes, recently viewed hymns, chosen theme and text size are
            stored in your browser and are not sent anywhere &mdash; unless you deliberately create
            a sync code, described below. Clearing your browser data removes them.
          </p>
          <p className="mt-3">
            The hymn text itself is stored on your device too, so the app works with no connection
            at all.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-paper-ink">Sync codes</h2>
          <p>
            If you press <em>Get a code</em>, the app sends your starred hymns, saved tunes, theme
            and text size to our database and returns a six-character code. Anyone who types that
            code into the app within 24 hours receives that data. After 24 hours the record is
            deleted.
          </p>
          <p className="mt-3">
            A sync code holds hymn numbers, tune names and display settings. It carries no name, no
            email address, and no device identifier. Nothing in it says who you are. It is created
            only when you press the button.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-paper-ink">Song suggestions</h2>
          <p>
            If you suggest a song, the app sends and stores what you typed: the name you gave, the
            song title, any note, and the search term that found nothing. That is emailed to the
            person who maintains the app so somebody actually reads it.
          </p>
          <p className="mt-3">
            The name field is optional and exists so we know who to go and talk to. It is not
            verified and is not linked to anything else.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-paper-ink">Analytics</h2>
          <p>
            The app loads a small analytics script from Fall Studios, which counts page views. It
            sets no cookies and does not follow you to other websites. It is run by the same person
            who maintains this app, not sold or shared with an advertising company.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-paper-ink">Services we rely on</h2>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              <strong className="text-paper-ink">Vercel</strong> hosts the app. Like any web host it
              records ordinary server logs, which include IP addresses.
            </li>
            <li>
              <strong className="text-paper-ink">Neon</strong> is the database holding sync codes and
              song suggestions.
            </li>
            <li>
              <strong className="text-paper-ink">Resend</strong> delivers the suggestion emails.
            </li>
          </ul>
          <p className="mt-3">
            If you never suggest a song and never create a sync code, nothing of yours reaches the
            database or the email service.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-paper-ink">What we never do</h2>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Sell or share your data with anyone</li>
            <li>Show advertising, or allow advertising trackers</li>
            <li>Ask for an account, a password, or a payment method</li>
            <li>Track which hymns you look at, or when</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-paper-ink">Children</h2>
          <p>
            The app is suitable for all ages and asks for nothing that would identify a child. The
            only field that accepts a name is the optional one on the suggestion form.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-paper-ink">Removing something</h2>
          <p>
            Ask, and any suggestion you sent will be deleted. Sync codes delete themselves within a
            day; to remove one sooner, ask. Everything held on your own device you can clear
            yourself through your browser.
          </p>
        </section>

        <section className="border-t border-paper-rule pt-6">
          <h2 className="mb-2 font-serif text-xl text-paper-ink">Questions</h2>
          <p>
            Write to{" "}
            <a
              href="mailto:fallmichael60@gmail.com"
              className="text-paper-ink underline decoration-paper-rule underline-offset-4 transition-colors hover:text-paper-accent"
            >
              fallmichael60@gmail.com
            </a>
            .
          </p>
          <p className="mt-3 text-xs text-paper-faint">
            If this page and the app ever disagree, the page is wrong and should be fixed. Please
            say so.
          </p>
        </section>
      </div>
    </main>
  );
}
