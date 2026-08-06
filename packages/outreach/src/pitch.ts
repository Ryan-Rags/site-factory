import { failedChecks, type AuditResult, type CheckResult } from "@site-factory/audit";
import { slugify } from "@site-factory/discover";

/**
 * A pitch must cite at least two confirmed findings. Below that there is not
 * enough evidence to personalise anything, and writing a pitch anyway would be
 * fabrication — those leads are skipped and logged instead (Q7).
 */
export const MIN_FINDINGS = 2;

export interface SkipReason {
  slug: string;
  name: string;
  reason: string;
}

/** Why this lead cannot be pitched, or undefined when it can. */
export function pitchBlocker(result: AuditResult): string | undefined {
  if (!result.reachable) {
    return `Site could not be loaded (${result.unreachableReason || "no reason recorded"}), so every check is unavailable and there are no findings to cite.`;
  }
  const findings = failedChecks(result);
  if (findings.length < MIN_FINDINGS) {
    return `Only ${findings.length} confirmed finding(s); ${MIN_FINDINGS} are required to personalise a pitch.`;
  }
  return undefined;
}

/**
 * Separator-insensitive comparison key, so "K-H MACHINE WORKS, INC." and
 * "KH Machine Works" resolve to the same business name.
 */
function compactKey(text: string): string {
  return slugify(text).split("-").join("");
}

/**
 * Headings that are navigation or page furniture rather than something the
 * business sells. Carrying these into a services list would misrepresent them.
 */
const NON_SERVICE_HEADING =
  /^(contact|contact us|hours|hours of operation|opening hours|about|about us|home|menu|search|news|blog|gallery|photos|testimonials|reviews|location|locations|find us|follow us|our team|team|faq|faqs|welcome|sitemap|privacy policy|terms)\b/i;

/**
 * Headings that name what the business actually does. The business's own name
 * is dropped — it is a heading, but it is not a service — and so are slogans
 * and nav labels, which read as fabricated capability in a services list.
 */
export function servicesFrom(result: AuditResult): string[] {
  const nameKey = compactKey(result.name);
  return result.services
    .filter((heading) => {
      const key = compactKey(heading);
      if (!key) return false;
      if (nameKey && (key.includes(nameKey) || nameKey.includes(key))) return false;
      if (heading.endsWith("!")) return false;
      if (NON_SERVICE_HEADING.test(heading)) return false;
      return heading.length >= 4 && heading.length <= 60;
    })
    .slice(0, 6);
}

function firstSentence(text: string): string {
  const match = /^[^.!?]+[.!?]/.exec(text.trim());
  return (match ? match[0] : text.trim()).trim();
}

/**
 * Lowercase the opening letter so a finding can be spliced mid-sentence, but
 * leave acronyms and all-caps headings alone — "K-H MACHINE WORKS" must not
 * become "k-H MACHINE WORKS".
 */
function decapitalise(text: string): string {
  if (text.length === 0) return text;
  const firstWord = text.split(/\s+/)[0] ?? "";
  const isShouty = firstWord.length > 1 && firstWord === firstWord.toUpperCase();
  if (isShouty) return text;
  return text[0]!.toLowerCase() + text.slice(1);
}

function findingLine(check: CheckResult): string {
  return `${check.plain} _(${check.label}: ${check.evidence})_`;
}

export interface PitchResult {
  markdown: string;
  findingsUsed: CheckResult[];
}

/**
 * Build the outreach one-pager. Every sentence is derived from a check result
 * or a heading read off their own page; nothing is invented. The mockup URL is
 * left as an explicit placeholder rather than a guessed link.
 */
