# Client onboarding — the intake

Everything we need from a client between "yes" and the first real build.

Two ways to use it. **On a call**, read the bold questions out; the indented
notes are for you and are not for the client's ears. **As a form**, paste the
bold lines into a Google Form and drop the notes — they are the only thing that
would confuse someone answering alone. Either way the answers land in the same
place: the prospect record in `packages/copy/src/prospects/<slug>.ts`, which is
where the fabrication guard reads them.

**One rule sits above all five sections.** Everything the site says about the
business needs a source we can point at. A value the client gives us on this
call is sourced — they are the primary source about their own business — but
only if we write down *that they said it*. So every answer gets recorded with
its evidence: `client call, <date>`. An answer we do not get stays
`[verify with client]` in the copy, which is fine on a mockup and blocks the
live build, by design. Nothing gets filled in with something plausible.

There is no shame in "I don't know" from a client, and no cost to it either —
the marker just stays until they do. There is a real cost to a guess.

---

## Before the call: print their REPORT.md block

**This is a standing step, not an optional one.**

```sh
pnpm copy:report          # writes packages/copy/REPORT.md
```

`REPORT.md` has a section per client and it is already written as questions for
the owner, because that is what `unconfirmed()` stores. Three things in it, and
each wants a different tone of voice:

| Block in `REPORT.md` | What to do with it on the call |
|---|---|
| **Markers in the copy** | Ask the question as written. One answer clears one marker. |
| **Facts carried from the earlier mockups** | *Read these back.* They came from the client's old site, one hop removed, and a hop is where a value goes stale. "We have you down as open till 4:30 on Fridays — still right?" |
| **About-section prose that is ours** | Read it back and ask them to correct it into their own words. Accurate is not the same as theirs, and About is the page they judge hardest. |

Their `REPORT.md` questions are specific to them and always beat the generic
list below. Work through it first; use section 1 to catch what it did not ask.

---

## 1. Business facts

The evidence the fabrication guard needs. Each of these becomes a `fact()` with
`client call, <date>` as its evidence, or stays a marker.

### Identity

- **What is the full legal name of the business, and what do you actually call
  it day to day?**
  > Two fields, `business.legalName` and `business.name`. The short trading name
  > goes in the header; the legal one goes in the footer and the JSON-LD.

- **What year did the business start?**
  > `business.foundedYear`. Drives the hero eyebrow, the footer and
  > `foundingDate` in the structured data. If they hedge — "my father started it
  > sometime in the sixties" — that is not a year and we do not print one. Ask
  > whether anything they own carries the date: an incorporation certificate, an
  > old sign, a licence.

- **Has the business always had this name?**
  > Matters for the old-site redirects and for the citations sweep, where the
  > previous name is still out there.

### Family ownership and the class questions

"Family-owned" reads as a single fact and is really three. It is also the one
claim on this page that can be legally meaningful — ownership class is what
set-aside and supplier-diversity programmes turn on — so it is always sourced
and never inferred from a surname over the door.

- **Is the business family-owned today?**
- **Is it the same family that started it?**
  > Not the same question. A shop founded by one family and bought by another is
  > family-owned and is *not* "family-owned since 1958" — and the second phrasing
  > is the one that ends up in a hero. `traits.family-run` on `kh-machine-works`
  > is written as both halves in one sentence for exactly this reason; it is the
  > model to copy.
- **Which generation is running it now?**
  > "Second-generation" is a claim with a number in it. Get the number.
- **Is the owner the person a customer deals with?**
  > `traits.owner-led`. It is one of the strongest lines on the site when true,
  > and a lie the first time a customer calls when it is not.

### Credentials

- **Do you hold any certifications, trade affiliations, quality approvals or
  licences we can name?**
  > `certifications[]`. Name, issuing body, and — ask directly — **is it
  > current?** An expired certification on a live site is worse than no
  > certification at all.
