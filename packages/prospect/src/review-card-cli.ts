#!/usr/bin/env node
/**
 * `pnpm review-card <slug>` — render one client's printable review card.
 *
 * A leave-behind with no marginal cost: the browser, the QR renderer and the
 * card layout all already exist for the pitch cards, and the only new input is
 * one URL in the client config.
 *
 * Reads the client's own config for the business name, the brand colours and
 * `business.reviewUrl`. Refuses to render without that last one — see the
 * field's note in `packages/template/src/types/site.ts` for why a derived Place
 * ID is worse than no card.
 *
 * Usage:
 *   pnpm review-card <slug> [--out <file>] [--lede "..."] [--footnote "..."]
 *   pnpm review-card --list
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { withBrowser } from "./browser.js";
import { renderReviewCard } from "./review-card.js";

const here = dirname(fileURLToPath(import.meta.url));
// dist/ sits one level under the package root, which is two under the repo.
const repoRoot = resolve(here, "..", "..", "..");
const clientsDir = join(repoRoot, "packages", "template", "clients");

function listSlugs(): string[] {
  if (!existsSync(clientsDir)) return [];
  return readdirSync(clientsDir)
    .filter((f) => f.endsWith(".config.ts"))
    .map((f) => f.replace(/\.config\.ts$/, ""))
    .sort();
}

/**
 * Pull the handful of fields the card needs straight out of the config source.
 *
 * Read rather than imported because this package is plain TypeScript compiled
 * to `dist/`, and importing a `.ts` config out of another package at runtime
 * would mean carrying a TypeScript loader for four strings. A config that
 * spreads another client's — the K&S comparison builds do — is followed one
 * level, the same way `gen-brand-assets.mjs` follows it.
 */
function readClient(slug: string, depth = 0): {
  name: string;
  reviewUrl: string;
  primary: string;
  accent: string;
} | null {
  const file = join(clientsDir, `${slug}.config.ts`);
  if (!existsSync(file)) return null;
  const src = readFileSync(file, "utf8");

  const pick = (re: RegExp): string | undefined => re.exec(src)?.[1];

  let name = pick(/name:\s*'([^']+)'/) ?? pick(/name:\s*"([^"]+)"/);
  let reviewUrl = pick(/reviewUrl:\s*'([^']+)'/) ?? pick(/reviewUrl:\s*"([^"]+)"/);
  let primary = pick(/primary:\s*'([^']+)'/);
  let accent = pick(/accent:\s*'([^']+)'/);

  if ((!name || !primary) && depth < 3) {
    const parent = pick(/from '\.\/([a-z0-9-]+)\.config'/);
    const inherited = parent ? readClient(parent, depth + 1) : null;
    if (inherited) {
      name = name ?? inherited.name;
      reviewUrl = reviewUrl ?? inherited.reviewUrl;
      primary = primary ?? inherited.primary;
      accent = accent ?? inherited.accent;
    }
  }

  if (!name) return null;
  return {
    name,
    reviewUrl: reviewUrl ?? "",
    // Fall back to neutral ink rather than inventing a palette: the card is
    // still correct in black and white, and a wrong brand colour is worse than
    // no brand colour.
    primary: primary ?? "#0f172a",
    accent: accent ?? "#b45309",
  };
}

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

if (argv.includes("--list")) {
  for (const slug of listSlugs()) {
    const c = readClient(slug);
    const has = c?.reviewUrl ? "has reviewUrl" : "no reviewUrl";
    console.log(`  ${slug.padEnd(30)} ${has}`);
  }
  process.exit(0);
}

const slug = argv.find((a) => !a.startsWith("-"));
if (!slug) {
  console.error("Usage: pnpm review-card <slug> [--out <file>] [--lede ...] [--footnote ...]");
  console.error("       pnpm review-card --list");
  process.exit(1);
}

const client = readClient(slug);
if (!client) {
  console.error(`✗ No client config for "${slug}". Known: ${listSlugs().join(", ")}`);
  process.exit(1);
}

if (!client.reviewUrl) {
  console.error(
    `✗ ${slug}: business.reviewUrl is not set, so there is no review link to encode.\n` +
      `\n` +
      `  Add it to packages/template/clients/${slug}.config.ts:\n` +
      `\n` +
      `    business: {\n` +
      `      reviewUrl: 'https://search.google.com/local/writereview?placeid=<PLACE_ID>',\n` +
      `    }\n` +
      `\n` +
      `  Take the Place ID from the shop's own Google Business Profile. It is not\n` +
      `  derived here on purpose: a stale or guessed ID does not fail loudly, it\n` +
      `  points the shop's customers at a review form for a different business.\n`,
  );
  process.exit(1);
}

const out = flag("--out") ?? join(repoRoot, "out", "review-cards", `${slug}.png`);

const written = await withBrowser((browser) =>
  renderReviewCard(
    browser,
    {
      businessName: client.name,
      reviewUrl: client.reviewUrl,
      colors: { primary: client.primary, accent: client.accent },
      ...(flag("--lede") ? { lede: flag("--lede") as string } : {}),
      ...(flag("--footnote") ? { footnote: flag("--footnote") as string } : {}),
    },
    out,
  ),
);

console.log(`✓ ${slug}: review card written to ${written}`);
console.log(`  3.5×5in at 300dpi — prints without resampling. QR is black on white by design.`);
