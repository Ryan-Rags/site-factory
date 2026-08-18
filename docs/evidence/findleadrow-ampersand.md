# findLeadRow and the `&` divergence — measured on the 50 (issue #57)

`slugify` in `@site-factory/discover` drops `&`; the 2026-08-16 batch expanded it
to `and`. `findPlaceId` was taught both spellings in PR #56, which took the
place-id backfill from 36/50 to 50/50. `findLeadRow` was not, so the reader that
supplies a prospect's niche, phone and current URL still missed exactly the
records the other reader had just been taught to find.

Measured against `packages/template/prospects/known.json` (the 50 committed
slugs) and the CSVs in gitignored `data/`. The "before" column is the predicate
`findLeadRow` carried on `main`, `slugify(row.name) === id`, run over the same
files in the same order.

    ampersand records on the call sheet: 16
      before (slugify only): 2/16
      after  (slugsFor)    : 16/16

    non-ampersand records: 34   before: 34   after: 34  (unchanged)

16 slugs carry `-and-`; two of those businesses spell the word "and" in their
name, so `slugify` already matched them. The other **14 carry a literal `&`** —
the exact count issue #57 and `docs/known-issues.md` #10 record — and every one
of them was a silent miss, indistinguishable from a business nobody discovered.

The 14, all filed under the expanded spelling, all found after the change:

    skyline-roof-repairs-and-replacement          jes-roofing-and-general-construction-llc
    chavez-and-sons-roofing-and-construction      cnr-construction-and-masonry-llc
    jersey-railing-and-welding                    perfect-welder-fabrication-and-repair
    e-and-e-construction-llc                      universal-roofing-and-chimney
    done-by-brandon-llc-home-improvement-and-gc   elite-work-exterior-and-roofing
    avishay-contractors-kitchen-and-bath-remodeling  a-and-a-bergen-home-improvements
    cornerstone-roofing-and-restoration           r-and-r-building-services-nj

Read path only. Nothing is renamed and no deployed URL moves — the 50 demo URLs
are on the call sheet Ryan dials from, which is why `slugsFor` matches two
spellings rather than declaring one right. The divergence itself stays open as
known-issues #10; this is the second half of the workaround, not the fix.
