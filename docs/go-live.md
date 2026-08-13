# Go-live runbook

Taking a client's site from a private mockup to a live, indexable, ranking
website.

Work through it in order. Several steps are cheap now and expensive later —
picking the wrong canonical host, or buying a burned domain, costs weeks to
undo and is invisible until it has already cost the client traffic.

The technical preconditions are enforced by `check-go-live.mjs`, which is inert
while `seo.noindex` is true and demanding the moment it is false. This document
covers the parts a script cannot do.

---

## 0. Before anything: is the domain safe?

**Do this before the client buys the name, not after.**

A domain carries whatever the last owner did with it. An expired name going
cheap is going cheap for a reason often enough to check every time. The failure
mode is not subtle — a shop's brand-new site inheriting a former adult site's
reputation, or arriving pre-flagged in Chrome — and none of it is visible in
WHOIS or on the registrar's parked page.

```
node scripts/domain-safety/check.mjs <domain>
```

Reports Wayback capture history with archived page titles sampled across the
years, and Google Safe Browsing status. Verdicts:

| Verdict | Meaning |
| --- | --- |
| `clear` | Nothing found against it in the checks that ran |
| `review` | There is history. **Go and read the archived pages yourself** before buying |
| `avoid` | Safe Browsing currently flags it |

`review` is the common case for any domain with a past and is not a refusal.
Anything the script could not measure prints `unavailable` — it never guesses,
and an `unavailable` is not a pass.

Safe Browsing needs `SAFE_BROWSING_API_KEY` in `.env` (free, from the Cloud
console). Without it that half reports `unavailable` and the Wayback half still
runs.

**If the domain has a past worth worrying about**, either pick a different name
or plan for it: expect a slow start, and consider disavowing inherited spam
links once Search Console shows them.

---

## 1. Pick the canonical host, once

`www.example.com` or `example.com` — either is fine, but **decide before
launch** and never serve both. Two hosts serving the same pages splits every
ranking signal in half and is one of the most common own goals in local SEO.

Set `seo.siteUrl` in the client config to the chosen one, exactly, with
`https://`. Everything downstream — canonicals, `og:url`, the sitemap, JSON-LD
`@id` — is derived from it, so this single value is what makes the whole site
agree with itself. `check-metadata.mjs` fails the build if any page disagrees.

Redirect the other host at the DNS/Pages level (step 2), permanently, in one
hop.

---

## 2. DNS and Cloudflare Pages

1. Add the domain as a zone in Cloudflare (or move its nameservers there).
2. In the Pages project → **Custom domains**, add **both** the apex and `www`.
   Cloudflare issues certificates for both.
3. Add a **Bulk Redirect** or a Redirect Rule sending the non-canonical host to
   the canonical one with **301**, preserving path and query:
   `https://www.example.com/$1` ← `https://example.com/(.*)`
4. Verify from a terminal, not a browser — a browser hides the hop:
   ```
   curl -sI https://example.com/services | grep -i "^HTTP\|^location"
   curl -sI https://www.example.com/services | grep -i "^HTTP"
   ```
   Expect exactly one 301 then a 200. **Two hops is a bug**; so is a 302.
5. Enable **HSTS** at the zone (SSL/TLS → Edge Certificates), max-age 6 months
   to start. It is deliberately *not* in `_headers`: the header belongs to the
   whole zone, and setting it from a Pages project that also answers on
   `*.pages.dev` would pin a preview host too.

### Security headers

They ship automatically. `scripts/gen-headers.mjs` writes `dist/<slug>/_headers`
during the build, and Cloudflare Pages serves it. Confirm on the live host:

```
curl -sI https://www.example.com/ | grep -iE "content-security-policy|x-content-type|referrer-policy|permissions-policy|x-frame"
```

If nothing comes back, `_headers` did not make it into the deployed directory —
the deploy published the wrong folder. `check-go-live.mjs` refuses a live build
without it, so this should be impossible; check anyway, because it is one
command.

---

## 3. Flip to indexable

**In this order.** The gates exist to stop a site going live with an
unconfirmed value or a broken card, and they only run if you let them.

