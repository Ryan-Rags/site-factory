import type { Browser } from "playwright";

import { slugify } from "@site-factory/discover";

import { known, type ProspectAddress, type ProspectHours, type ProspectService } from "../types.js";
import type { Contribution } from "./merge.js";
import { classifyWebsite, type SiteSignals, type WebsiteClassification } from "./parked.js";

/**
 * Read the prospect's current website.
 *
 * Read-only GETs, and rate-limited the way CLAUDE.md requires: at most one
 * page navigation per second per domain, at most ten per site. This crawler
 * takes at most five — the home page plus up to four of about/services/
 * contact — because everything it is looking for is either on the home page or
 * one click from it, and a smaller budget is a smaller imposition on someone
 * who has not agreed to be crawled.
 *
 * The home page is classified before anything is taken from it — see
 * `parked.ts`. A domain that turns out to be parked or dead contributes
 * **nothing**: no name, no phone, no address, no services, and no logo for
 * palette extraction. Not "less", not "held at lower confidence" — nothing.
 * What sits on a registrar's sale page is a fact about the registrar, and the
 * moment any of it is let through it becomes a claim published under the
 * business's own name.
 */

const MAX_NAVIGATIONS = 5;
const MIN_INTERVAL_MS = 1100;
const NAV_TIMEOUT_MS = 25_000;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** What one page gave up. Everything is optional; a page may yield nothing. */
interface PageFacts {
  title?: string;
  siteName?: string;
  description?: string;
  phones: string[];
  emails: string[];
  address?: ProspectAddress;
  hours?: ProspectHours[];
  foundedYear?: number;
  logoUrl?: string;
  headings: string[];
  navLinks: { href: string; text: string }[];
  jsonLdName?: string;

  // ---- classification signals -------------------------------------------
  // Collected on every page because it costs nothing, read only from the home
  // page. See `parked.ts` for what each one is for.
  bodyText: string;
  contentWords: number;
  metaRefreshUrl?: string;
  hasContactLink: boolean;
  hasBusinessJsonLd: boolean;
  jsonLdNames: string[];
}

