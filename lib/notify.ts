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

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: SENDER,
        to: [RECIPIENT],
        subject: `Hymn suggestion: ${title}`,
        html,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