- **Can you send a photo or PDF of the certificate?**
  > Not to publish. To have, so the claim has a source that outlives the call.
- **Are you licensed or bonded, and by whom?**
  > Some trades must state a licence number. Ask whether theirs is one.
- **Are you insured, and do customers ask for a certificate of insurance?**

### Services

- **List everything you do — including the small jobs you'd rather not
  advertise, and the things people ask for that you turn down.**
  > `services[]`. Each one needs a name, a plain sentence about it, and its own
  > content file, so the list is not just a list. The turn-downs matter as much:
  > they keep the FAQ honest and they stop the contact form generating leads
  > nobody wants.
- **Which of those do you actually want more of?**
  > Order on the site follows this answer, not the size of the service.
Then the trait questions. Ask all of them — every one is a keyed `traits.*`
value, and each answer either turns on an FAQ entry and a trust-strip line or
leaves a marker. They are keyed rather than free text on purpose: the FAQ needs
to *ask* whether the shop takes walk-ins, and a generator matching on the words
of a free-text answer would read "No walk-ins" as a yes.

- **Can someone turn up without an appointment?** — `walk-ins`
- **Is there a minimum order, or do you take one-off jobs?** — `no-minimum`
- **Do you take breakdown work that has to turn round the same day, and how
  should someone flag it when they call?** — `rush`
- **Do you take ongoing production runs, or mostly one-offs?** — `production-runs`
- **Can someone bring a broken part in and have it copied when there's no
  drawing?** — `from-the-part`
- **Will you quote from a photo and dimensions?** — `quote-from-photo`
- **Do you work at the customer's site as well as in your own shop?** — `on-site`
- **Are quotes free?** — `free-quotes`
  > A price claim, so it gets sourced like one. "Usually" is not yes.
- **Who does a customer actually deal with, by name?** — `people`
  > Only where they are happy to be named on the site.

### Hours

- **What are your hours, day by day? Which days are you closed?**
  > `business.hours[]`. Day by day, not "9 to 5 weekdays" — the JSON-LD and the
  > open-now badge both need each day.
- **Is there a lunch break or a day you close early?**
- **What is the phone actually like outside those hours — voicemail, a mobile,
  or nothing?**
  > If the site implies someone answers and nobody does, the site caused the bad
  > experience.
- **Which time zone are you in?**
  > The open-now badge is computed in the shop's own IANA time zone and does not
  > render at all without one. It is never baked at build time, because that
  > would assert something about the moment we built rather than the moment
  > somebody is reading.

### Contact and location

- **What is the best phone number for new customers?**
  > `business.phone` plus `phoneHref` in E.164 (`+12015550142`). If they have a
  > tracking number or a second line, ask which one they want on the site.
- **What email should enquiries go to, and who reads it?**
- **What is the full street address, including the suite or unit?**
  > Character for character — it has to match the Google Business Profile
  > exactly, and "St" against "Street" is enough to cost them ranking.
- **Do customers come to you, or do you go to them, or both?**
  > Decides whether the address is a shopfront or a service-area business, which
  > changes how the profile is set up.

### Service area

- **Which towns do you actually serve?**
  > `business.serviceArea[]`. One block per town on one page — never a page per
  > town, which is the doorway-page pattern and has been demoted for years.
- **Where do you draw the line — how far will you travel?**
- **Is there a wider area you'd describe yourself as covering — a county, a
  metro, a state?**
  > Two fields. `serviceTowns` are the towns that get their own section;
  > `wider` is the broader area that goes into `areaServed` without one.
  > We print the towns they claim and nothing else. We will never write a
  > distance, a drive time, a landmark, a neighbourhood or a highway into town
  > copy. Invented local colour is the most recognisable tell of automated local
  > copy, and a local spots it instantly.

---

## 2. Photos

Phone-quality is genuinely fine — a real photo of the real shop beats a stock
image every time, and looks it. What we cannot use is anything they do not own.