/** One navigation's result: what the page said, and what the network said. */
interface PageRead {
  facts: PageFacts;
  /** After redirects. */
  finalUrl: string;
  httpStatus: number;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * Everything below runs inside the page. It is deliberately dumb: it collects
 * text and structured data and hands it back. All judgement — what counts as a
 * service, which phone number wins — happens in Node, where it can be read and
 * argued with.
 */
async function readPage(browser: Browser, url: string): Promise<PageRead | null> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    // Identify honestly. A crawler that hides what it is has no business
    // reading someone's site.
    userAgent:
      "Mozilla/5.0 (compatible; site-factory-demo/0.1; read-only prospect research; 1 page/sec)",
  });
  const page = await context.newPage();
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    // A non-OK response is *returned* rather than swallowed: an HTTP 404 or a
    // refused connection is how a dead domain announces itself, and the
    // classifier needs to see it. Callers reading a follow-up page still skip
    // anything that is not OK.
    if (!response) return null;
    const facts = await page.evaluate((dayNames) => {
      const text = (el: Element | null): string => (el?.textContent ?? "").trim();
      const attr = (sel: string, name: string): string | undefined =>
        document.querySelector(sel)?.getAttribute(name) ?? undefined;

      const phones = [...document.querySelectorAll('a[href^="tel:"]')]
        .map((a) => (a.getAttribute("href") ?? "").replace(/^tel:/, "").trim())
        .filter(Boolean);
      const emails = [...document.querySelectorAll('a[href^="mailto:"]')]
        .map((a) => (a.getAttribute("href") ?? "").replace(/^mailto:/, "").split("?")[0]?.trim() ?? "")
        .filter(Boolean);

      let address: PageFacts["address"];
      let hours: PageFacts["hours"];
      let jsonLdName: string | undefined;
      let foundedYear: number | undefined;
      let logoUrl: string | undefined;
      let hasBusinessJsonLd = false;
      const jsonLdNames: string[] = [];

      const visit = (node: unknown): void => {
        if (Array.isArray(node)) {
          for (const n of node) visit(n);
          return;
        }
        if (!node || typeof node !== "object") return;
        const obj = node as Record<string, unknown>;
        if (Array.isArray(obj["@graph"])) visit(obj["@graph"]);

        const addr = obj["address"];
        if (!address && addr && typeof addr === "object") {
          const a = addr as Record<string, unknown>;
          const locality = typeof a["addressLocality"] === "string" ? a["addressLocality"] : "";
          const region = typeof a["addressRegion"] === "string" ? a["addressRegion"] : "";
          if (locality || region) {
            address = {
              locality,
              region,
              country: typeof a["addressCountry"] === "string" ? a["addressCountry"] : "US",
            };
            if (typeof a["streetAddress"] === "string") address.street = a["streetAddress"];
            if (typeof a["postalCode"] === "string") address.postalCode = a["postalCode"];
          }
        }

        if (typeof obj["name"] === "string" && obj["name"].trim() !== "") {
          jsonLdNames.push(obj["name"]);
        }
        if (typeof obj["@type"] === "string" && /business|organization|store|shop|company/i.test(obj["@type"])) {
          hasBusinessJsonLd = true;
          if (!jsonLdName && typeof obj["name"] === "string") jsonLdName = obj["name"];
        }

        if (!foundedYear && typeof obj["foundingDate"] === "string") {
          const year = Number.parseInt(obj["foundingDate"].slice(0, 4), 10);
          if (Number.isFinite(year)) foundedYear = year;
        }

        if (!logoUrl) {
          const logo = obj["logo"];
          if (typeof logo === "string") logoUrl = logo;
          else if (logo && typeof logo === "object") {
            const url = (logo as Record<string, unknown>)["url"];
            if (typeof url === "string") logoUrl = url;
          }
        }

        const spec = obj["openingHoursSpecification"];
        if (!hours && Array.isArray(spec)) {
          const rows: NonNullable<PageFacts["hours"]> = [];
          for (const entry of spec) {
            if (!entry || typeof entry !== "object") continue;
            const e = entry as Record<string, unknown>;
            const days = Array.isArray(e["dayOfWeek"])
              ? e["dayOfWeek"]
              : typeof e["dayOfWeek"] === "string"
                ? [e["dayOfWeek"]]
                : [];
            for (const day of days) {
              if (typeof day !== "string") continue;
              const name = dayNames.find((d) => day.toLowerCase().endsWith(d.toLowerCase()));
              if (!name) continue;
              const opens = typeof e["opens"] === "string" ? e["opens"].slice(0, 5) : undefined;
              const closes = typeof e["closes"] === "string" ? e["closes"].slice(0, 5) : undefined;
              rows.push(opens && closes ? { day: name, opens, closes } : { day: name, closed: true });
            }
          }
          if (rows.length > 0) hours = rows;
        }
      };

      for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          visit(JSON.parse(script.textContent ?? ""));
        } catch {
          /* malformed JSON-LD is common and not worth failing over */
        }
      }

      if (!logoUrl) {
        const img = document.querySelector<HTMLImageElement>(
          'img[src*="logo" i], img[alt*="logo" i], img[class*="logo" i]',
        );
        if (img?.src) logoUrl = img.src;
      }

      if (!foundedYear) {
        const body = document.body?.innerText ?? "";
        const match = body.match(/\b(?:since|established|est\.?|serving\s+\w+\s+since)\s+((?:18|19|20)\d{2})\b/i);
        if (match?.[1]) foundedYear = Number.parseInt(match[1], 10);
      }

      const headings = [...document.querySelectorAll("h1, h2, h3")]
        .map((h) => text(h))
        .filter((t) => t.length > 2 && t.length < 80)
        .slice(0, 40);

      const navLinks = [...document.querySelectorAll("nav a, header a")]
        .map((a) => ({ href: (a as HTMLAnchorElement).href, text: text(a) }))
        .filter((l) => l.href.startsWith("http") && l.text.length > 0)
        .slice(0, 60);

      // Prose, with the furniture removed. Nav, header and footer are on every
      // page of every site including the emptiest holding page, so counting
      // them would make "has content" meaningless.
      const body = document.body;
      let contentWords = 0;
      if (body) {
        const clone = body.cloneNode(true) as HTMLElement;
        for (const el of clone.querySelectorAll("nav, header, footer, script, style, noscript")) {
          el.remove();
        }
        const prose = (clone.innerText ?? clone.textContent ?? "").replace(/\s+/g, " ").trim();
        contentWords = prose === "" ? 0 : prose.split(" ").length;
      }
      const bodyText = (body?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 20_000);

      // A meta refresh is how a holding page bounces a visitor to a sale
      // listing without a server-side redirect. Resolved absolute here, where
      // `location` is available, so Node does not have to guess the base.
      let metaRefreshUrl: string | undefined;
      const refresh = document
        .querySelector('meta[http-equiv="refresh" i]')
        ?.getAttribute("content");
      if (refresh) {
        const target = /url\s*=\s*['"]?([^'";]+)/i.exec(refresh)?.[1];
        if (target) {
          try {
            metaRefreshUrl = new URL(target.trim(), document.location.href).href;
          } catch {
            /* an unparseable refresh target tells us nothing */
          }
        }
      }

      const facts: PageFacts = {
        phones,
        emails,
        headings,
        navLinks,
        bodyText,
        contentWords,
        hasContactLink: phones.length > 0 || emails.length > 0,
        hasBusinessJsonLd,
        jsonLdNames: jsonLdNames.slice(0, 20),
      };
      if (metaRefreshUrl) facts.metaRefreshUrl = metaRefreshUrl;
      const title = document.title.trim();
      if (title) facts.title = title;
      const siteName = attr('meta[property="og:site_name"]', "content");
      if (siteName) facts.siteName = siteName;
      const description = attr('meta[name="description"]', "content");
      if (description) facts.description = description;
      if (address) facts.address = address;
      if (hours) facts.hours = hours;
      if (foundedYear) facts.foundedYear = foundedYear;
      if (logoUrl) facts.logoUrl = logoUrl;
      if (jsonLdName) facts.jsonLdName = jsonLdName;
      return facts;
    }, DAY_NAMES);
    return { facts, finalUrl: page.url(), httpStatus: response.status() };
  } catch {
    return null;
  } finally {
    await context.close();
  }
}

