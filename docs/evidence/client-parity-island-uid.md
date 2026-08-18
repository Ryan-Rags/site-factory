# The nine clients render identically — and why the naive check said otherwise

`fix/portfolio-build-gates` changes `src/lib/preview-origin.mjs`, which every
client's build reads. The rule is that existing clients render byte-identical,
so it was measured rather than argued: `pnpm build:all` on `main` in one
worktree, `pnpm build:all` on this branch in another, all 40 built HTML files
hashed.

**Eight of the 40 differed.** All eight were a contact page or a page embedding
the contact form, and the entire difference was Astro's hydration id:

```
< <astro-island uid="Z1AgQet" prefix="r2" component-url="/_astro/ContactForm…
> <astro-island uid="oIrfD"   prefix="r2" component-url="/_astro/ContactForm…
```

## It is the build's absolute path, not the change

Rebuilding in the *same* worktree reproduces the hash exactly, so it is not
per-run randomness:

```
$ sha256sum dist/kh-machine-works/index.html
c80e5169…  (first build)
c80e5169…  (rebuilt, same worktree, same commit)
```

`main` built at a **third** path gives a third value — same commit, no branch
involved:

```
D:/verify-baseline-main  (main)            c80e5169…
D:/vb2                   (main)            30492592…
D:/fix-portfolio-build-gates  (branch)     66d4109b…
```

Two of those three are the same commit and disagree with each other. The id is
a function of where the repo is checked out.

## The parity result

With `uid` and `prefix` normalised, all 40 files match:

```
IDENTICAL: all 40 HTML files match once the path-derived island uid is normalized
```

So no HTML difference on this branch is attributable to this branch, and
`previewOriginFor`'s new prefix branch does not touch a client — as intended,
since it is gated on a slug prefix no client has.

## Worth knowing beyond this PR

**A cross-worktree byte-identical check cannot be run naively on any page with a
React island.** It will report a difference every time, and the difference will
be real bytes with an innocent cause. Normalise `uid=` and `prefix=` first, or
compare within one worktree. Recorded in `docs/known-issues.md`.
