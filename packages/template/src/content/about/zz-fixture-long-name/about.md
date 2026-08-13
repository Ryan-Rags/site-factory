---
title: A fixture, not a shop
---

There is no business here. Alder & Voss Welding Company does not exist, has
never existed, and nothing on this build describes anybody's real work.

The file exists because the `about` content collection is schema-validated and
a config whose `about.entry` has no matching entry fails the build — which is
the correct behaviour, and which this fixture has to satisfy like any other
config.

What the fixture is actually for is its name. Twenty-eight characters, an
ampersand and a trailing "Company": the shape that wraps worst in a header
bar, and long enough that the stylesheet this fixture was added alongside
would have truncated it at every gated viewport. `check:textfit` asserts it
sets on at most two lines in all 112 cells, so the measured budget behind the
lockup rule cannot be narrowed without something failing here first.

It is also the only build in the repo with `features.gallery` turned on, which
makes it the only place the `/gallery` route is rendered and gated at all.
