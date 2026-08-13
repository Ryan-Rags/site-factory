---
title: A fixture, not a shop
---

There is no business here. Vane & Rell Motorworks does not exist, has never
existed, and nothing on this build describes anybody's real work.

The file exists because the `about` content collection is schema-validated and
a config whose `about.entry` has no matching entry fails the build — which is
the correct behaviour, and which this fixture has to satisfy like any other
config.

What the fixture is actually for is the motion axis. `data-motion-preset` is
stamped on pitch builds only, so the three presets — `still`, `calm` and
`lively` — are unreachable on any delivered client, and none of the eight can
be the thing that proves they work. `check:reveal` sweeps `?motion=` here.

Two of the three contracts say something CSS cannot express, and this page is
shaped around measuring both. The stats block carries three counters, because
`still` declares `counters: paint` and a figure still reading zero would be
the preset withholding information rather than withholding motion. The reviews
section is a carousel with a 2500ms autoplay — the only one in the repo —
because `still` declares `carousel: off`, and the only honest way to check a
timer never started is to read `scrollLeft`, wait past the delay, and read it
again.

It is also the only build on the `apex` family, so it is where that family's
hairline card rule, accent tick and left-bordered stats are rendered as a whole
page rather than as a passing cell in a matrix.
