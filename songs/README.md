# Adding songs

Drop one plain-text file per song in this folder, then run:

```bash
node scripts/build-other-songs.mjs
```

They appear in **Other Songs**, alongside the hymns built from the Open Hymnal
Project. `EXAMPLE.txt` is a working file to copy.

## The format

```
Title: Amazing Grace
Author: John Newton
Meter: C.M.
Source: public domain (1779)

AMAZING grace! how sweet the sound
	That saved a wretch like me!
I once was lost, but now am found,
	Was blind, but now I see.

'Twas grace that taught my heart to fear,
	And grace my fears relieved;
```

- **Headers** come first, one `Key: value` per line, then one blank line.
  `Title` is the only required one. `Author`, `Meter` and `Source` are optional.
- **Stanzas** are separated by a blank line.
- **Line breaks are kept exactly as you type them.** This is the part no
  automated source gets right, and the reason hand-added songs are often better
  than scraped ones.
- **Indent a line** with a tab or two spaces to inset it, the way a hymnal
  indents alternating lines. Two tabs indents further.
- **Mark a refrain** by putting `Refrain:` (or `Chorus:`) alone on the first
  line of its stanza. It then prints once, labelled, in italics — and it stops
  being counted as a verse, so the stanza after it is verse 2 rather than
  verse 3. Getting that wrong matters the moment somebody calls out a number.

```
Refrain:
Jesus paid it all,
	All to Him I owe;
```

Anything else — extra blank lines, trailing spaces, Windows line endings — is
tidied up on import.

## Before you add something

Only add songs that are **in the public domain**, or that you have a licence to
reproduce. As a rough guide, a text first published before 1930 is public
domain in the US; anything later usually isn't, no matter how familiar it is.

**A CCLI licence does not help here.** CCLI confirmed in writing (25 August
2026) that neither the Church Copyright License nor the Streaming License
covers displaying lyrics in a website or web app, that it sells no licence
which does, and that restricting the app to your own congregation makes no
difference. Permission has to come from each copyright owner directly.

Songs we sing but cannot print are listed in `data/pending-songs.json`, which
puts the title and writer in the index with no words attached. A title is a
fact and carries no copyright, so that costs nothing and stays lawful.

`Source:` is free text and exists to record *why* a song is safe to include —
"public domain (1779)", "CCLI #1234567", "author's permission, 2026-08-14". It
isn't shown in the app, but it means the decision is written down next to the
song rather than remembered.