export function renderPitch(result: AuditResult): PitchResult {
  const findings = failedChecks(result);
  const [first, second, third] = findings;
  if (!first || !second) {
    throw new Error(
      `renderPitch called for ${result.slug} with ${findings.length} finding(s); check pitchBlocker first.`,
    );
  }

  const services = servicesFrom(result);
  const site = result.finalUrl || result.requestedUrl;
  const lines: string[] = [];

  lines.push(`# ${result.name}`);
  lines.push("");
  lines.push(
    `Audited ${result.auditedAt} · score ${result.score}/100 · ${findings.length} confirmed finding(s) · ${site}`,
  );
  if (result.valueBasis === "neutral-no-rating-data") {
    lines.push("");
    lines.push(
      "> No rating or review data was available for this business, so the score reflects site condition only.",
    );
  }
  lines.push("");

  // --- Email -------------------------------------------------------------
  lines.push("## Email");
  lines.push("");
  lines.push(`**Subject:** Two things I noticed on ${site}`);
  lines.push("");
  lines.push(`Hi ${result.name} team,`);
  lines.push("");
  lines.push(
    `I ran a quick check over ${site} — ${decapitalise(firstSentence(first.plain))} ` +
      `I also found that ${decapitalise(firstSentence(second.plain))} ` +
      `I have built a working preview of what your site could look like with both fixed — ` +
      `it is a real page, not a slide deck, and it is yours to look at either way: [MOCKUP URL].`,
  );
  lines.push("");
  lines.push("_Findings cited above, with the measurement each came from:_");
  lines.push("");
  lines.push(`- ${findingLine(first)}`);
  lines.push(`- ${findingLine(second)}`);
  lines.push("");

  // --- Phone script ------------------------------------------------------
  lines.push("## Phone script");
  lines.push("");
  const opener = services[0]
    ? `Ask for whoever looks after the website. Mention you found them looking for "${services[0]}".`
    : "Ask for whoever looks after the website.";
  lines.push(`- ${opener}`);
  lines.push(
    `- Lead with the phone experience: ${decapitalise(firstSentence(first.plain))}`,
  );
  lines.push(`- Second point: ${decapitalise(firstSentence(second.plain))}`);
  lines.push(
    third
      ? `- Third point, only if they are engaged: ${decapitalise(firstSentence(third.plain))}`
      : `- If they are engaged, offer to walk through the other ${findings.length - 2} item(s) found.`,
  );
  lines.push(
    "- Offer the preview: a real working page built from their own services, no commitment.",
  );
  lines.push(
    "- Close: ask for an email address to send the preview link, and a good time to follow up.",
  );
  lines.push("");

  // --- Mockup brief ------------------------------------------------------
  lines.push("## Mockup brief");
  lines.push("");
  lines.push(
    `**Hero headline:** ${
      services.length > 0
        ? `${result.name} — ${services.slice(0, 3).join(" · ")}`
        : result.name
    }`,
  );
  if (services.length === 0) {
    lines.push("");
    lines.push(
      "_No service headings were readable on their page, so the headline is the business name alone. Do not invent services._",
    );
  }
  lines.push("");
  lines.push("**Proof points** — each is one of the findings above, stated as what the new page does instead:");
  lines.push("");
  for (const check of findings.slice(0, 3)) {
    lines.push(`- Fixes: ${check.plain} _(${check.label}: ${check.evidence})_`);
  }
  lines.push("");
  lines.push(
    `**Call to action:** one button — "Call ${result.phone || "the shop"}" — repeated at the top and bottom of the page.`,
  );
  lines.push("");
  if (services.length > 0) {
    lines.push(
      `**Services to carry over** (read from their own page): ${services.join(", ")}.`,
    );
    lines.push("");
  }
  lines.push(
    "_This preview is the deliverable, not a throwaway: the same template ships as the live site._",
  );
  lines.push("");

  return {
    markdown: `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`,
    findingsUsed: [first, second],
  };
}

export function renderSkipped(skips: readonly SkipReason[], generatedAt: string): string {
  const lines: string[] = [];
  lines.push("# Skipped leads");
  lines.push("");
  lines.push(`Generated ${generatedAt}.`);
  lines.push("");
  lines.push(
    `A lead is skipped when it has fewer than ${MIN_FINDINGS} confirmed findings. ` +
      "Writing a personalised pitch without evidence would mean inventing the personalisation, so these are left for a human instead.",
  );
  lines.push("");
  if (skips.length === 0) {
    lines.push("Nothing was skipped in this run.");
    lines.push("");
    return `${lines.join("\n")}\n`;
  }
  for (const skip of skips) {
    lines.push(`- **${skip.name}** (\`${skip.slug}\`) — ${skip.reason}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}
