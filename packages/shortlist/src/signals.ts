import type { Browser } from "playwright";

import { classifyWebsite, type SiteSignals } from "@site-factory/prospect";
import type { NavigationBudget } from "@site-factory/audit";

import type { CheapSignals, StatusOutcome } from "./types.js";

/**
 * Is there a website there at all — at county scale.
 *
 * ## Why this reader exists rather than reusing prospect's
 *
 * The *judgement* is not duplicated: `classifyWebsite` is imported from
 * `packages/prospect` and every parking-host, for-sale-text and content
 * threshold rule stays in that one implementation. Only the "load one page and
 * read the DOM" step is written here.
 *
 * It has to be. `packages/prospect`'s `readPage` is not exported, and the
 * function wrapped around it — `ingestWebsite` — spends up to five navigations
 * per site harvesting name, phone, address, hours, services and a logo for
 * palette extraction. None of that is wanted here. This pass answers one
 * question about several hundred businesses and then throws the page away, so
 * it takes **one** navigation and collects only what the classifier reads,
 * plus the handful of cheap signals audit ordering needs.
 *
 * Rate limits are CLAUDE.md's: one navigation per second per domain, ten per
 * site, enforced by the same `NavigationBudget` the audit uses. One is spent
 * here, leaving nine.
 */

const NAV_TIMEOUT_MS = 20_000;

/** Identify honestly. A crawler that hides what it is has no business here. */
const USER_AGENT =
  "Mozilla/5.0 (compatible; site-factory-shortlist/0.1; read-only lead research; 1 page/sec)";

interface PageRead {
  signals: SiteSignals;
  cheap: CheapSignals;
}

/**
 * One read-only GET, and everything both consumers need from it.
 *
 * The page evaluation is deliberately dumb — it returns observations, and
 * every judgement happens in Node where it can be read and argued with. That
 * is the same split `packages/prospect` uses, and keeping it means the signals
 * object handed to `classifyWebsite` is shaped exactly as that module documents.
 */
async function readHomePage(
  browser: Browser,
  url: string,
  budget: NavigationBudget,
  host: string,
): Promise<PageRead | null> {
  await budget.acquire(host);

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: USER_AGENT,
  });
  const page = await context.newPage();
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
    if (!response) return null;

    const collected = await page.evaluate(() => {
      const attr = (sel: string, name: string): string =>
        document.querySelector(sel)?.getAttribute(name) ?? "";

      const hasContactLink =
        document.querySelector('a[href^="tel:"], a[href^="mailto:"]') !== null;

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
        if (typeof obj["name"] === "string" && obj["name"].trim() !== "") {
          jsonLdNames.push(obj["name"]);
        }
        if (
          typeof obj["@type"] === "string" &&
          /business|organization|store|shop|company/i.test(obj["@type"])
        ) {
          hasBusinessJsonLd = true;
        }
      };
      for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          visit(JSON.parse(script.textContent ?? ""));
        } catch {
          /* malformed JSON-LD is common and not worth failing over */
        }
      }

      // Prose with the furniture removed. Nav, header and footer are on every
      // page of every site including the emptiest holding page, so counting
      // them would make "has content" meaningless. Matches prospect's reader,
      // because the classifier's threshold was calibrated against that count.
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

      const headings = [...document.querySelectorAll("h1, h2, h3")]
        .map((h) => (h.textContent ?? "").trim())
        .filter((t) => t.length > 2 && t.length < 80)
        .slice(0, 40);

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

      return {
        title: document.title.trim(),
        description: attr('meta[name="description"]', "content"),
        hasViewportMeta: document.querySelector('meta[name="viewport"]') !== null,
        bodyText: (body?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 20_000),
        contentWords,
        hasContactLink,
        hasBusinessJsonLd,
        jsonLdNames: jsonLdNames.slice(0, 20),
        headings,
        metaRefreshUrl,
      };
    });

    const finalUrl = page.url();
    const signals: SiteSignals = {
      requestedUrl: url,
      finalUrl,
      httpStatus: response.status(),
      title: collected.title,
      bodyText: collected.bodyText,
      contentWords: collected.contentWords,
      hasContactLink: collected.hasContactLink,
      hasBusinessJsonLd: collected.hasBusinessJsonLd,
      jsonLdNames: collected.jsonLdNames,
      headings: collected.headings,
    };
    if (collected.metaRefreshUrl !== undefined) signals.metaRefreshUrl = collected.metaRefreshUrl;

    const cheap: CheapSignals = {
      insecure: finalUrl.startsWith("http://"),
      hasViewportMeta: collected.hasViewportMeta,
      titleLength: collected.title.length,
      descriptionLength: collected.description.length,
      contentWords: collected.contentWords,
      hasContactLink: collected.hasContactLink,
      hasBusinessJsonLd: collected.hasBusinessJsonLd,
    };

    return { signals, cheap };
  } catch {
    return null;
  } finally {
    await context.close();
  }
}

/** The signals object standing for "the navigation failed outright". */
export function unreachableSignals(url: string): SiteSignals {
  return {
    requestedUrl: url,
    finalUrl: url,
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

export interface StatusOptions {
  browser: Browser;
  url: string;
  budget: NavigationBudget;
}

/**
 * Classify one business's listed website.
 *
 * An empty URL costs zero navigations and resolves to `none` through the
 * classifier's own `no-url` rule rather than a shortcut here — one code path,
 * one set of reasons.
 */
export async function websiteStatus(opts: StatusOptions): Promise<StatusOutcome> {
  const url = opts.url.trim();
  if (url === "") {
    const verdict = classifyWebsite(null);
    return { status: verdict.status, rule: verdict.rule, reason: verdict.reason };
  }

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    // A listed URL that will not parse is not a site we can reach. Recorded as
    // dead by the classifier's own rule, with no navigation spent on it.
    const verdict = classifyWebsite(unreachableSignals(url));
    return { status: verdict.status, rule: verdict.rule, reason: verdict.reason };
  }

  const read = await readHomePage(opts.browser, url, opts.budget, host);
  const verdict = classifyWebsite(read?.signals ?? unreachableSignals(url));
  return {
    status: verdict.status,
    rule: verdict.rule,
    reason: verdict.reason,
    signals: read?.cheap,
  };
}
