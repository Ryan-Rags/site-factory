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

/** Founder-site chrome. /amenity is in the nav but does not wear this chrome. */
export const NAV: readonly NavItem[] = [
  { href: '/sites', label: 'Websites' },
  { href: '/ai', label: 'AI Voice' },
  { href: '/amenity', label: AMENITY_BRAND },
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
    description: `A Bergen County web developer building fast, mobile-first websites for local businesses — designed, built and measured on a real phone before they ship.`,
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
    description: `How ${FULL_NAME} got here: enterprise development at CED and Prudential, years around competitive gaming, three sports, and what he builds now.`,
    path: '/about',
    ogImage: 'about.png',
  },
} as const satisfies Record<string, PageMeta>;
