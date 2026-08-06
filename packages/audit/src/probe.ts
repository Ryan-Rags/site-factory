import { mkdirSync } from "node:fs";
import { join, relative } from "node:path";

import { hostOf, repoRoot } from "@site-factory/discover";
import type { Browser } from "playwright";

import type { NavigationBudget } from "./throttle.js";

const DESKTOP = { width: 1440, height: 900 } as const;
const MOBILE = { width: 390, height: 844 } as const;
const NAV_TIMEOUT_MS = 30_000;

/** Everything one visit can tell us. Checks are pure functions over this. */
export interface PageProbe {
  requestedUrl: string;
  finalUrl: string;
  host: string;
  /** False when the page could not be loaded; every check is then unavailable. */
  loaded: boolean;
  loadError: string;

  httpStatus: number | undefined;
  redirectChain: string[];
  isHttps: boolean;
  /** Set when the failure was specifically a TLS/certificate problem. */
  tlsError: string;

  hasViewportMeta: boolean;
  viewportContent: string;
  /** Overflow beyond the 390px viewport, in CSS pixels. */
  horizontalOverflowPx: number | undefined;

  transferBytes: number | undefined;
  requestCount: number;

  phoneAboveFold: boolean | undefined;
  hasTelLink: boolean;
  hasContactForm: boolean;

  copyrightYears: number[];
  generatorMeta: string;
  builderHints: string[];

  sameHostLinks: string[];
  socialLinks: string[];
  jsonLdTypes: string[];
  hasFaviconTag: boolean;

  headings: string[];
  title: string;

  screenshotDesktop: string;
  screenshotMobile: string;
}

function emptyProbe(requestedUrl: string, host: string): PageProbe {
  return {
    requestedUrl,
    finalUrl: "",
    host,
    loaded: false,
    loadError: "",
    httpStatus: undefined,
    redirectChain: [],
    isHttps: requestedUrl.toLowerCase().startsWith("https://"),
    tlsError: "",
    hasViewportMeta: false,
    viewportContent: "",
    horizontalOverflowPx: undefined,
    transferBytes: undefined,
    requestCount: 0,
    phoneAboveFold: undefined,
    hasTelLink: false,
    hasContactForm: false,
    copyrightYears: [],
    generatorMeta: "",
    builderHints: [],
    sameHostLinks: [],
    socialLinks: [],
    jsonLdTypes: [],
    hasFaviconTag: false,
    headings: [],
    title: "",
    screenshotDesktop: "",
    screenshotMobile: "",
  };
}

const TLS_HINT = /(ERR_CERT|ERR_SSL|CERT_|SSL_ERROR|certificate)/i;
const ANSI = new RegExp("\\u001B\\[[0-9;]*m", "g");

/**
 * Playwright errors carry a multi-line call log and ANSI colour codes. Only
 * the first line is the reason, and this text ends up in reports and skip
 * logs, so reduce it to something readable.
 */
function conciseError(message: string): string {
  const firstLine = message.replace(ANSI, "").split("\n")[0] ?? message;
  return firstLine.trim().slice(0, 200);
}

/** Data collected inside the page. Kept serialisable — it crosses the CDP boundary. */
interface DomFacts {
  finalUrl: string;
  title: string;
  hasViewportMeta: boolean;
  viewportContent: string;
  hasTelLink: boolean;
  hasContactForm: boolean;
  copyrightYears: number[];
  generatorMeta: string;
  builderHints: string[];
  links: string[];
  jsonLdTypes: string[];
  hasFaviconTag: boolean;
  headings: string[];
}

