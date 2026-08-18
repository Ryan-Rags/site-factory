/**
 * Every constant this site is allowed to vary. There is no client config, no
 * generated config and no content collection: five hand-written pages read
 * from here, and that is the whole data layer.
 *
 * Deliberately NOT imported from @site-factory/template or any other workspace
 * package. Design values were copied in from the template's `apex` preset
 * (packages/template/src/design/presets.json) as literals, so this app has zero
 * runtime coupling to the client pipeline and cannot be broken by a change to
 * it. The cost of that choice is that a token change has to be made twice; the
 * benefit is that a founder site and a client mockup can never regress each
 * other, which matters more.
 */

/** Canonical origin. Every canonical, OG url and sitemap entry derives from it. */
export const SITE_URL = 'https://raghubans.com';

export const FULL_NAME = 'Ryan Raghubans';
export const REGION = 'Bergen County, NJ';

/**
 * The single source for the smart-market venture's name, so renaming it is one
 * edit here rather than a hunt through five files. Nothing else in the codebase
 * spells it out.
 *
 * NOTE: this is a working name, not a ruling — see the Decision Brief on the PR
 * that introduced this package. It is find-replaceable by construction.
 */
export const AMENITY_BRAND = 'Alcove Markets';

export const EMAIL_DEV = 'ryan@raghubans.com';

/**
 * The amenity venture's inbox. Referenced ONLY as a `mailto:` href, never as
 * rendered text on /amenity — the local part is a word that must not appear in
 * that page's visible copy, title, meta or social text, and
 * `scripts/check-amenity-wording.mjs` enforces exactly that. On the founder
 * pages the address is shown plainly, which is fine and intended.
 */
export const EMAIL_AMENITY = 'vending@raghubans.com';

/**
 * Short form of the amenity brand, for the nav. Derived rather than spelled,
 * because `AMENITY_BRAND` is the single source for this venture's name and a
 * second hand-written copy in the nav is exactly the one that survives a
 * rename and goes stale. One word is what fits a five-item bar at 320px.
 */
export const AMENITY_SHORT = AMENITY_BRAND.split(' ')[0] ?? AMENITY_BRAND;

/**
 * A `mailto:` with a subject line already written.
 *
 * Every CTA on this site opens a mail client, so the subject is the only part
 * of the resulting email we control — and an inbox that receives "(no subject)"
 * from a property manager cannot be triaged. `encodeURIComponent` is what makes
 * it a well-formed URL rather than a string that happens to contain spaces: a
 * raw space in an href is not valid, and the em dash in these subjects is three
 * bytes that must be percent-encoded before a mail client will parse the query.
 *
 * `check-live.mjs` re-parses every `mailto:` on the SERVED pages with `new
 * URL()` and asserts the subject survived encoding, because "it looked right in
 * the source" and "the deployed href parses" are different claims.
 */
export function mailto(address: string, subject: string): string {
  return `mailto:${address}?subject=${encodeURIComponent(subject)}`;
}

/**
 * Subject lines, per venture rather than per button.
 *
 * Two CTAs on the same page share a subject deliberately: the subject names
 * what the mail is ABOUT, and a reader who clicked the header rather than the
 * footer has not told us anything different about their intent.
 */
export const SUBJECT_AMENITY = `${AMENITY_BRAND} — proposal request`;
export const SUBJECT_SITES = 'site-factory — website inquiry';
export const SUBJECT_AI = 'AI voice agents — call flow';
/** The footer's plain contact listings, which are actions too. */
export const SUBJECT_GENERAL = 'Hello from raghubans.com';

/**
 * ---- FACTS RYAN SUPPLIED AND STANDS BEHIND. ----
 *
 * Held as constants rather than typed into prose because each one is a claim
 * about a real person on an indexed page, and a number that appears in three
 * files is a number that goes stale in two of them.
 *
 * SOURCING, per the repo's fabrication rule: every value here traces to a
 * ruling Ryan gave in the founder-site-v3 task dialogs. Nothing is rounded up,
 * inferred, or extended. If a value stops being true it is edited HERE.
 */

/** Ruling (b): "coding since 2018", and four PROFESSIONAL years. */
export const CODING_SINCE = 2018;

/**
 * Four years of professional work, the first of which was an IT role rather
 * than a software one. The copy therefore says "professional" and never "four
 * years building software" — the narrower claim is the one that is true.
 */
export const YEARS_PROFESSIONAL = 4;

/**
 * Ruling (d). Sites built by the pipeline, and **Ryan's number to maintain** —
 * a session may correct the source note below, never the figure.
 *
 * 59 = 50 + 9, and the 50 are measured rather than remembered:
 * `docs/evidence/r1-r2-r3-live-fleet.txt`, the live-fleet sweep of
 * **2026-08-17**, fetched all fifty deployed demos at their own manifest URLs
 * and reported `demos fetched: 50/50`. The remaining nine are the earlier demo
 * hosts named in that same directory.
 *
 * It is NOT independently measurable from a clean checkout — `prospects/` and
 * `data/` are gitignored — so the evidence file is the citation, and it is
 * pinned to a date because the fleet grows. When it does, this constant and
 * that date move together or the number is no longer sourced.
 *
 * WHAT THE NUMBER IS, IN THE COPY ITSELF: builds generated, deployed and
 * tested by the pipeline — NOT signed clients. `/sites` says so in the same
 * sentence, because "59 live sites" beside an empty signed-client slot reads
 * as 59 paying clients, and the only builds this site may link are the five
 * `portfolio-*` demonstrations. The other fifty-odd are private, unsigned
 * prospect pitches. `/` avoids the bare figure entirely and points at the five
 * a reader can open.
 *
 * Ruled 2026-08-18 on PR #66's Brief, item 5.
 */
