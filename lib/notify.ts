/**
 * Email notification for song suggestions.
 *
 * Where suggestions actually land. A row in a table nobody opens is the same
 * as no suggestions box, so each one is mailed as it arrives.
 *
 * Sending is best-effort by design: the suggestion is already saved before
 * this runs, and a mail failure must never lose it or fail the request. If
 * RESEND_API_KEY is absent the app simply skips the mail and keeps the row.
 */

/** Where suggestions go. Override per-environment without touching the code. */
const RECIPIENT = process.env.SUGGESTIONS_EMAIL ?? "fallmichael60@gmail.com";

/**
 * Resend's shared sender. Works with no DNS setup, which is the whole point
 * for a congregational app — swap for an address on your own verified domain
 * if these ever start landing in spam.
 */
const SENDER = process.env.SUGGESTIONS_FROM ?? "Hymnal <onboarding@resend.dev>";

export interface Suggestion {
  requester: string | null;
  title: string;
  note: string | null;
  query: string | null;
  hymnalId: string | null;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function emailSuggestion(suggestion: Suggestion): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const { requester, title, note, query, hymnalId } = suggestion;
  const who = requester?.trim() || "Someone";

  const rows: [string, string][] = [
    ["Song", title],
    ["Requested by", requester?.trim() || "— not given —"],
  ];
  if (note) rows.push(["Notes", note]);
  // Worth including: what they typed is sometimes a better clue to the song
  // than the title they settled on.
  if (query && query !== title) rows.push(["Searched for", query]);
  if (hymnalId) rows.push(["Looking in", hymnalId]);

  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#241f1a">
      <p style="margin:0 0 16px"><strong>${escapeHtml(who)}</strong> suggested a song for the hymnal.</p>
      <table style="border-collapse:collapse">
        ${rows
          .map(
            ([label, value]) => `
          <tr>
            <td style="padding:4px 12px 4px 0;color:#8b8375;vertical-align:top;white-space:nowrap">${label}</td>
            <td style="padding:4px 0"><strong>${escapeHtml(value)}</strong></td>
          </tr>`,
          )
          .join("")}
      </table>
      <p style="margin:20px 0 0;color:#8b8375;font-size:13px">
        Sent from the hymnal app. Run <code>node scripts/suggestions.mjs</code> to see everything outstanding.
      </p>
    </div>`;

  return send(`Hymn suggestion: ${title}`, html);
}

/** Mail the maintainer. Best-effort: false when there's no key or Resend fails. */
async function send(subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: SENDER, to: [RECIPIENT], subject, html }),
      // The person is waiting on this request. A mail service that hangs must
      // not keep them watching a spinner over something already saved.
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) console.error("[notify] Resend answered", response.status);
    return response.ok;
  } catch (error) {
    console.error("[notify] send failed:", (error as Error).name);
    return false;
  }
}

/**
 * A song added in the app, for the maintainer to look over. The words are in
 * the email so it can be judged from the inbox; approving happens on the
 * review page, never from the link itself — mail scanners open every link in
 * a message, and one that approved on opening would approve everything.
 */
export async function emailSongForReview(
  song: { title: string; author: string | null; meter: string; stanzas: string[][]; refrains: number[] },
  requester: string | null,
  reviewUrl: string,
): Promise<boolean> {
  const who = requester?.trim() || "Someone";
  const stanzas = song.stanzas
    .map((lines, i) => {
      const refrain = song.refrains.includes(i);
      const body = lines
        .map((line) => {
          const indent = line.match(/^\t*/)![0].length;
          return `<div style="padding-left:${indent * 1.25}em">${escapeHtml(line.replace(/^\t+/, ""))}</div>`;
        })
        .join("");
      return `<div style="margin:0 0 14px;${refrain ? "font-style:italic" : ""}">${
        refrain ? '<div style="color:#8b8375;font-size:12px;letter-spacing:.08em">REFRAIN</div>' : ""
      }${body}</div>`;
    })
    .join("");

  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#241f1a;max-width:560px">
      <p style="margin:0 0 4px"><strong>${escapeHtml(who)}</strong> added a song to More Songs.</p>
      <p style="margin:0 0 20px;color:#8b8375;font-size:13px">It shows on their phone now, and for everyone once you approve it.</p>
      <h2 style="font-family:Georgia,serif;font-weight:normal;margin:0 0 2px">${escapeHtml(song.title)}</h2>
      <p style="margin:0 0 16px;color:#8b8375;font-size:13px">${[song.author, song.meter].filter(Boolean).map((v) => escapeHtml(v!)).join(" · ") || "No author given"}</p>
      <div style="font-family:Georgia,serif;font-size:16px">${stanzas}</div>
      <p style="margin:24px 0 8px">
        <a href="${reviewUrl}" style="display:inline-block;background:#241f1a;color:#fdfbf7;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:600">Review this song</a>
      </p>
      <p style="margin:12px 0 0;color:#8b8375;font-size:13px">
        Approve only songs in the public domain (as a rough guide, first published before 1930) or that you have permission to show.
      </p>
    </div>`;

  return send(`Song to review: ${song.title}`, html);
}
