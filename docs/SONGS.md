# Adding songs: status, licensing, instructions

Covers the songs this congregation sings — the original list of 33 plus the
2020 and 2022 camp songbooks — what may legally be added, and how to add it.

---

## 1. Can the copyrighted ones ever be added?

**Not 100% impossible — but not solved by buying a licence off the shelf.**

What CCLI's **Church Copyright License (CCL)** covers:

| | |
|---|---|
| ✅ Covered | Projecting lyrics on a screen in worship |
| ✅ Covered | Printing lyrics in bulletins, programs, song sheets |
| ✅ Covered | Recording/archiving your own services |
| ✅ Covered | Translating lyrics; making your own arrangements |
| ❌ **Not** covered | **Posting lyrics on a website** |
| ❌ **Not** covered | Streaming services online (needs the separate **Streaming License**) |
| ❌ **Not** covered | Photocopying octavos, musicals, keyboard/vocal solo books |

The gap that matters here: **this app is a website.** CCL is written around
projection and print for in-person worship. Even the Streaming License is about
streaming a *service*, not hosting a searchable lyrics database. So buying CCLI
alone does **not** make it legal to put copyrighted lyrics in a public app.

### The three real paths

1. **Ask CCLI directly.** They answer this exact question and can say in writing
   whether a congregation-restricted app counts as "song sheets" under your
   licence. Get it in writing; a support answer on the phone isn't a licence.
   → [ccli.com](https://ccli.com/) · US service centre (360) 553-7500
2. **Ask the publishers.** For a short list this is realistic. Ken Young's songs
   are Hallal Music; smaller publishers often say yes to a single congregation.
   One email per publisher, and keep the reply.
3. **Index only.** Number and title with no lyrics. Titles are facts and aren't
   copyrightable, so "SFP 728 — How Great Thou Art" is safe to display. Useful
   for "what number is that?" without reproducing anything.

**Access control was considered and ruled out.** A members-only app would be an
easier ask — it's the difference between "song sheets for our congregation" and
"publishing lyrics on the internet" — but the app stays public. The permission
requests say so plainly, because a permission granted on a false description of
the app isn't worth having.

What's offered instead: credit on every song, no printing or export, immediate
removal on request, and no revenue of any kind.

### Requests sent

All four are out.

| To | Covers | Address | Status |
|---|---|---|---|
| Capitol CMG Publishing | the largest cluster — ~9 camp songs plus Green, Moore/Chapman, Kendrick | `CapitolCMGLicensing@umusic.com` | **sent 22 Aug 2026** |
| Hallal Music (Ken Young) | Faithful Love · Consider Him | `info@hallalmusic.com` | **sent 22 Aug 2026** |
| Shepherd's Heart Music | Jesus, Flow Like a River | `mail@dennisjernigan.com` | **sent 22 Aug 2026** |
| CCLI | Does the CCL cover this at all? | **no email exists** — web form | **sent 22 Aug 2026** |

Each asks for **blanket coverage of the catalog**, not a fixed title list, since
the list grows as members ask for songs. Each also asks the recipient to
redirect it if they don't administer the song, because publisher assignments are
easy to get wrong from outside.

**CCLI publishes no email address** — their contact page lists a phone, a street
address, business hours and a web form, nothing else. The form sits behind a
Cloudflare check and requires a phone number, so it was submitted by hand
through [ccli.com/us/en/contact-ccli](https://ccli.com/us/en/contact-ccli).
The phone line is (360) 553-7500 if it goes quiet.

**CCLI's answer is the one that decides the shape of this.** They sell blanket
coverage to congregations at congregation prices, which is exactly what this
needs; every other route is per-publisher and, on Capitol CMG's rates below,
meters by the view. Nothing further should go to a publisher until they reply —
a second request while the first is open only muddies which permission covers
what.

**If they say yes:** the words for all 38 known-copyright songs can go in, their
entries come out of `data/pending-songs.json`, and the index-only rows become
real pages.

**If they say no:** the remaining publishers get asked one at a time —
Gaither, Word, Ellis Crum, Sacred Selections, Brentwood-Benson, Integrity — and
each song is a separate decision about whether the rate is worth it. The
index-only listing stays either way; it costs nothing and it is what makes a
search for a copyrighted song return something other than silence.

### What Capitol CMG actually sells (from their own rate card)

They replied by autoresponder: all requests go through
[licensing.capitolcmg.com](https://licensing.capitolcmg.com) → **Church/Indie**,
and **do not register or log in** — the Church/Indie path breaks for logged-in
users. Their FAQ confirms `CapitolCMGLicensing@umusic.com` is the right address
for help.

Their non-commercial rate card offers no licence for "lyrics in an app." The
closest three:

| Licence | What it covers | Rate |
|---|---|---|
| **Lyric Display** | lyrics shown on slides/overheads/PowerPoint **during a worship setting** | **$20 per song per 500 views** |
| **Lyric Reprint** | reprinting lyrics in "some medium (ex. small devotional church resources)", words only | **$0.12 per song per copy** |
| Bulletin | words only, in a bulletin or song sheet, **one-time** service | $35 per song |

Lyric Display is metered by views and scoped to a worship setting, not an
on-demand app. Lyric Reprint is metered by copies, and what a "copy" means for
a web page is undefined. Neither fits cleanly.

**The view-metered rate is the number that matters.** At $20 per song per 500
views, a congregation of any size burns through 500 views per song in months.
Eleven Capitol CMG songs at that rate lands in the high hundreds of dollars a
year — and Capitol CMG is one publisher of six or seven.

Their FAQ points anything unlisted at a **Custom Digital License Request Form**.
That form asks for a federal identification number, key personnel and
principals, funding sources, a multi-year business model with revenue streams,
and existing public-performance licences. It is built for a company launching a
commercial streaming service, not a congregation with a free app. Not a dead
end, but plainly not the intended path either.

**This strengthens the case for waiting on CCLI**, whose whole business is
selling congregations blanket coverage at congregation prices — and for the
index-only fallback, which costs nothing and is unambiguously legal.

### Still to write

The camp book brings in publishers nobody has contacted yet: Gaither Music
(Because He Lives · We Have This Moment), Word Music (Lord, Listen to Your
Children Praying), Ellis J. Crum (He Paid a Debt), Sacred Selections (Our God,
He Is Alive), Brentwood-Benson (He Has Made Me Glad), Integrity (We Shall
Assemble). Worth waiting on CCLI's answer first — if they cover it, none of
these are needed.

---

## 2. Status of the 33 songs

### ✅ Already in the app

| Song | Where |
|---|---|
| Walk in the Light | A Collection of Hymns #504 |
| How Firm a Foundation | A Collection of Hymns #524 |
| Man of Sorrows | Other Songs (Bliss, 1875) |
| And Can It Be | Other Songs (Wesley, 1738) |
| Crown Him with Many Crowns | Other Songs (Bridges, 1851) |

### 🟡 Added, drafted from memory — **need proofreading before use**

All eight are public domain. None was in the Open Hymnal Project and every
external text source failed, so these were written out from knowledge rather
than transcribed. Check each against a printed copy; the `Source:` line in each
file says so too.

| Song | Author | Year | State |
|---|---|---|---|
| Jesus Paid It All | Elvina M. Hall | 1865 | complete draft |
| Low in the Grave He Lay | Robert Lowry | 1874 | complete draft |
| Who Is on the Lord's Side? | Frances R. Havergal | 1877 | complete draft |
| Count Your Blessings | Johnson Oatman, Jr. | 1897 | complete draft |
| Walking in Sunlight | Henry J. Zelley | 1899 | complete draft |
| Sweet Will of God | Lelia N. Morris | 1900 | complete draft |
| **He Bore It All** | J. R. Baxter, Jr. / V. O. Stamps | **1926** | **stanza 1 + refrain only** |
| The Lord Is My Light | George F. Root | 1894 | **opening only** |

Two are deliberately incomplete. Writing a stanza I half-remember into a book
people sing from is worse than leaving a visible gap, so the gap is left:

- **He Bore It All** — stanza 1 and the refrain are corroborated; stanzas 2–3
  need typing from a copy.
- **The Lord Is My Light** — Root's setting of Psalm 27 repeats phrases in a way
  particular to his arrangement, and those repeats can't be guessed at. Note
  there is a *different* hymn of the same title by James L. Nicholson (1877),
  "The Lord is my light; then why should I fear?" — that one is well documented
  but is not the one this congregation sings.

**He Bore It All** is the surprise of the list: published 1926, renewed 1954, so
its 95-year term ran out and it entered the public domain in **2022**. It was
copyrighted for most of your life and isn't now.

### 🔴 Still in copyright — cannot add lyrics without permission

| Song | Writer | Year |
|---|---|---|
| Precious Lord, Take My Hand | Thomas A. Dorsey | 1938 |
| Jesus Is Coming Soon | R. E. Winsett | 1942 (renewed 1970) |
| How Great Thou Art | Stuart K. Hine | 1949 |
| Where No One Stands Alone | Mosie Lister | 1955 |
| Ten Thousand Angels | Ray Overholt | 1959 |
| I'm So Glad I'm a Part of the Family of God | Bill & Gloria Gaither | 1970 |
| Seek Ye First | Karen Lafferty | 1972 |
| My Eyes Are Dry | Keith Green | 1978 |
| In His Time | Diane Ball | 1978 |
| The Battle Belongs to the Lord | Jamie Owens-Collins | 1984 |
| Shine Jesus Shine | Graham Kendrick | 1987 |
| **Jesus, Flow Like a River** | Dennis Jernigan | 1989 |
| Listen to Our Hearts | Geoff Moore / S. C. Chapman | 1990s |
| Faithful Love | Ken Young | modern |
| Consider Him | Ken Young | modern |

*US rule of thumb: published 1930 or earlier → public domain. Later → assume
copyrighted unless proven otherwise.*

---

## 2b. The YFS camp songbooks (2020 and 2022)

Both `.docx` files were parsed. **2022 is the complete set — 50 songs.** 2020 is
effectively a subset of it; the only song in 2020 that isn't in 2022 is *Lord,
Listen to Your Children Praying* (Ken Medema, 1973 — in copyright).

### ✅ Added from the camp book (7)

Public domain, and typed from the camp book's own text so the line breaks are
the ones the congregation actually sings.

| Song | Author | Year |
|---|---|---|
| Day by Day | Lina Sandell, tr. Skoog | 1865 |
| I Have Decided to Follow Jesus | anonymous / traditional | — |
| I Shall Not Be Moved | traditional spiritual | — |
| I Sing the Mighty Power of God | Isaac Watts | 1715 |
| I Will Sing of the Mercies of the Lord | James H. Fillmore | 1893 |
| Onward, Christian Soldiers | Sabine Baring-Gould | 1865 |
| 'Tis So Sweet to Trust in Jesus | Louisa M. R. Stead | 1882 |

Already present: **Take My Life and Let It Be** (Havergal, 1874) and **The Lord
Is My Light** (Root, 1894 — now carrying the congregation's own text).

### 🔴 In copyright — cannot add without permission (25)

As the Deer · Because He Lives · Bind Us Together · Faithful Love · Father, I
Adore You · He Has Made Me Glad · He Paid a Debt · Here I Am to Worship · I Love
You, Lord · I Stand in Awe of You · If That Isn't Love · In Moments Like These ·
Instruments of Your Peace · Just a Little Talk with Jesus · Lord, Listen to Your
Children Praying · Our God, He Is Alive · Sanctuary · Seek Ye First · Shine,
Jesus, Shine · Step by Step · There Is a Redeemer · Thy Word · Unto Thee, O Lord
· We Have This Moment · We Shall Assemble · We Will Glorify

All post-1930. *Just a Little Talk with Jesus* is the closest to expiring —
Cleavant Derricks, 1937, so roughly 2033.

*(The 2022 book prints "Step by Step" twice, at 36 and 37.)*

### ❓ Unidentified — 14 camp songs

Alive, Alive · Beautiful Lamb of God · Feelin' Fine · Fill Up My Cup · Friends
Forever · God's Wonderful People · I Want Us to Be Together in Heaven · I Will
Serve You · Jesus Signed My Pardon · Let the Voice of Thunder Raise · Poured Out
Like Wine · The Lord Liveth · The Touch of His Hand · We Declare That the
Kingdom of God Is Here · You Are the Words and the Music

Most read as modern camp choruses, which means copyrighted — but "reads modern"
isn't evidence.

**Neither songbook prints a single copyright line.** No ©, no CCLI numbers, no
writer credits anywhere in either file — so the books themselves can't settle
any of these. Identification has to come from someone who knows the songs.

*(An earlier note here said The Touch of His Hand was a page image with no
extractable text. That was a parser bug — its page is set at a different size
and was being skipped. The text is available; only the attribution is missing.)*

---

## 2c. Couldn't determine — need a writer or approximate date

Hallelujah for the Blood · God Bless You Go With God · I Will Abide in Thy
Dwelling Place

*Instruments of Your Peace* is now settled: the camp book's text ("Walls of
pride and prejudice shall cease") is a modern setting, not the ancient Francis
prayer. **In copyright.**

Any one of these settles it: a writer's name, a decade, the songbook it was
learned from, or a copyright line printed at the foot of the page. Titles alone
aren't enough — several of these are common phrases attached to more than one
song, which is exactly how "The Lord Is My Light" came to be attributed to the
wrong writer in an earlier version of this document.

---

## 2d. Index-only entries

`data/pending-songs.json` lists the 56 songs the congregation sings that the app
cannot print the words to — 38 known and in copyright, 18 nobody has identified.
They appear in search under **"Known, but not printable yet"**, showing the
title, the writer, where the song is known from, and why there are no words.

A title is a fact and carries no copyright, so this costs nothing and is
unambiguously legal. The point is that a search for "How Great Thou Art" no
longer comes back empty, implying the song doesn't exist — it answers with who
wrote it and what is being done about it.

They are deliberately **not** part of any hymnal. Folding fifty-odd wordless
entries into Other Songs would put them in the page-through and the contents
list, so swiping through the book mid-service would keep landing on pages with
nothing to sing. Search is where somebody is asking a question; that is the only
place they show up.

**When permission arrives for one:** delete its entry from
`data/pending-songs.json`, add a real file in `songs/`, and rebuild. Nothing
else changes.

**When one of the unknowns is identified:** either add the writer and year and
set `status` to `copyright`, or — if it turns out to be public domain — write
the song file and delete the entry.

---

## 3. How to add a song

One plain-text file per song in `songs/`, then:

```bash
node scripts/build-other-songs.mjs
```

```
Title: Jesus Paid It All
Author: Elvina M. Hall
Meter: 6.6.7.7. with refrain
Source: public domain (1865)

I hear the Savior say,
	"Thy strength indeed is small,
Child of weakness, watch and pray,
	Find in Me thine all in all."

Jesus paid it all,
	All to Him I owe;
Sin had left a crimson stain,
	He washed it white as snow.
```

- Headers first, then **one blank line**, then stanzas separated by blank lines.
- `Title` is required; `Author`, `Meter`, `Source`, `Note` are optional.
- **A refrain** is a stanza whose first line is just `Refrain:` (or `Chorus:`).
  It prints once, labelled and in italics, and is skipped when numbering the
  verses — so the stanza after it is verse 2, not verse 3.
- **Line breaks are kept exactly as typed** — this is the point. Every automated
  source loses them; that's why the Open Hymnal import yielded 17 of 300.
- **Indent** a line with a tab or two spaces. Two tabs indents further.
- `Source:` records *why* a song is safe — "public domain (1865)",
  "CCLI #1234567", "publisher permission 2026-08-14". Not shown in the app; it
  exists so the decision is written down next to the song.

Then commit and push — Vercel deploys automatically.

---

## 4. Suggestions from the congregation

A failed search offers "Suggest this song," asking for name, title and notes.
Each one emails **fallmichael60@gmail.com** and is stored.

```bash
node scripts/suggestions.mjs           # what's outstanding
node scripts/suggestions.mjs --all     # including handled
node scripts/suggestions.mjs --done 12 # mark handled
```

Email needs `RESEND_API_KEY` set in Vercel. Without it, suggestions still save
and the CLI still lists them — only the email is skipped.