/* eslint-disable no-undef -- body runs in the browser */
function collectDomFacts(): DomFacts {
  const text = document.body?.innerText ?? "";

  const years = new Set<number>();
  const yearPattern = /(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–—]\s*)?(\d{4})/gi;
  let match: RegExpExecArray | null = yearPattern.exec(text);
  while (match !== null) {
    const year = Number(match[1]);
    if (year >= 1990 && year <= 2100) years.add(year);
    match = yearPattern.exec(text);
  }

  const generator =
    document.querySelector('meta[name="generator"]')?.getAttribute("content") ?? "";

  const html = document.documentElement.outerHTML;
  const hints: string[] = [];
  const fingerprints: Array<[string, RegExp]> = [
    ["Wix", /(static\.wixstatic\.com|X-Wix-|wixsite\.com)/i],
    ["GoDaddy Website Builder", /(img1\.wsimg\.com|godaddysites\.com)/i],
    ["Squarespace", /(squarespace\.com|static1\.squarespace)/i],
    ["Weebly", /(weebly\.com|editmysite\.com)/i],
    ["WordPress", /(wp-content|wp-includes)/i],
  ];
  for (const [name, pattern] of fingerprints) {
    if (pattern.test(html) || pattern.test(generator)) hints.push(name);
  }
  const wpVersion = /WordPress\s+(\d+\.\d+(?:\.\d+)?)/i.exec(generator);
  if (wpVersion) hints.push(`WordPress version exposed: ${wpVersion[1]}`);

  const anchors = Array.from(document.querySelectorAll("a[href]"));
  const links: string[] = [];
  for (const a of anchors) {
    const href = a.getAttribute("href") ?? "";
    if (!href || href.startsWith("#") || /^(javascript|mailto|tel):/i.test(href)) continue;
    try {
      links.push(new URL(href, document.baseURI).toString());
    } catch {
      /* unparseable href — not evidence of anything */
    }
  }

  const jsonLdTypes: string[] = [];
  for (const node of Array.from(
    document.querySelectorAll('script[type="application/ld+json"]'),
  )) {
    try {
      const parsed: unknown = JSON.parse(node.textContent ?? "");
      const stack: unknown[] = [parsed];
      while (stack.length > 0) {
        const item = stack.pop();
        if (Array.isArray(item)) {
          stack.push(...item);
        } else if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const type = record["@type"];
          if (typeof type === "string") jsonLdTypes.push(type);
          else if (Array.isArray(type)) {
            for (const t of type) if (typeof t === "string") jsonLdTypes.push(t);
          }
          if (Array.isArray(record["@graph"])) stack.push(...record["@graph"]);
        }
      }
    } catch {
      /* malformed JSON-LD is reported by the check, not here */
    }
  }

  const forms = Array.from(document.querySelectorAll("form"));
  const hasContactForm = forms.some((form) => {
    const fields = form.querySelectorAll(
      'textarea, input[type="email"], input[name*="mail" i], input[name*="message" i], input[name*="phone" i], input[name*="name" i]',
    );
    return fields.length >= 1;
  });

  const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
    .map((h) => (h.textContent ?? "").replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 2 && t.length <= 80);

  return {
    finalUrl: location.href,
    title: document.title ?? "",
    hasViewportMeta: document.querySelector('meta[name="viewport"]') !== null,
    viewportContent:
      document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "",
    hasTelLink: document.querySelector('a[href^="tel:"]') !== null,
    hasContactForm,
    copyrightYears: Array.from(years),
    generatorMeta: generator,
    builderHints: hints,
    links,
    jsonLdTypes,
    hasFaviconTag: document.querySelector('link[rel~="icon" i]') !== null,
    headings,
  };
}

/** Overflow and above-the-fold phone visibility, measured at the mobile size. */
function collectMobileFacts(): { overflowPx: number; phoneAboveFold: boolean } {
  const doc = document.documentElement;
  const overflowPx = Math.max(0, doc.scrollWidth - doc.clientWidth);

  const foldY = window.innerHeight;
  const phonePattern = /(\+?\d[\d\s().-]{7,}\d)/;
  let phoneAboveFold = false;

  const candidates = Array.from(
    document.querySelectorAll('a[href^="tel:"], header, [class*="phone" i], [class*="contact" i]'),
  );
  for (const el of candidates) {
    const isTel = el.matches('a[href^="tel:"]');
    if (!isTel && !phonePattern.test(el.textContent ?? "")) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < foldY) {
      phoneAboveFold = true;
      break;
    }
  }
  return { overflowPx, phoneAboveFold };
}
/* eslint-enable no-undef */

const SOCIAL_HOSTS =
  /(facebook\.com|instagram\.com|twitter\.com|x\.com|linkedin\.com|youtube\.com|tiktok\.com|plus\.google\.com|googleplus|vine\.co|myspace\.com|foursquare\.com)/i;

export interface ProbeOptions {
  browser: Browser;
  url: string;
  slug: string;
  budget: NavigationBudget;
  outDir: string;
}