**Ask up front: are these your own photos, taken at your shop, of your work?**
Anything from a supplier's brochure, a manufacturer's site or an image search
does not go on the site.

### The slots

| We need | How many | What it becomes |
|---|---|---|
| **Outside the building** | 2–3 | The home hero, wide, landscape. Include the sign if there is one. |
| **Inside — the shop floor** | 3–5 | The story image on About, and the gallery. |
| **The team** | 1–2 | About. A group shot beats headshots. |
| **Work examples** | 5–10 | The gallery, one per square image. |
| **Logo files** | whatever exists | Header, footer, favicon, social card. |

### What to say about each

- **Exterior** — *"Something a customer could use to recognise the place from
  the street."* Landscape, taken in daylight. This one becomes the hero, which
  is the largest image on the site and the one the performance score is measured
  against.
- **Interior** — *"The shop as it is on a normal working day."* Tidy is fine,
  staged is not; empty and spotless reads as a stock photo.
- **Team** — *"Whoever a customer would actually meet."* Ask permission per
  person; a staff photo published without asking is a real problem and an
  avoidable one.
- **Work examples** — *"Jobs you're proud of, and ideally a couple where the
  before is as interesting as the after."* Ask what each one is: an uncaptioned
  photo is decoration, a captioned one is evidence. Ask also whether any of it
  is a customer's proprietary part — some shops are under NDA and will not know
  we need to ask.
- **Logo** — ask for the original file (`.ai`, `.eps`, `.svg`, `.pdf`) and if
  there is none, the largest PNG or JPG they have. A logo scraped off their own
  old website at 200px wide will look soft on a phone and there is no fixing it
  afterwards. Ask who made it and whether they own it outright.

### Two rules that decide whether sections render at all

- **The gallery only turns on with real photographs of that shop's own work.**
  Six placeholders captioned as recent work is fabricated work, so the design
  gallery treats an empty item list as a build error rather than quietly falling
  back to stock art.
- **The before/after slider renders only when both photographs are declared
  genuine and are of the same job.** A "before" from one job against an "after"
  from another is a fabrication with two real photos in it.

If the photos are not there yet, the site ships with labelled placeholders and
we swap them. It is not a blocker for the build. It is a blocker for go-live.

### No photos?

The common answer, and not a problem — but it is a thing to *book*, not a thing
to wait for. An owner who leaves the call believing photography is their
homework is an owner whose launch slips a month.

- **The default offer: Ryan takes them.** At the walk-in or at handoff, about
  ten minutes on a phone — the exterior, the workspace, three to five examples
  of the work, and the team if they are willing to be in a picture. Offer this
  outright rather than asking whether they have photos and seeing what arrives.
- **Their Google Business photos can seed the build.** Useful for getting a real
  mockup in front of them quickly. Before go-live, though, **every one of them is
  either confirmed by the owner as theirs to publish or swapped for one that
  is** — the standing attribution rule. A photo we pulled rather than sourced has
  nowhere on the page to carry its credit, so it does not survive to a live site;
  the owner confirming it is what makes it publishable, exactly as with any other
  fact they are the source for.
- **Real stock photography is for atmosphere only.** A texture, a backdrop, a
  material. Never a photograph standing in for their shop, their team or their
  work — that is a picture of somebody else's business on their About page.
- **AI imagery only for abstract backgrounds and textures.** Never depicting the
  trade, the shop, a tool, a part or a person. A generated welder is a fabricated
  welder, and it is the one kind of fake that the people they are selling to spot
  instantly.
- **If nothing exists at all, the site ships text-forward.** `features.gallery`
  goes `false`, which emits no gallery page and no nav link pointing at one, and
  the copy is written to stand up without the images rather than around the gaps
  where they should be. Placeholders are a mockup state and only a mockup state:
  **no placeholder hole ever goes live.**

---

## 3. Access & accounts

