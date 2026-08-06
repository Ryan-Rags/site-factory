import type { LighthouseOutcome } from "./lighthouse.js";
import type { BrokenLinkReport } from "./network.js";
import type { PageProbe } from "./probe.js";
import type { CheckResult, CheckStatus } from "./types.js";

/** Everything one audited site produced. Checks are pure functions over it. */
export interface SiteEvidence {
  probe: PageProbe;
  lighthouse: LighthouseOutcome;
  links: BrokenLinkReport | undefined;
  /** Result of the /favicon.ico probe, when the page had no icon tag. */
  faviconFallback: boolean | undefined;
  now: Date;
}

interface Verdict {
  status: CheckStatus;
  evidence: string;
  plain?: string;
}

interface CheckSpec {
  id: string;
  label: string;
  weight: number;
  evaluate(evidence: SiteEvidence): Verdict;
}

const PAGE_WEIGHT_BUDGET_BYTES = 3_000_000;
const DEAD_SOCIAL =
  /(plus\.google\.com|googleplus|vine\.co|myspace\.com|friendfeed)/i;

function bytesToMb(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

function lighthouseCheck(
  id: string,
  label: string,
  category: "performance" | "accessibility" | "best-practices" | "seo",
  threshold: number,
  weight: number,
  plain: (score: number) => string,
): CheckSpec {
  return {
    id,
    label,
    weight,
    evaluate({ lighthouse }) {
      if (!lighthouse.scores) {
        return {
          status: "unavailable",
          evidence: lighthouse.error || "Lighthouse did not run.",
        };
      }
      const score = lighthouse.scores[category];
      if (score === undefined) {
        return { status: "unavailable", evidence: "Lighthouse returned no score." };
      }
      return score >= threshold
        ? { status: "pass", evidence: `${score}/100` }
        : { status: "fail", evidence: `${score}/100 (target ${threshold})`, plain: plain(score) };
    },
  };
}

const SPECS: CheckSpec[] = [
  {
    id: "https",
    label: "HTTPS",
    weight: 10,
    evaluate({ probe }) {
      if (probe.tlsError) {
        return {
          status: "fail",
          evidence: probe.tlsError.slice(0, 160),
          plain: "The site's security certificate is not valid, so browsers show visitors a warning before the page loads.",
        };
      }
      return probe.isHttps
        ? { status: "pass", evidence: probe.finalUrl }
        : {
            status: "fail",
            evidence: `Final URL is ${probe.finalUrl || probe.requestedUrl}`,
            plain: "The site is served over an insecure connection, so browsers label it 'Not secure' in the address bar.",
          };
    },
  },
  {
    id: "redirects",
    label: "Redirect chain",
    weight: 3,
    evaluate({ probe }) {
      const hops = probe.redirectChain.length;
      if (hops <= 1) return { status: "pass", evidence: `${hops} redirect(s)` };
      return {
        status: "fail",
        evidence: `${hops} redirects: ${probe.redirectChain.join(" -> ")}`.slice(0, 200),
        plain: `Visitors are bounced through ${hops} redirects before the page appears, which slows down the first load.`,
      };
    },
  },
  {
    id: "viewport-meta",
    label: "Viewport meta tag",
    weight: 10,
    evaluate({ probe }) {
      return probe.hasViewportMeta
        ? { status: "pass", evidence: probe.viewportContent || "present" }
        : {
            status: "fail",
            evidence: "No <meta name=viewport>",
            plain: "The page has no mobile viewport setting, so phones render the desktop layout shrunk down and the text is unreadable without pinching.",
          };
    },
  },
  {
    id: "no-horizontal-scroll",
    label: "No sideways scroll at 390px",
    weight: 10,
    evaluate({ probe }) {
      if (probe.horizontalOverflowPx === undefined) {
        return { status: "unavailable", evidence: "Mobile render did not complete." };
      }
      return probe.horizontalOverflowPx <= 2
        ? { status: "pass", evidence: "no overflow" }
        : {
            status: "fail",
            evidence: `${probe.horizontalOverflowPx}px wider than the screen`,
            plain: `On a phone the page is ${probe.horizontalOverflowPx} pixels wider than the screen, so visitors have to scroll sideways to read it.`,
          };
    },
  },
  lighthouseCheck(
    "lh-performance",
    "Lighthouse performance",
    "performance",
    50,
    10,
    (score) =>
      `The page scores ${score} out of 100 for speed on a mid-range phone, which means visitors on mobile data wait noticeably before anything appears.`,
  ),
  lighthouseCheck(
    "lh-accessibility",
    "Lighthouse accessibility",
    "accessibility",
    80,
    6,
    (score) =>
      `The page scores ${score} out of 100 for accessibility, so some visitors — including anyone using a screen reader — will struggle to use it.`,
  ),
  lighthouseCheck(
    "lh-best-practices",
    "Lighthouse best practices",
    "best-practices",
    80,
    4,
    (score) =>
      `The page scores ${score} out of 100 on general web best practices, which usually points at outdated or insecure page components.`,
  ),
  lighthouseCheck(
    "lh-seo",
    "Lighthouse SEO",
    "seo",
    80,
    8,
    (score) =>
      `The page scores ${score} out of 100 on basic search-engine setup, so it is harder to find in search than it should be.`,
  ),
  {
    id: "page-weight",
    label: "Page weight",
    weight: 6,
    evaluate({ probe }) {
      if (probe.transferBytes === undefined) {
        return { status: "unavailable", evidence: "Transfer size not measured." };
      }
      return probe.transferBytes <= PAGE_WEIGHT_BUDGET_BYTES
        ? { status: "pass", evidence: bytesToMb(probe.transferBytes) }
        : {
            status: "fail",
            evidence: `${bytesToMb(probe.transferBytes)} over ${probe.requestCount} requests`,
            plain: `The home page downloads ${bytesToMb(probe.transferBytes)} every visit, which is slow and expensive on a phone.`,
          };
    },
  },
  {
    id: "broken-links",
    label: "Broken links",
    weight: 5,
    evaluate({ links }) {
      if (!links || links.inconclusive) {
        return { status: "unavailable", evidence: "Link targets could not be probed." };
      }
      if (links.checked === 0) {
        return { status: "unavailable", evidence: "No same-site links found to probe." };
      }
      return links.broken.length === 0
        ? { status: "pass", evidence: `${links.checked} link(s) probed, all reachable` }
        : {
            status: "fail",
            evidence: links.broken
              .map((b) => `${b.url} -> ${b.status ?? b.error}`)
              .join("; ")
              .slice(0, 200),
            plain: `${links.broken.length} of the ${links.checked} links checked lead to a page that no longer loads.`,
          };
    },
  },
  {
    id: "phone-above-fold",
    label: "Phone number above the fold",
    weight: 8,
    evaluate({ probe }) {
      if (probe.phoneAboveFold === undefined) {
        return { status: "unavailable", evidence: "Mobile render did not complete." };
      }
      return probe.phoneAboveFold
        ? { status: "pass", evidence: "visible without scrolling" }
        : {
            status: "fail",
            evidence: probe.hasTelLink
              ? "tel: link exists but is below the fold"
              : "no phone number visible in the first screen",
            plain: "On a phone, the business's number is not visible until the visitor scrolls, so the easiest way to get a call is hidden.",
          };
    },
  },
  {
    id: "contact-form",
    label: "Contact form",
    weight: 8,
    evaluate({ probe }) {
      return probe.hasContactForm
        ? { status: "pass", evidence: "form with contact fields found" }
        : {
            status: "fail",
            evidence: "no contact form found on the home page",
            plain: "There is no contact form, so anyone who does not want to phone has no easy way to get in touch.",
          };
    },
  },
  {
    id: "copyright-current",
    label: "Copyright year",
    weight: 4,
    evaluate({ probe, now }) {
      if (probe.copyrightYears.length === 0) {
        return { status: "unavailable", evidence: "No copyright year found." };
      }
      const latest = Math.max(...probe.copyrightYears);
      const currentYear = now.getFullYear();
      return latest >= currentYear - 1
        ? { status: "pass", evidence: String(latest) }
        : {
            status: "fail",
            evidence: `${latest} (current year is ${currentYear})`,
            plain: `The footer still reads ${latest}, which tells visitors the site has not been touched in years.`,
          };
    },
  },
  {
    id: "builder-fingerprint",
    label: "Site builder fingerprint",
    weight: 3,
    evaluate({ probe }) {
      return probe.builderHints.length === 0
        ? { status: "pass", evidence: "no builder fingerprint detected" }
        : {
            status: "fail",
            evidence: probe.builderHints.join(", "),
            plain: `The site is a stock ${probe.builderHints[0]} build, so it looks like a template rather than the business.`,
          };
    },
  },
  {
    id: "dead-social",
    label: "Dead social links",
    weight: 3,
    evaluate({ probe }) {
      const dead = probe.socialLinks.filter((link) => DEAD_SOCIAL.test(link));
      return dead.length === 0
        ? { status: "pass", evidence: `${probe.socialLinks.length} social link(s), none dead` }
        : {
            status: "fail",
            evidence: dead.join(", ").slice(0, 200),
            plain: "The page still links to a social network that no longer exists, which is a dead end for anyone who clicks it.",
          };
    },
  },
  {
    id: "localbusiness-jsonld",
    label: "LocalBusiness structured data",
    weight: 5,
    evaluate({ probe }) {
      const hasLocalBusiness = probe.jsonLdTypes.some((t) =>
        /LocalBusiness|Store|Restaurant|Dentist|Plumber|HomeAndConstructionBusiness|ProfessionalService|AutomotiveBusiness/i.test(
          t,
        ),
      );
      return hasLocalBusiness
        ? { status: "pass", evidence: probe.jsonLdTypes.join(", ") }
        : {
            status: "fail",
            evidence:
              probe.jsonLdTypes.length > 0
                ? `only: ${probe.jsonLdTypes.join(", ")}`
                : "no JSON-LD found",
            plain: "The site does not tell search engines it is a local business, so its address, hours and phone number are missing from search results.",
          };
    },
  },
  {
    id: "favicon",
    label: "Favicon",
    weight: 2,
    evaluate({ probe, faviconFallback }) {
      if (probe.hasFaviconTag) return { status: "pass", evidence: "icon link tag present" };
      if (faviconFallback === undefined) {
        return { status: "unavailable", evidence: "No icon tag; /favicon.ico could not be probed." };
      }
      return faviconFallback
        ? { status: "pass", evidence: "/favicon.ico served" }
        : {
            status: "fail",
            evidence: "no icon tag and no /favicon.ico",
            plain: "The site has no icon, so it shows as a blank page symbol in browser tabs and bookmarks.",
          };
    },
  },
];

export const CHECK_COUNT = SPECS.length;

/**
 * Evaluate every check. When the page never loaded, all checks are reported
 * `unavailable` with the load failure as evidence — nothing is inferred from
 * a site we could not see.
 */
export function runChecks(evidence: SiteEvidence): CheckResult[] {
  const unreachable = !evidence.probe.loaded;
  return SPECS.map((spec) => {
    if (unreachable) {
      return {
        id: spec.id,
        label: spec.label,
        status: "unavailable" as const,
        evidence: evidence.probe.loadError || "Site could not be loaded.",
        weight: spec.weight,
        plain: "",
      };
    }
    const verdict = spec.evaluate(evidence);
    return {
      id: spec.id,
      label: spec.label,
      status: verdict.status,
      evidence: verdict.evidence,
      weight: spec.weight,
      plain: verdict.plain ?? "",
    };
  });
}
