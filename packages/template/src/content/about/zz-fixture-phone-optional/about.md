---
title: A fixture, not a shop
---

Fixture Fabrication is not a business. It is a test fixture in this repository,
used to prove that a client's contact form can ask for an email address and
treat a phone number as optional, and that the Worker enforces that rule
server-side rather than trusting the form.

Nothing on this site describes a real company. The address is invented, the
phone number is in the 555-01xx range reserved for fiction, and the testimonial
carries the template's own "these are not a customer's words" banner.

It is never deployed. `scripts/build-all.mjs` skips it, so it does not appear in
`dist/` during a batch build and cannot reach the Pages deploy script.
