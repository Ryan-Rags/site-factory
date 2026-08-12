---
title: A fixture, not a shop
---

Go-Live Fixture Works is not a business. It is a test fixture in this
repository, and the only one built with `seo.noindex` set to false.

Every other config in `clients/` is a private pitch mockup: it tells crawlers to
stay away, its `robots.txt` disallows everything, and no sitemap is emitted at
all. That is the right posture for a mockup, and it means the other half of the
build — the half that flips a site to indexable, emits a sitemap and points
`robots.txt` at it — was never executed by anything. The first run of that code
would otherwise have been on a real client's real domain.

So this fixture runs it instead. The address is invented, the phone number is in
the 555-01xx range reserved for fiction, and the domain is on `.test`, a
top-level domain reserved by RFC 6761 that nobody can register. It is skipped by
batch builds and unreachable by the deploy script.