/**
 * One site visit: desktop load plus a mobile re-render. Read-only GETs only.
 * Failure to load is returned as a probe with `loaded: false` rather than
 * thrown, because "we could not reach it" is a legitimate audit outcome.
 */
export async function probeSite(opts: ProbeOptions): Promise<PageProbe> {
  const host = hostOf(opts.url);
  if (!host) {
    const probe = emptyProbe(opts.url, "");
    probe.loadError = `Could not parse a hostname from ${opts.url || "(empty url)"}`;
    return probe;
  }

  const probe = emptyProbe(opts.url, host);
  const siteOutDir = join(opts.outDir, opts.slug);
  mkdirSync(siteOutDir, { recursive: true });

  const context = await opts.browser.newContext({
    viewport: { ...DESKTOP },
    ignoreHTTPSErrors: false,
  });
  let transferBytes = 0;
  let requestCount = 0;

  try {
    const page = await context.newPage();
    page.on("response", (response) => {
      requestCount += 1;
      void response
        .request()
        .sizes()
        .then((sizes) => {
          transferBytes += sizes.responseBodySize + sizes.responseHeadersSize;
        })
        .catch(() => {
          /* size unavailable for this request; page weight stays approximate */
        });
    });

    await opts.budget.acquire(host);
    const response = await page.goto(opts.url, {
      waitUntil: "load",
      timeout: NAV_TIMEOUT_MS,
    });

    probe.loaded = true;
    probe.httpStatus = response?.status();

    // Walk the redirect chain back from the final request.
    const chain: string[] = [];
    let request = response?.request().redirectedFrom() ?? null;
    while (request) {
      chain.unshift(request.url());
      request = request.redirectedFrom();
    }
    probe.redirectChain = chain;

    const facts = await page.evaluate(collectDomFacts);
    probe.finalUrl = facts.finalUrl;
    probe.isHttps = facts.finalUrl.toLowerCase().startsWith("https://");
    probe.title = facts.title;
    probe.hasViewportMeta = facts.hasViewportMeta;
    probe.viewportContent = facts.viewportContent;
    probe.hasTelLink = facts.hasTelLink;
    probe.hasContactForm = facts.hasContactForm;
    probe.copyrightYears = facts.copyrightYears;
    probe.generatorMeta = facts.generatorMeta;
    probe.builderHints = facts.builderHints;
    probe.jsonLdTypes = facts.jsonLdTypes;
    probe.hasFaviconTag = facts.hasFaviconTag;
    probe.headings = facts.headings;

    probe.sameHostLinks = Array.from(
      new Set(facts.links.filter((link) => hostOf(link) === host)),
    );
    probe.socialLinks = Array.from(
      new Set(facts.links.filter((link) => SOCIAL_HOSTS.test(link))),
    );

    const desktopPath = join(siteOutDir, "desktop.png");
    await page.screenshot({ path: desktopPath, fullPage: true });
    probe.screenshotDesktop = relative(repoRoot, desktopPath).split("\\").join("/");

    await page.close();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    probe.loaded = false;
    probe.loadError = conciseError(message);
    if (TLS_HINT.test(message)) probe.tlsError = conciseError(message);
  } finally {
    // Response size promises settle after load; read the totals we have.
    probe.transferBytes = probe.loaded ? transferBytes : undefined;
    probe.requestCount = requestCount;
    await context.close();
  }

  if (!probe.loaded) return probe;

  // Second navigation: the same page at a phone viewport.
  const mobileContext = await opts.browser.newContext({
    viewport: { ...MOBILE },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  try {
    const page = await mobileContext.newPage();
    await opts.budget.acquire(host);
    await page.goto(probe.finalUrl || opts.url, {
      waitUntil: "load",
      timeout: NAV_TIMEOUT_MS,
    });

    const mobile = await page.evaluate(collectMobileFacts);
    probe.horizontalOverflowPx = mobile.overflowPx;
    probe.phoneAboveFold = mobile.phoneAboveFold;

    const mobilePath = join(siteOutDir, "mobile.png");
    await page.screenshot({ path: mobilePath, fullPage: true });
    probe.screenshotMobile = relative(repoRoot, mobilePath).split("\\").join("/");

    await page.close();
  } catch {
    // Desktop data stands; the mobile-only checks report unavailable.
    probe.horizontalOverflowPx = undefined;
    probe.phoneAboveFold = undefined;
  } finally {
    await mobileContext.close();
  }

  return probe;
}