We are collecting *answers* here, not doing the work — the mechanics are in
[`go-live.md`](go-live.md), and several of these are cheap now and expensive
later.

### Domain

- **Do you own a domain name already? What is it, exactly?**
- **Where did you buy it — GoDaddy, Network Solutions, your old web person?**
- **Who can log in to that account today?**
  > The question that matters, and the one clients answer vaguely. "My nephew
  > set it up" is a blocker discovered now or a crisis discovered at launch. If
  > the answer is a person who is no longer around, start the recovery process
  > this week, not in launch week.
- **Is the domain set to auto-renew, and when does it expire?**
- **Did you have a website before this one? Is it still up?**
  > Its URLs carry accumulated authority and we will redirect them. Losing them
  > is losing the head start. Get the old address even if the site is dead.
- **Do you want `www.` or no `www.`?**
  > Their choice, and it is genuinely arbitrary — but it is decided once and
  > never changed, and we must never serve both.

If they do **not** have a domain: do not let them buy one before we run
`node scripts/domain-safety/check.mjs <domain>`. A cheap expiring name is cheap
for a reason often enough to check every time, and none of that history is
visible on the registrar's parked page.

### Google Business Profile

- **Do you have a Google Business Profile, and can you log in to it?**
  > For a local shop this outranks the website for most searches. If it is
  > unclaimed, claiming it is usually the highest-value hour of the whole
  > project.
- **What email address is it under?**
- **Is everything on it current — the hours, the phone, the address?**
  > Whatever they say here has to match the site character for character.
  > Inconsistent name/address/phone is the most common reason a legitimate
  > business ranks below a competitor.

### Reviews

- **Do you have Google reviews? Do you ask customers for them?**
- **Can you send us the link customers use to leave one?**
  > This becomes `business.reviewUrl` and the counter card that `pnpm review-card
  > <slug>` prints. **Take the Place ID from their profile itself — never guess
  > one.** A wrong ID sends their customers to a competitor's review form.
- **Are there reviews you'd like quoted on the site?**
  > Careful here. We never copy review text off a review platform, and we never
  > write a testimonial and present it as a customer's words. A quote goes on the
  > site when the client or the reviewer gives us the wording directly. Anything
  > else stays marked as ours, and while any testimonial is a placeholder the
  > page carries a visible dashed warning that does not come off until every one
  > is verified.

### Everything else they might have

- **Is there anything else online with your name on it that you can log in to?**
  > Facebook page, Yelp, an industry directory, an old email host. We are not
  > taking any of it over — we are finding out what exists before a mismatched
  > phone number on a page nobody remembers starts undercutting the new site.

---

## 4. Preferences

### The look

If they have been through the customizer, this is already answered — and it is
answered better than they could say it out loud.

- **Send us the address bar from the version you liked.**
  > The URL carries the exact combination as four parameters (`theme`, `scheme`,
  > `accent`, `font`). That is the whole point of it: a link naming the design
  > they chose, with nothing lost in translation. The "Send it to us" button does
  > the same thing; either is fine.

If they have not, or if they want to change something:

- **Which of the three looks feels like your business — Forge, Precision or
  Heritage?**

  | Preset | Look | Built for |
  |---|---|---|
  | **Forge** | Near-black carbon, brushed steel, condensed caps, hot accent | Machine shops, welding, fabrication |
  | **Precision** | White and graphite, blueprint grid, drafting ticks, measured blue | Contractors, HVAC, electrical |
  | **Heritage** | Cream and deep forest, serif display, sign-painter's rules | Legacy shops, second-generation trades |

- **Light or dark?**
- **Which accent colour?**
  > Seven per preset, each preset with its own set: Forge runs Ember orange
  > through Rust copper; Precision, Blueprint blue through Violet; Heritage, Old
  > brick through Verdigris. The same name is tuned differently in light and dark
  > within a preset, so the choice belongs to the light/dark answer above rather
  > than sitting on top of it. Every one has been contrast-tested
  > against its own palette, which is exactly why the choice is from a list —
  > there is no free colour input anywhere, in the config or the UI.
