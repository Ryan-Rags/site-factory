/**
 * Refuses to ship a phone number a customer cannot tap.
 *
 * On a phone — which is where these sites are read and where they are demoed —
 * a number printed as text is a number that has to be memorised, switched
 * apps, and retyped. That is the exact moment an enquiry is lost, and it is
 * invisible on a desktop, which is where the page was written. So this is a
 * build gate rather than a habit.
 *
 * Four rules, checked against the built HTML rather than the config, because
 * the output is what a customer taps:
 *
 *   1. Every page carries at least one `tel:` link to the configured number.
 *   2. No `tel:` link points anywhere else — a typo'd number in one component
 *      is worse than no link, because it looks fine.
 *   3. The display number never appears as plain text outside a `tel:` anchor.
 *      JSON-LD is exempt: it is structured data for a crawler, not something a
 *      person taps.
 *   4. Every `sms:` link matches `business.smsHref`. A site with no confirmed
 *      textable number must emit no `sms:` link at all — texting a landline
 *      goes nowhere and answers nobody.
 *
 * Usage:
 *   node scripts/check-contact-links.mjs              # SITE_CLIENT's build
 *   node scripts/check-contact-links.mjs <slug>
 *   node scripts/check-contact-links.mjs --all        # every client in dist/
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveBaseSlug } from './lib/base-slug.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const pkgRoot = join(here, '..');
const distRoot = join(pkgRoot, 'dist');
const clientsDir = join(pkgRoot, 'clients');
// Generated prospects live outside the package and outside git. See
// clients/index.ts on why they never land in `clients/`.
const prospectsDir = join(pkgRoot, '..', '..', 'prospects');

function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...htmlFiles(full));
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
}

/**
 * The generated config for a prospect the demo pipeline built, or null.
 *
 * A discovered prospect has no file in `clients/` on purpose — see the note in
 * `clients/index.ts`. Its config is JSON on disk, named by `SITE_CONFIG_FILE`
 * at build time and living under `prospects/<slug>/`. Reading it is how a
 * generated demo gets checked at all; without this the whole demo pipeline is
 * ungated, which is the opposite of what a build gate is for.
 */
function generatedContactFor(slug) {
  const fromEnv = process.env.SITE_CONFIG_FILE;
  const candidates = [
    ...(fromEnv ? [fromEnv] : []),
    join(prospectsDir, slug, 'site.config.json'),
  ];
  const file = candidates.find((c) => existsSync(c));
  if (file === undefined) return null;

  let config;
  try {
    config = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${file} could not be read as JSON: ${err.message}`);
  }
  const business = config.business;
  if (!business?.phone || !business?.phoneHref) {
    throw new Error(`${file}: business.phone / business.phoneHref not found`);
  }
  return {
    phone: business.phone,
    phoneHref: business.phoneHref,
    smsHref: business.smsHref ?? null,
  };
}

/**
 * The three contact fields, read out of the client's TypeScript config.
 *
 * Same technique as `build-all.mjs` and `scripts/mockup/clients.mjs`: plain
 * Node cannot import the TS registry. The patterns are anchored to the
 * `business:` block so a `phone` key elsewhere in the config cannot match.
 *
 * A design-family comparison build has no `business` block of its own — it
 * spreads another client — so the slug is resolved to whichever config
 * actually declares one. See scripts/lib/base-slug.mjs.
 */
function contactFor(slug) {
  const file = join(clientsDir, `${resolveBaseSlug(clientsDir, slug)}.config.ts`);
  if (!existsSync(file)) {
    const generated = generatedContactFor(slug);
    if (generated) return generated;
    throw new Error(`No config for "${slug}" at ${relative(pkgRoot, file)}`);
  }
  const source = readFileSync(file, 'utf8');
  const business = /\bbusiness:\s*\{([\s\S]*?)\n  \},/.exec(source);
  if (!business) throw new Error(`Could not find the business block in ${slug}.config.ts`);
  const block = business[1];

  const pick = (key) => {
    const match = new RegExp(`\\b${key}:\\s*'([^']*)'`).exec(block);
    return match ? match[1] : null;
  };
  const phone = pick('phone');
  const phoneHref = pick('phoneHref');
  if (!phone || !phoneHref) {
    throw new Error(`${slug}.config.ts: business.phone / business.phoneHref not found`);
  }
  return { phone, phoneHref, smsHref: pick('smsHref') };
}