/** Assemble the classifier's input from one navigation. */
function signalsFrom(requestedUrl: string, read: PageRead | null): SiteSignals {
  if (read === null) {
    return {
      requestedUrl,
      finalUrl: requestedUrl,
      httpStatus: null,
      title: "",
      bodyText: "",
      contentWords: 0,
      hasContactLink: false,
      hasBusinessJsonLd: false,
      jsonLdNames: [],
      headings: [],
    };
  }
  const { facts } = read;
  const signals: SiteSignals = {
    requestedUrl,
    finalUrl: read.finalUrl,
    httpStatus: read.httpStatus,
    title: facts.title ?? "",
    bodyText: facts.bodyText,
    contentWords: facts.contentWords,
    hasContactLink: facts.hasContactLink,
    hasBusinessJsonLd: facts.hasBusinessJsonLd,
    jsonLdNames: facts.jsonLdNames,
    headings: facts.headings,
  };
  if (facts.metaRefreshUrl !== undefined) signals.metaRefreshUrl = facts.metaRefreshUrl;
  return signals;
}

/** Pages worth a second navigation, in priority order. */
const FOLLOW_PATTERNS = [/service/i, /about/i, /contact/i, /what.we.do/i];

export interface WebsiteIngest {
  contribution: Contribution;
  /** Absolute URL of a logo image, for palette extraction only. */
  logoUrl?: string;
  /** Pages actually navigated, for the run report. */
  visited: string[];
  /** Set when the site could not be read at all. */
  failure?: string;
  /** What is actually at that address. Never `none` here — a URL was given. */
  classification: WebsiteClassification;
}

