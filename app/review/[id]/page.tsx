import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasDatabase } from "@/lib/db";
import { review, submissionFor } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review a song · Hymnal",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}

/**
 * Where the maintainer approves a song someone added in the app.
 *
 * Reached from the review email, and only with that email's token: without
 * it the page doesn't exist. Approving takes a press of a button here rather
 * than the link itself, because mail scanners open every link they're sent.
 */
export default async function ReviewSong({ params, searchParams }: Props) {
  const [{ id }, { t = "" }] = await Promise.all([params, searchParams]);
  if (!hasDatabase) notFound();
  const song = await submissionFor(Number(id), t);
  if (!song) notFound();

  async function decide(formData: FormData) {
    "use server";
    const choice = formData.get("choice") === "approved" ? "approved" : "rejected";
    await review(Number(id), t, choice);
    redirect(`/review/${id}?t=${encodeURIComponent(t)}`);
  }

  const status = {
    pending: "Waiting for you",
    approved: "Approved. It's in More Songs for everyone.",
    rejected: "Not added. It stays only on the phone it came from.",
  }[song.status];

  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[34rem] px-6 py-12">
        <p className="text-label">Song to review</p>
        <h1 className="mt-2 font-serif text-[2rem] leading-tight text-paper-ink">{song.title}</h1>
        <p className="mt-1 font-sans text-sm text-paper-muted">
          {[song.author ?? "No author given", song.meter].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-1 font-sans text-sm text-paper-faint">
          Added by {song.requester ?? "someone"} ·{" "}
          {new Date(song.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>

        <div className="mt-8 space-y-6 border-y border-paper-rule py-8">
          {song.stanzas.map((lines, s) => {
            const refrain = song.refrains.includes(s);
            return (
              <section key={s} className={refrain ? "italic" : ""}>
                {refrain && <p className="text-label mb-1.5 not-italic">Refrain</p>}
                {lines.map((line, l) => (
                  <p
                    key={l}
                    className="stanza-line"
                    style={{ marginLeft: `${(line.match(/^\t*/)![0].length) * 1.25}em` }}
                  >
                    {line.replace(/^\t+/, "")}
                  </p>
                ))}
              </section>
            );
          })}
        </div>

        <p
          role="status"
          className={`mt-6 font-sans text-[0.95rem] font-semibold ${
            song.status === "pending" ? "text-paper-muted" : "text-paper-ink"
          }`}
        >
          {status}
        </p>

        <form action={decide} className="mt-4 flex flex-col gap-3 sm:flex-row">
          {song.status !== "approved" && (
            <button
              type="submit"
              name="choice"
              value="approved"
              className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-paper-accent px-6 font-sans text-[0.95rem] font-semibold text-paper transition-transform active:scale-[0.98]"
            >
              {song.status === "rejected" ? "Approve after all" : "Approve for everyone"}
            </button>
          )}
          {song.status !== "rejected" && (
            <button
              type="submit"
              name="choice"
              value="rejected"
              className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-paper-rule px-6 font-sans text-[0.95rem] font-semibold text-paper-ink transition-colors hover:bg-paper-sunken"
            >
              {song.status === "approved" ? "Take it down" : "Don't add it"}
            </button>
          )}
        </form>

        <p className="mt-6 font-sans text-xs leading-relaxed text-paper-faint">
          Approve only songs in the public domain (as a rough guide, first published before 1930)
          or that you have permission to show.
        </p>

        <Link
          href="/"
          className="mt-10 inline-flex min-h-11 items-center font-sans text-sm text-paper-muted underline decoration-paper-rule underline-offset-4"
        >
          Open the hymnal
        </Link>
      </div>
    </main>
  );
}