/** Strip what a person does not read: scripts, styles, and JSON-LD. */
const stripNonText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

/**
 * Remove whole `<a href="tel:…">…</a>` and `<a href="sms:…">…</a>` elements,
 * so whatever is left is a number that cannot be tapped. An `sms:` anchor
 * counts: rule 3 is about a number a customer has to retype, and a text link
 * carrying the number as its label is as tappable as a call link.
 */
const stripContactAnchors = (html) =>
  html.replace(/<a\b[^>]*href="(?:tel|sms):[^"]*"[\s\S]*?<\/a>/gi, '');

/**
 * Reduce to what a person actually sees.
 *
 * Markup has to go, not just scripts: Astro serialises an island's props into
 * a `props="…"` attribute on `<astro-island>`, so the contact form's phone
 * prop appears in the HTML source of every page carrying the form. It is
 * neither rendered nor tappable, and flagging it would train whoever hits it
 * to weaken this check rather than fix a real problem.
 */
const visibleText = (html) => html.replace(/<[^>]+>/g, ' ');

function checkFile(file, contact) {
  const problems = [];
  const html = readFileSync(file, 'utf8');

  const telHrefs = [...html.matchAll(/href="tel:([^"]*)"/g)].map((m) => m[1]);
  const smsHrefs = [...html.matchAll(/href="sms:([^"?]*)/g)].map((m) => m[1]);

  // Rule 1 — the 404 page and every real page must offer the number.
  if (telHrefs.length === 0) problems.push('no tel: link on the page');

  // Rule 2.
  for (const href of new Set(telHrefs)) {
    if (href !== contact.phoneHref) {
      problems.push(`tel: link to "${href}", but business.phoneHref is "${contact.phoneHref}"`);
    }
  }

  // Rule 3.
  const readable = visibleText(stripContactAnchors(stripNonText(html)));
  if (contact.phone && readable.includes(contact.phone)) {
    problems.push(`the number "${contact.phone}" appears as text outside a tel: link`);
  }

  // Rule 4.
  for (const href of new Set(smsHrefs)) {
    if (!contact.smsHref) {
      problems.push(`sms: link to "${href}" but business.smsHref is not set`);
    } else if (href !== contact.smsHref) {
      problems.push(`sms: link to "${href}", but business.smsHref is "${contact.smsHref}"`);
    }
  }

  return problems;
}

function checkClient(slug) {
  const dir = join(distRoot, slug);
  if (!existsSync(dir)) {
    console.error(`✗ ${slug}: no build at ${relative(pkgRoot, dir)} — run the build first`);
    return 1;
  }
  const contact = contactFor(slug);
  let failed = 0;
  for (const file of htmlFiles(dir)) {
    const problems = checkFile(file, contact);
    if (problems.length === 0) continue;
    failed += 1;
    console.error(`✗ ${relative(distRoot, file).split('\\').join('/')}`);
    for (const problem of problems) console.error(`    ${problem}`);
  }
  if (failed === 0) {
    const sms = contact.smsHref ? `, sms:${contact.smsHref}` : ', no sms link (no textable number)';
    console.log(`✓ ${slug}: every page taps through to tel:${contact.phoneHref}${sms}`);
  }
  return failed;
}

const arg = process.argv[2];
let slugs;
if (arg === '--all') {
  slugs = existsSync(distRoot)
    ? readdirSync(distRoot).filter((name) => statSync(join(distRoot, name)).isDirectory())
    : [];
  if (slugs.length === 0) {
    console.error('✗ nothing built under dist/ — run `pnpm build:all` first');
    process.exit(1);
  }
} else {
  // Same default chain as check-markers.mjs: the client this build just
  // produced, falling back to DEFAULT_CLIENT in clients/index.ts — which is
  // what `astro build` with no SITE_CLIENT set produces.
  slugs = [arg || process.env.SITE_CLIENT || 'kh-machine-works'];
}

let failures = 0;
for (const slug of slugs) failures += checkClient(slug);
process.exit(failures === 0 ? 0 : 1);
