## Work goes through a pull request

`main` is protected (since 12 Nov 2026). Nothing lands by pushing to it, not
even from Michael's own account. Branch, open a pull request, and let GitHub
merge it.

```
git switch -c gh-<issue>-<short-slug>
# … work, one commit per defect …
gh pr create --fill --body "Closes fallguy04/fall-studios#<issue>"
gh pr merge --squash --auto
```

**Vercel is the check.** Every pull request gets a Vercel preview build, and
that build runs `npm test` (the node test runner over `tests/`) before it builds (see `vercel.json`). GitHub merges
the pull request by itself once the `Vercel` check is green. A red X means
fix it on the branch and push again. A failing check also stops a
production deploy, because production runs the same build.

Running `npm run check` locally first is faster than waiting on Vercel. Say in the PR
body what you ran and what it said.

**Who merges: GitHub does, on green.** Michael, 11 Nov 2026: *"Merge
everything yourself, I don't want to approve each one."* Nothing waits on
him. A decision that is his to make is raised in chat, never parked in an
open pull request.

## Issues live in one tracker

Every issue for every app is in `fallguy04/fall-studios`, labelled
`priority: …` and `status: …`. Close one from here with
`Closes fallguy04/fall-studios#N`. A closed issue carries no status label.

## Patterns that travel

`DESIGN.md` in fall-studios
(https://github.com/fallguy04/fall-studios/blob/main/DESIGN.md) holds what
every app should do the same way, starting with how a table keeps its
headings, first column and count on screen. Carry the principle, not the
file: this app keeps its own fonts and colors.