export const SITES_BUILT = 59;

/** Ruling (d). Audience built as a gaming content creator. */
export const TIKTOK_FOLLOWERS = '23.2K';


/**
 * Ryan's public LinkedIn profile. `null` is a shipping state, not a broken one:
 * the footer renders the `LINKEDIN_URL` placeholder while it is null and a real
 * anchor the moment it is a string.
 *
 * Do not invent this value. `check-placeholders.mjs` reads this same export and
 * flips its expectation with it, so both states are gated and neither can be
 * half-done — a filled constant with no anchor in the built HTML fails just as
 * loudly as a dropped placeholder.
 *
 * SUPPLIED by Ryan in the founder-site-photos task prompt and filled on his
 * ruling there. Stored canonically: the URL he pasted carried `utm_source`,
 * `utm_medium` and `utm_content` from the iOS share sheet. Those describe the
 * one link he sent, not the profile's address — shipping them would tag every
 * visitor's click as having come from his phone share, forever.
 */
export const LINKEDIN_URL: string | null = 'https://www.linkedin.com/in/ryan-raghubans-10870a361';

/**
 * The hero headshot, as a public path. The FILE is what decides whether it
 * renders: drop `public/ryan.jpg` in and the next build swaps the placeholder
 * for the photo, with no code change and no config edit. See `src/assets.ts`.
 */
export const HEADSHOT_SRC = '/ryan.jpg';

/**
 * Operator-filled placeholders. Each is rendered visibly in-page by
 * `Placeholder.astro`, so an unfilled slot is impossible to miss while
 * reviewing a build, and each is enumerated in the PR body.
 * `scripts/check-placeholders.mjs` asserts the built output still carries the
 * tokens it expects, so a placeholder cannot be silently dropped instead of
 * filled.
 */
export const PLACEHOLDERS = {
  photo: 'PHOTO_HERE',
  demoLink: 'DEMO_LINK',
  caseStudy: 'CASE_STUDY',
  linkedin: 'LINKEDIN_URL',
} as const;

export interface NavItem {
  href: string;
  label: string;
}

/**
 * The whole site, on every page, in both chromes.
 *
 * `Home` is a text link rather than only the wordmark because /amenity's
 * wordmark is the AMENITY BRAND, not Ryan's name — so on that page the wordmark
 * points at /amenity and there would otherwise be nothing pointing home. It is
 * mildly redundant on the founder pages and that is the cheaper half of the
 * trade: one duplicate link beats one stranded page.
 *
 * Labels are short on purpose. Five items have to wrap onto a second row at
 * 320px without becoming a third; `check-textfit.mjs` is what decides whether
 * they do, and `check-live.mjs` asserts the resulting reachability.
 */
export const NAV: readonly NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/sites', label: 'Sites' },
  { href: '/amenity', label: AMENITY_SHORT },
  { href: '/ai', label: 'AI' },
  { href: '/about', label: 'About' },
];

export interface PageMeta {
  /** Full <title>. Written per page; never templated from a pattern. */
  title: string;
  description: string;
  /** Path as it appears in the canonical URL, without a trailing slash. */
  path: string;
  /** Filename under /og/. */
  ogImage: string;
}

/**
 * One entry per route. `check-metadata.mjs` walks the built HTML and asserts
 * every emitted page has a matching entry with a non-empty, unique title and
 * description, so adding a page without writing its metadata fails the build.
 */
/**
 * Titles are held to 70 characters and descriptions to 70–165, measured on
 * DECODED text, because both budgets are about what a search result renders
 * rather than what the file contains. `check-metadata.mjs` enforces both, plus
 * uniqueness — a shared description across pages is the failure this is really
 * guarding against.
 *
 * Note that the region is spelled "Bergen County" and not `${REGION}` in prose
 * positions: "Bergen County, NJ businesses" does not read like English.
 */
export const PAGES = {
  home: {
    title: `${FULL_NAME} — Full-Stack Developer & Founder in ${REGION}`,
    description: `${FULL_NAME} is a full-stack developer and founder in ${REGION} — fast websites for local businesses, AI voice agents, and curated smart markets.`,
    path: '/',
    ogImage: 'home.png',
  },
  sites: {
    title: `Bergen County Web Developer for Small Business — ${FULL_NAME}`,
    description:
      `site-factory is Bergen County web developer work for local businesses — a pipeline that has generated, deployed and tested ${SITES_BUILT} site builds, five live to open now.`,
    path: '/sites',
    ogImage: 'sites.png',
  },
  ai: {
    title: `AI Voice Agents for Small Business — ${FULL_NAME}`,
    description: `AI voice agents that answer the calls a small business misses — booking, triage and after-hours reception, on the phone number you already advertise.`,
    path: '/ai',
    ogImage: 'ai.png',
  },
  amenity: {
    title: `${AMENITY_BRAND} — Curated Smart Markets for Luxury Buildings`,
    description: `${AMENITY_BRAND} installs and operates curated smart markets in luxury residential buildings — at zero cost and zero work for the building.`,
    path: '/amenity',
    ogImage: 'amenity.png',
  },
  about: {
    title: `About ${FULL_NAME} — Developer, Founder, ${REGION}`,
    description: `How ${FULL_NAME} got here: remote warehouse software at CED, Prudential before it, a stretch in competitive gaming, and the ventures he runs now.`,
    path: '/about',
    ogImage: 'about.png',
  },
} as const satisfies Record<string, PageMeta>;