export async function ingestWebsite(
  browser: Browser,
  siteUrl: string,
  retrievedAt: string,
): Promise<WebsiteIngest> {
  const visited: string[] = [];
  const read = await readPage(browser, siteUrl);
  visited.push(siteUrl);

  const classification = classifyWebsite(signalsFrom(siteUrl, read));

  // The gate. Everything past this line reads the page as the business
  // speaking, so nothing that is not the business gets past it — and the
  // crawler stops here rather than spending four more navigations on a
  // registrar's server.
  if (classification.status !== "live") {
    return { contribution: {}, visited, classification };
  }

  // `read` is non-null whenever the classification is `live`: a null read
  // produces `httpStatus: null`, which the classifier resolves to `dead`.
  const home = read?.facts;
  if (!home) {
    return {
      contribution: {},
      visited,
      failure: `could not load ${siteUrl}`,
      classification,
    };
  }

  const origin = new URL(siteUrl).origin;
  const follows = home.navLinks
    .filter((l) => {
      try {
        return new URL(l.href).origin === origin;
      } catch {
        return false;
      }
    })
    .filter((l) => FOLLOW_PATTERNS.some((p) => p.test(l.href) || p.test(l.text)))
    .map((l) => l.href.split("#")[0] ?? l.href);

  // Compare without a trailing slash: `https://example.com` and
  // `https://example.com/` are the page we have already loaded, and following
  // both spends one of five navigations on somebody else's server for nothing.
  const canonical = (href: string): string => href.replace(/\/+$/, "");
  const seen = new Set([canonical(siteUrl)]);
  const unique: string[] = [];
  for (const href of follows) {
    const key = canonical(href);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(href);
    if (unique.length >= MAX_NAVIGATIONS - 1) break;
  }

  const pages: PageFacts[] = [home];
  for (const href of unique) {
    await sleep(MIN_INTERVAL_MS);
    const followed = await readPage(browser, href);
    visited.push(href);
    if (followed && followed.httpStatus < 400) pages.push(followed.facts);
  }

  const contribution: Contribution = {};
  const first = <T>(pick: (p: PageFacts) => T | undefined): T | undefined => {
    for (const p of pages) {
      const value = pick(p);
      if (value !== undefined) return value;
    }
    return undefined;
  };

  const name = first((p) => p.jsonLdName) ?? first((p) => p.siteName);
  if (name) {
    contribution.businessName = known(name, "website", retrievedAt, "JSON-LD or og:site_name");
  }

  const phone = first((p) => p.phones[0]);
  if (phone) contribution.phone = known(phone, "website", retrievedAt, "tel: link on their site");

  const email = first((p) => p.emails.find((e) => !e.includes("example.")));
  if (email) contribution.email = known(email, "website", retrievedAt, "mailto: link on their site");

  const address = first((p) => p.address);
  if (address) contribution.address = known(address, "website", retrievedAt, "JSON-LD PostalAddress");

  const hours = first((p) => p.hours);
  if (hours) {
    contribution.hours = known(hours, "website", retrievedAt, "JSON-LD openingHoursSpecification");
  }

  const foundedYear = first((p) => p.foundedYear);
  if (foundedYear) {
    contribution.foundedYear = known(
      foundedYear,
      "website",
      retrievedAt,
      "stated on their own site (JSON-LD foundingDate or a 'since <year>' line)",
    );
  }

  const services = deriveServices(pages);
  if (services.length > 0) {
    contribution.services = known(
      services,
      "website",
      retrievedAt,
      "service names taken from their own navigation and headings",
    );
  }

  const logoUrl = first((p) => p.logoUrl);
  const out: WebsiteIngest = { contribution, visited, classification };
  if (logoUrl) out.logoUrl = logoUrl;
  return out;
}

/**
 * Service names from their own navigation, then their own headings.
 *
 * Only their words are used — nothing is invented and nothing is inferred from
 * the niche. A site that names no services yields none, and the projection
 * falls back to whatever higher-precedence source has them.
 */
function deriveServices(pages: PageFacts[]): ProspectService[] {
  const seen = new Set<string>();
  const out: ProspectService[] = [];

  const consider = (title: string): void => {
    const clean = title.replace(/\s+/g, " ").trim();
    if (clean.length < 3 || clean.length > 40) return;
    if (/^(home|about|contact|blog|news|gallery|services|menu|search|login)$/i.test(clean)) return;
    const slug = slugify(clean);
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    out.push({ slug, title: clean });
  };

  for (const page of pages) {
    for (const link of page.navLinks) {
      if (/service|repair|machin|weld|fabricat|install|clean|design/i.test(link.text)) {
        consider(link.text);
      }
    }
  }
  if (out.length < 2) {
    for (const page of pages) {
      for (const heading of page.headings) {
        if (/service|repair|machin|weld|fabricat|install|clean|design/i.test(heading)) {
          consider(heading);
        }
      }
    }
  }

  return out.slice(0, 6);
}
