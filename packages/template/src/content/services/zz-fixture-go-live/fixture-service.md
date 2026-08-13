---
title: Fixture Service
summary: A service that does not exist, for a business that does not exist.
highlights:
  - Exists so the services collection has an entry to render
  - Describes no real capability
  - Belongs to a go-live test fixture, not a client
---

There is no service here. This file exists because the services content
collection is schema-validated, and a config that lists a service with no
matching entry fails the build — which is the correct behaviour, and which this
fixture has to satisfy like any other config.

The fixture's whole purpose is `seo.noindex: false`. See
`clients/zz-fixture-go-live.config.ts` for why the indexable build path needs a
throwaway to run on.