- **Do you have brand colours you want us to match?**
  > Ask, and get the actual values if they have them. We will use their accent
  > where it passes contrast against the chosen palette and tell them plainly
  > where it does not. A palette we invented is not their brand colour and is
  > never offered as one.

### Pages

- **The site comes with a home page, services, about, contact and a gallery.
  Does that cover it, or is something missing?**
  > The gallery only turns on with real work photos — see section 2.
- **Is there anything you want on the site that isn't one of those?**
  > Capture it, do not promise it. A financing page, a parts catalogue or a
  > booking system is a different conversation and belongs in the brief, not in
  > a "sure" on a call.

### Anything they insist on

- **Is there anything you want the site to say, in particular?**

  This is the one place on the intake where a client hands us a sentence and
  expects to see it published. Write it down verbatim, and then it goes through
  the same evidence rule as everything else:

  - **A fact about their own business** — they are the source. It gets recorded
    with `client call, <date>` and it can be published.
  - **A claim about anyone else, or a superlative** — "the oldest shop in the
    county", "the only one certified for this in New Jersey" — needs something
    behind it. Ask what. Often there is something, and then we can print it.
  - **Nothing behind it** — it stays out, or it goes in softened to what is
    true. Say so on the call rather than discovering it at go-live, when the
    marker gate is refusing to publish and the client is expecting to launch.

- **Is there anything you specifically do *not* want on the site?**
  > Cheaper to hear now. A price list, a home address, one particular service,
  > a former partner's name.

---

## 5. Plan and billing

- **Which plan do you want?**

  Two, and they buy the same site and the same service — the only difference is
  how it is paid for. These are Ryan's prices as set. Read the row out as it is
  written: none of it is an opening position, and there is no third tier to
  reach for if they hesitate.

  | Plan | What's included | Price |
  |---|---|---|
  | **A — paid up front** | **Year one fully included:** hosting, SSL, security, the domain, up to **two content edits a month**, the Google Business Profile kept in sync with the site, and support by text. | **$3,000** one time. After year one, an **optional care plan at $99/month**. |
  | **B — monthly** | The same inclusions, in full. | **$500** deposit, then **$200/month**. **Six-month minimum**, then cancel any time. Price **locked for 24 months**. |

  > The inclusions are identical, so this is not a tier ladder and nothing is
  > held back from B. The two lines a client most often remembers differently
  > afterwards are "up to two content edits a month" and the six-month minimum,
  > so say both out loud rather than leaving them to be read.

- **When do you want to be live?**
  > Then say what actually gates it: markers cleared, photos in, domain access.
  > A date agreed without those attached is a date that slips and looks like our
  > fault.
- **Who handles the invoices — you, or someone else?**
- **What name and address should the invoice be made out to?**
  > Often the legal entity, not the trading name. Same distinction as section 1.
- **What email should invoices go to?**
- **How do you want to pay, and how often?**
- **Who is my day-to-day contact once we start, and what's the best way to
  reach them?**
  > One name. Two people answering on behalf of the business is how a
  > contradiction ends up published.

---

## After the call

1. Write the answers into `packages/copy/src/prospects/<slug>.ts` as `fact()`
   with `client call, <date>` as the evidence. Anything still open stays
   `unconfirmed()` with the question that would clear it.
2. `pnpm copy:report` again. What is left in `REPORT.md` is the follow-up list,
   already phrased as questions.
3. `pnpm copy:emit` and rebuild. The guard runs during generation, so a
   rebuild is the assertion that nothing unsourced got in.
4. Photos, access and anything still marked go to [`go-live.md`](go-live.md),
   which will not let the site go indexable while a marker survives.

Never store their answers anywhere that gets committed except the prospect
record. Phone numbers, contact names and login details do not go into a commit,
a PR body or a GitHub issue.
