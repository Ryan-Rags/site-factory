/**
 * Is there a website there at all?
 *
 * A prospect's listed URL resolving to *something* is not the same as the
 * business having a site. Registrars park expired domains on sale pages,
 * marketplaces dress them up with generated copy, and a long-dead domain can
 * still answer with a holding page. Every one of those looks like a website to
 * a crawler and none of them is the business speaking.
 *
 * The demo pipeline used to treat all of it as fact. Wortmann Machine Works —
 * a real Teterboro machine shop — got a demo whose services were
 * "WortmannMachineWorks.com" and "Why WortmannMachineWorks.com is worth it",
 * and a green-and-purple palette lifted from a marketplace logo, because their
 * listed domain had lapsed onto an ExpiredDomains sale page. Nothing on that
 * page was about the machine shop. That is the failure this module exists to
 * stop, and Wortmann is its regression fixture.
 *
 * ## Why this is a pure function
 *
 * Everything below reads a plain {@link SiteSignals} object and returns a
 * verdict. No browser, no network, no filesystem. That is what lets the
 * regression test be *committed*: the fixture is a hand-written signals object
 * reproducing the shape of a parking page, not a copy of anyone's site.
 * CLAUDE.md forbids committing third-party business data, so a test that
 * needed a saved copy of Wortmann's page could not exist.
 */

import type { WebsiteStatus } from "../types.js";

export type { WebsiteStatus };

/** Which rule fired. Kept distinct from the prose so tests assert on it. */
export type WebsiteRule =
  | "no-url"
  | "unreachable"
  | "http-error"
  | "parking-host"
  | "meta-refresh-offsite"
  | "for-sale-text"
  | "marketplace-name"
  | "no-content"
  | "live";

export interface WebsiteClassification {
  status: WebsiteStatus;
  rule: WebsiteRule;
  /** Plain words, for `websiteStatus.note` and the run report. */
  reason: string;
}

/**
 * What the browser collected from the home page.
 *
 * Deliberately dumb data, in the same spirit as `readPage`: the page yields
 * observations and every judgement happens here, in Node, where it can be read
 * and argued with.
 */
export interface SiteSignals {
  /** The URL we asked for. */
  requestedUrl: string;
  /** Where the browser ended up, after redirects. */
  finalUrl: string;
  /** HTTP status, or `null` when the navigation failed outright. */
  httpStatus: number | null;
  title: string;
  /** Visible body text, whitespace-collapsed. */
  bodyText: string;
  /**
   * Words of prose outside nav, header and footer.
   *
   * Counted rather than measured in characters because a parking page's whole
   * tell is that it has almost nothing to say — one headline, one button, and
   * a legal footer.
   */
  contentWords: number;
  /** `<meta http-equiv="refresh">` target, resolved absolute, when present. */
  metaRefreshUrl?: string;
  /** A `tel:` or `mailto:` link anywhere on the page. */
  hasContactLink: boolean;
  /** `LocalBusiness`/`Organization` JSON-LD is present. */
  hasBusinessJsonLd: boolean;
  /** Every `name` JSON-LD gave up, whatever the type. */
  jsonLdNames: string[];
  /** `h1`–`h3` text. */
  headings: string[];
}

/**
 * Hosts that sell, park or hold domains.
 *
 * Matched as substrings of a hostname, so `ns1.sedoparking.com` hits. The list
 * is not exhaustive and cannot be — it is the cheap, certain half of the
 * check, and the text and content rules below are what catch the rest.
 */
const PARKING_HOSTS = [
  "sedoparking",
  "sedo.com",
  "afternic",
  "dan.com",
  "hugedomains",
  "expireddomains",
  "buydomains",
  "undeveloped.com",
  "bodis.com",
  "parkingcrew",
  "parklogic",
  "above.com",
  "domainmarket",
  "brandbucket",
  "squadhelp",
  "namecheap.com/domains/registration",
  "cashparking",
  "domaincntrol",
  "parked.com",
  "parkpage",
  "domainsponsor",
];

/**
 * Text that only appears when a domain, rather than a business, is the
 * product. Each phrase is one somebody would have to write on purpose.
 */
const FOR_SALE_TEXT = [
  /\b(this )?domain (name )?(is|may be) for sale\b/i,
  /\bbuy this domain\b/i,
  /\bthe domain .{1,60} is for sale\b/i,
  /\binquire about this domain\b/i,
  /\bmake an offer\b.{0,40}\bdomain\b/i,
  /\bdomain (is )?parked\b/i,
  /\bparked (free )?(courtesy|by)\b/i,
  /\bthis (web ?site|page) is parked\b/i,
  /\bexpired domain\b/i,
  /\bthe owner of this domain\b/i,
  /\bget this domain\b/i,
  /\bcheck out these related (searches|links)\b/i,
];

/**
 * Headline shapes used by domain marketplaces, which generate a page *per
 * domain* and therefore read as though they were about the business.
 *
 * `Why WortmannMachineWorks.com is worth it` is the exact heading that became
 * a service on a machine shop's demo site.
 */
