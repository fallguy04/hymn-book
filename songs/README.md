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

Anything else — extra blank lines, trailing spaces, Windows line endings — is
tidied up on import.

## Before you add something

Only add songs that are **in the public domain**, or that you have a licence to
reproduce. As a rough guide, a text first published before 1930 is public
domain in the US; anything later usually isn't, no matter how familiar it is.

A CCLI licence covers reproducing lyrics for congregational use and would cover
much of a modern hymnal — worth checking whether your congregation holds one
before adding anything still in copyright.

`Source:` is free text and exists to record *why* a song is safe to include —
"public domain (1779)", "CCLI #1234567", "author's permission, 2026-08-14". It
isn't shown in the app, but it means the decision is written down next to the
song rather than remembered.