1. Set `seo.noindex: false` in `clients/<slug>.config.ts`.
2. Confirm every `[verify with client]` marker is resolved. `check-markers.mjs`
   refuses the build otherwise — markers are fine on a mockup and disqualifying
   on a live site.
3. Build and let the full chain run:
   ```
   SITE_CLIENT=<slug> pnpm --filter @site-factory/template build
   ```
   This runs, among others: markers, fabrication, contrast, contact links,
   header generation and verification, metadata, schema, and go-live
   preconditions.
4. Run the runtime check — the one that proves the CSP does not break anything:
   ```
   pnpm --filter @site-factory/template check:csp-runtime <slug>
   ```
5. Deploy.

What flipping the flag actually changes: every page drops `noindex,nofollow`;
`robots.txt` switches from `Disallow: /` to `Allow: /` plus a `Sitemap:` line;
and `@astrojs/sitemap` — omitted entirely while noindex — starts emitting
`sitemap-index.xml` and `sitemap-0.xml`.

There is no separate "go-live mode" flag on purpose. Two flags can disagree;
one cannot.

---

## 4. Search Console and Bing

### Google Search Console

1. Add a **Domain property** (not a URL prefix) — it covers both hosts and
   every protocol at once.
2. Verify by DNS TXT. In Cloudflare DNS, add the TXT record Google gives you at
   the zone apex. Verification usually passes within a minute.
3. **Submit the sitemap**: Sitemaps → enter `sitemap-index.xml`.
   Google follows the index to `sitemap-0.xml`; you do not submit both.
4. Use **URL Inspection → Request indexing** on the home page. This does not
   buy ranking, it buys a first crawl in hours instead of days.
5. Check **Page indexing** a week later. "Discovered – currently not indexed" on
   a five-page site usually means thin content, not a technical fault.

### Bing Webmaster Tools

Add the site and choose **Import from Google Search Console**. It carries the
verification and the sitemap across in one step. Bing is a small share of
traffic but it is also what ChatGPT and Copilot search, which is no longer
negligible for a local business.

---

## 5. Google Business Profile

For a local shop this outranks the website itself for most searches. The site
supports the profile; it does not replace it.

1. Claim or access the profile. If it is unclaimed, claiming it is usually the
   single highest-value thing done all week.
2. **Website field** → the canonical URL from step 1, exactly.
3. **NAP consistency.** The name, address and phone on the profile must match
   `site.config.ts` character for character — "St" vs "Street", "(201)" vs
   "201-", a suite number present in one and absent in the other. Inconsistent
   NAP is the most common reason a legitimate business ranks below a competitor.
4. Categories: one primary, as specific as it goes. Secondary categories for
   genuine services only.
5. Hours must match `business.hours`. The "open now" badge on the site reads
   the config; if the two disagree, one of them is lying to a customer.
6. Add photos. Ten real photographs of the shop, the team and the work beat any
   copy on the site for conversion.

### Reviews

The single biggest lever the shop actually controls.

```
pnpm review-card <slug>
```

Prints a 3.5×5in "Scan us on Google" card for the counter, from
`business.reviewUrl`. Take the Place ID from the profile itself — never guess
one, because a wrong ID sends the shop's customers to a competitor's review
form.

Ask at the counter, at the moment the customer is pleased and present. That is
the whole trick.

---

## 6. Redirects from an old site

If the client had a previous website, its URLs carry accumulated authority.
Losing them is losing the head start.

1. Get the old URL list: Search Console (old property) → Pages, plus
   `node scripts/domain-safety/check.mjs <domain>` for what the archive knows,
   plus the old sitemap if it still resolves.
2. Map each old URL to its **closest equivalent**, not to the home page. A
   blanket redirect to `/` is read as a soft 404 and passes nothing.
3. A page with no equivalent should return **410 Gone**, not a redirect. Telling
   a crawler the page is deliberately gone retires it cleanly; redirecting it
   somewhere irrelevant devalues the target.

Template — save as `clients/<slug>.redirects.csv` while drafting:

```csv
old_path,new_path,status,note
/index.html,/,301,old home page
/services.php,/services,301,
/services/welding.php,/services#welding,301,no separate page now
/about-us.html,/about,301,
/contact.php,/contact,301,
/blog/2014/holiday-hours,,410,retired — no equivalent
/old-product-catalogue.pdf,,410,superseded
```

Turn it into a Cloudflare Pages `_redirects` file (one rule per line, most
specific first):

```
/index.html            /            301
/services.php          /services    301
/services/welding.php  /services    301
/about-us.html         /about       301
/contact.php           /contact     301
/blog/2014/holiday-hours  /404      410
```

Place it in `packages/template/public/_redirects` so it is copied into the
build. Then verify every single one:

```
while IFS=, read -r old new status note; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://www.example.com$old")
  echo "$code  $old -> $new"
done < clients/<slug>.redirects.csv
```

**Execution is per-client and happens at go-live** — this template ships with
the stream; filling it in is part of the individual launch.

---

## 7. Citations

"Citations" means the business's name, address and phone appearing consistently
elsewhere. Consistency is the whole point; volume is not.

Worth the time, in order:
1. Google Business Profile (step 5)
2. Bing Places
3. Apple Business Connect — this is what Apple Maps and Siri read
4. Facebook page
5. The relevant trade directory, if the industry has a real one

Then stop. Paid citation-blasting services produce hundreds of low-quality
listings, many with slightly wrong details, and slightly wrong is worse than
absent.

Copy the NAP from `site.config.ts` every time rather than retyping it. That is
what makes the consistency automatic rather than remembered.

---

## 8. Handoff: send a test lead from the owner's machine

Everything above is verified from our side. This one is not: do it **with the
owner, on their computer, signed into the inbox the leads actually land in.**
The form working from our desk proves the Worker. It does not prove that the
person who has to answer the enquiry will ever see it.

1. **Submit a test lead together**, filled in the way a customer would fill it —
   a real name, their own phone number, and **their own email address in the
   email field**, which matters for the reply check below. One sentence in the
   message is enough. It creates a lead nobody has to answer and it is the only
   thing that proves the whole path end to end.

2. **Watch where it lands, and fix it there and then if it lands in spam.** A
   first message from a sending domain that mailbox has never seen before is a
   normal thing to be filtered, and it is a five-minute fix on the day and a
   silent disaster three weeks later:

   - Open the message and mark it **Not Spam**.
   - Add a filter on `mail.raghubans.com` as the sender: **never send it to
     spam, keep it in the inbox, and apply the label "Website Leads".**

   Do it on their machine. The filter belongs to their mailbox and cannot be set
   from ours, and an owner who cannot find the first real enquiry concludes the
   website does not work.

3. **Hit Reply on the notification and confirm it arrives.** The lead email sets
   its reply-to to **the address the form carried**, so replying goes to the
   customer rather than to us — and because the test lead was submitted under the
   owner's own address, the reply comes straight back to the inbox they are
   sitting in front of. That round trip is the confirmation.

   Note the condition: reply-to is set **only when the submission included an
   email address**. A test lead sent with the email field blank will deliver
   fine and prove nothing at all about replying, which is why the first step
   above insists on filling it in.

---

## 9. After launch

**Week one.** Confirm indexing (`site:example.com` in Google). Check Search
Console for coverage errors. Re-run the header curl from step 2.

**Month one.** Search Console → Performance for the first real queries. They
are usually not the ones anybody predicted, and they are the best available
guide to what the next page of copy should be about.

**Ongoing.** Reviews. Everything else on this list is done once; reviews are the
thing that compounds.

---

## Quick reference

```bash
# Before buying a domain
node scripts/domain-safety/check.mjs example.com

# Build one client with every gate
SITE_CLIENT=<slug> pnpm --filter @site-factory/template build

# Prove the CSP does not break the site
pnpm --filter @site-factory/template check:csp-runtime <slug>

# Go-live preconditions only
pnpm --filter @site-factory/template check:go-live <slug>

# Live header check
curl -sI https://www.example.com/ | grep -iE "content-security|x-content-type|referrer|permissions|x-frame"

# Redirect hop check
curl -sI https://example.com/ | grep -i "^HTTP\|^location"

# Counter card for reviews
pnpm review-card <slug>
```