const SALE_HEADINGS = [
  /^why\s+\S+\.[a-z]{2,}\s+is worth it$/i,
  /^\S+\.[a-z]{2,}\s+is for sale$/i,
  /^(buy|own)\s+\S+\.[a-z]{2,}$/i,
  /^\S+\.[a-z]{2,}$/i,
];

/** Names a marketplace gives itself in its own structured data. */
const MARKETPLACE_NAME =
  /\b(expireddomains|sedo|afternic|hugedomains|dan\.com|buydomains|domain ?market|brandbucket|squadhelp|godaddy|namecheap|domain broker|parking ?crew)\b/i;

/**
 * Below this many words of prose, with no way to contact anyone and no
 * business structured data, there is nothing on the page that could be a fact
 * about a business — whatever it is, it is not a website.
 *
 * Forty is deliberately low. A thin one-page site for a real shop clears it
 * easily once its address and a sentence about the work are counted, and the
 * two supporting conditions mean a terse-but-real site with a phone number is
 * never caught by this rule alone.
 */
export const MIN_CONTENT_WORDS = 40;

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
};

const registrableish = (host: string): string => host.replace(/^www\./, "");

function parkingHostIn(url: string): string | undefined {
  const lowered = url.toLowerCase();
  return PARKING_HOSTS.find((h) => lowered.includes(h));
}

/**
 * Classify one site from its home page.
 *
 * Rules run most-certain first, and the first one to fire wins, so the reason
 * a site was rejected is always the strongest evidence against it rather than
 * whichever check happened to be last.
 */
export function classifyWebsite(signals: SiteSignals | null): WebsiteClassification {
  if (signals === null || signals.requestedUrl.trim() === "") {
    return {
      status: "none",
      rule: "no-url",
      reason: "no source supplied a website address",
    };
  }

  const { requestedUrl, finalUrl, httpStatus } = signals;

  if (httpStatus === null) {
    return {
      status: "dead",
      rule: "unreachable",
      reason: `${requestedUrl} could not be reached — the domain does not resolve, or the server did not answer`,
    };
  }
  if (httpStatus >= 400) {
    return {
      status: "dead",
      rule: "http-error",
      reason: `${requestedUrl} answered HTTP ${httpStatus}`,
    };
  }

  const parkingHost =
    parkingHostIn(finalUrl) ??
    (signals.metaRefreshUrl !== undefined ? parkingHostIn(signals.metaRefreshUrl) : undefined);
  if (parkingHost !== undefined) {
    return {
      status: "parked",
      rule: "parking-host",
      reason: `the domain resolves to a parking or domain-sale host (${parkingHost})`,
    };
  }

  if (signals.metaRefreshUrl !== undefined) {
    const from = registrableish(hostOf(requestedUrl));
    const to = registrableish(hostOf(signals.metaRefreshUrl));
    if (to !== "" && to !== from) {
      return {
        status: "parked",
        rule: "meta-refresh-offsite",
        reason: `the page immediately redirects off the domain to ${to}, which is what a holding page does`,
      };
    }
  }

  const haystack = `${signals.title}\n${signals.bodyText}`;
  const sale = FOR_SALE_TEXT.find((p) => p.test(haystack));
  if (sale !== undefined) {
    return {
      status: "parked",
      rule: "for-sale-text",
      reason: `the page offers the domain for sale rather than describing a business (matched ${String(sale)})`,
    };
  }

  const marketplace = signals.jsonLdNames.find((n) => MARKETPLACE_NAME.test(n));
  if (marketplace !== undefined) {
    return {
      status: "parked",
      rule: "marketplace-name",
      reason: `the page's own structured data names a domain marketplace ("${marketplace}"), not the business`,
    };
  }

  // A marketplace headline plus nothing to contact. Either alone is weak — a
  // real site can have a heading that is just its domain — so both are
  // required before this fires.
  const saleHeading = signals.headings.find((h) => SALE_HEADINGS.some((p) => p.test(h.trim())));
  if (saleHeading !== undefined && !signals.hasContactLink && !signals.hasBusinessJsonLd) {
    return {
      status: "parked",
      rule: "for-sale-text",
      reason: `the page is headed "${saleHeading}" and offers no way to contact anyone — a domain listing, not a business`,
    };
  }

  if (
    signals.contentWords < MIN_CONTENT_WORDS &&
    !signals.hasContactLink &&
    !signals.hasBusinessJsonLd
  ) {
    return {
      status: "parked",
      rule: "no-content",
      reason: `the page carries ${signals.contentWords} words of content, no phone or email link and no business structured data — there is nothing on it about a business`,
    };
  }

  return {
    status: "live",
    rule: "live",
    reason: `${finalUrl} is the business's own site`,
  };
}

/** True when nothing on the page may be read as a fact about the business. */
export function isUsableSite(status: WebsiteStatus): boolean {
  return status === "live";
}
