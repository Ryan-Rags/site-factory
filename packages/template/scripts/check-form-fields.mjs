/**
 * Refuses to ship a form nobody can answer, and refuses to let the form and the
 * server disagree about what it asks for.
 *
 * Two separate failures, one gate, because they have the same symptom — a lead
 * that never gets a reply — and neither is visible on the page that caused it.
 *
 * 1. **The invariant.** A client's resolved field rules must make a submission
 *    impossible without at least one of phone or email. `phone: 'optional'`
 *    beside `email: 'hidden'` accepts a name, a message, and no way to answer
 *    it. The website looks fine. The customer waits.
 *
 * 2. **Drift.** `forms.fields` in a client config and `PROSPECT_FIELDS` in
 *    `worker-demo/wrangler.jsonc` are two files describing one thing. When they
 *    disagree the failure is silent in the direction that matters: the form
 *    stops asking for a field, the Worker keeps demanding it, and every
 *    submission 422s in front of a customer with the shop none the wiser.
 *
 * It also checks the two lists either side of the same fence: every buildable
 * slug must be in `KNOWN_PROSPECTS` (a slug missing there gets a 422 in front of
 * a prospect), and every routing entry must name a prospect that exists (a
 * typo'd key silently falls back to `MAIL_TO`, so the lead survives and the
 * routing is a lie).
 *
 * ## "Buildable slug" means two lists, not one
 *
 * It used to mean `clients/` alone, and that was wrong in a way that cost 33
 * demos their contact form. A generated prospect demo is built from a config
 * under gitignored `prospects/` handed to Astro as `SITE_CONFIG_FILE`; it has no
 * file under `clients/` and never will, because ingested third-party data does
 * not go in the repo. So when PR #54 registered its 50 generated demos in
 * `KNOWN_PROSPECTS`, this gate reported 100 problems — 50 slugs × 2 wrangler
 * files — and every prospect build after the edit failed. The gate was right
 * about the drift and wrong about the universe.
 *
 * The universe is now:
 *
 *     KNOWN_PROSPECTS === clients/index.ts ∪ prospects/known.json
 *
 * `prospects/known.json` is committed and holds slugs only — see the `note`
 * inside it. It is regenerated with `pnpm demo -- --emit-known`.
 *
 * `PROSPECT_FIELDS` is still compared against `clients/` only, and deliberately.
 * A generated demo emits no `forms.fields` block, so it resolves to the
 * template's defaults, which are byte-for-byte the Worker's defaults — there is
 * nothing to compare and an absent entry is the correct state. An entry naming a
 * generated slug is still refused: it would be a rule nothing can verify.
 *
 * Same technique as `check-contact-links.mjs`: plain Node cannot import the
 * TypeScript registry, so the configs are read with anchored regexes. The
 * committed `wrangler.jsonc` is checked always; `wrangler.local.jsonc` is
 * checked too when it exists, because that is the file that actually deploys.
 *
 * Usage:
 *   node scripts/check-form-fields.mjs
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const pkgRoot = join(here, '..');
const clientsDir = join(pkgRoot, 'clients');
const workerDir = join(pkgRoot, 'worker-demo');
const knownProspectsFile = join(pkgRoot, 'prospects', 'known.json');

const FIELD_NAMES = ['name', 'phone', 'email', 'service', 'message', 'file'];

/** Must match DEFAULT_FORM_FIELDS in src/lib/form-fields.ts and the Worker's. */
const DEFAULTS = {
  name: 'required',
  phone: 'optional',
  email: 'optional',
  service: 'optional',
  message: 'required',
  file: 'optional',
};

/** Must match contactSatisfiable() on both sides. */
const satisfiable = (rules) =>
  rules.phone === 'required' ||
  rules.email === 'required' ||
  (rules.phone === 'optional' && rules.email === 'optional');

const problems = [];
const fail = (message) => problems.push(message);

/* ------------------------------------------------------------------ configs */

/** Full-line comments only: a `//` inside a string is not a comment. */
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

/**
 * @param slug   the config to read
 * @param chain  slugs already visited, so an import cycle reports itself
 *   instead of recursing until the stack gives out
 */
function clientRules(slug, chain = []) {
  const file = join(clientsDir, `${slug}.config.ts`);
  const source = stripComments(readFileSync(file, 'utf8'));

  // Anchored to the `forms:` block at object depth 1, the same shape every
  // config uses, so a `fields` key elsewhere cannot match.
  const forms = /\bforms:\s*\{([\s\S]*?)\n {2}\},/.exec(source);

  /*
   * A config with no `forms` block of its own inherits one. The three
   * design-family comparison builds are written as `{ ...ksWelding, … }` —
   * same shop, same form, different theme — so the rules that apply to them are
   * whichever config they spread. Follow the spread rather than assuming the
   * defaults, which would pass a client whose parent had non-default rules.
   */
  if (!forms) {
    const spread = /=\s*\{\s*\.\.\.(\w+)[,\s]/.exec(source);
    const parent = spread
      ? new RegExp(`import\\s+${spread[1]}\\s+from\\s+'\\./([\\w-]+)\\.config'`).exec(source)
      : null;
    if (!parent) {
      throw new Error(
        `${slug}.config.ts: no forms block, and no spread of another config to inherit one from`,
      );
    }
    if (chain.includes(slug)) {
      throw new Error(`config spread cycle: ${[...chain, slug].join(' -> ')}`);
    }
    return clientRules(parent[1], [...chain, slug]);
  }

  if (/\.\.\.\w+\.forms/.test(forms[1])) {
    throw new Error(
      `${slug}.config.ts: its forms block spreads another config's, which this gate cannot ` +
        `resolve by regex. Write the fields out, or teach this script to merge.`,
    );
  }

  const fields = /\bfields:\s*\{([\s\S]*?)\}/.exec(forms[1]);
  const rules = { ...DEFAULTS };
  if (fields) {
    for (const [, field, rule] of fields[1].matchAll(
      /(\w+):\s*'(required|optional|hidden)'/g,
    )) {
      if (!FIELD_NAMES.includes(field)) {
        fail(`${slug}: forms.fields has an unknown field "${field}"`);
        continue;
      }
      rules[field] = rule;
    }
  }
  return rules;
}

const slugs = readdirSync(clientsDir)
  .filter((f) => f.endsWith('.config.ts'))
  .map((f) => f.replace(/\.config\.ts$/, ''))
  .sort();

const registry = readFileSync(join(clientsDir, 'index.ts'), 'utf8');
for (const slug of slugs) {
  if (!registry.includes(`'${slug}'`)) {
    fail(`${slug}: config exists but is not registered in clients/index.ts`);
  }
}

/**
 * The generated demos: slugs only, from the committed registry.
 *
 * A missing file is not an error — a checkout that has never run a batch has no
 * generated demos — but a malformed one is, because the failure it would
 * otherwise cause is the gate quietly reverting to clients-only and reporting
 * every prospect as unknown.
 */
function readKnownProspects() {
  if (!existsSync(knownProspectsFile)) return [];
  let doc;
  try {
    doc = JSON.parse(readFileSync(knownProspectsFile, 'utf8'));
  } catch (err) {
    fail(`prospects/known.json is not valid JSON: ${err.message}`);
    return [];
  }
  if (!Array.isArray(doc.slugs)) {
    fail('prospects/known.json has no "slugs" array');
    return [];
  }
  const out = [];
  for (const slug of doc.slugs) {
    if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
      fail(`prospects/known.json: "${slug}" is not a slug`);
      continue;
    }
    // The registry is slugs only, on purpose. A value carrying an `@`, a digit
    // run that looks like a phone number, or a `ChIJ…` place id means somebody
    // has started keeping client data in a committed file.
    if (slug.startsWith('chij')) {
      fail(`prospects/known.json: "${slug}" looks like a place id, not a slug`);
      continue;
    }
    if (clientSlugs.includes(slug)) {
      fail(
        `prospects/known.json lists "${slug}", which is also a client config. One slug, one ` +
          `owner: a generated demo must not shadow a hand-authored client.`,
      );
      continue;
    }
    out.push(slug);
  }
  return out;
}

const clientSlugs = slugs;
const prospectSlugs = readKnownProspects();
/** Every slug this repo can build, and therefore every slug the Worker may admit. */
const buildable = [...clientSlugs, ...prospectSlugs].sort();

const byClient = new Map();
for (const slug of slugs) {
  const rules = clientRules(slug);
  byClient.set(slug, rules);
  if (!satisfiable(rules)) {
    fail(
      `${slug}: forms.fields has phone: "${rules.phone}" and email: "${rules.email}", which ` +
        `accepts a lead with no phone number and no email address — nobody can answer it. ` +
        `Require one of them, or leave both optional so the either/or rule applies.`,
    );
  }
}

/* ------------------------------------------------------------------- worker */

/** `slug=name!,phone,…; slug=…` — the same grammar as the Worker's parser. */
function parseWorkerFields(value) {
  const map = new Map();
  for (const chunk of (value ?? '').split(';')) {
    const entry = chunk.trim();
    if (!entry) continue;
    const at = entry.indexOf('=');
    if (at === -1) {
      fail(`PROSPECT_FIELDS: malformed entry "${entry}"`);
      continue;
    }
    const slug = entry.slice(0, at).trim();
    const rules = Object.fromEntries(FIELD_NAMES.map((f) => [f, 'hidden']));
    for (const token of entry.slice(at + 1).split(',')) {
      const raw = token.trim();
      if (!raw) continue;
      const required = raw.endsWith('!');
      const field = required ? raw.slice(0, -1) : raw;
      if (!FIELD_NAMES.includes(field)) {
        fail(`PROSPECT_FIELDS[${slug}]: unknown field "${raw}"`);
        continue;
      }
      rules[field] = required ? 'required' : 'optional';
    }
    map.set(slug, rules);
  }
  return map;
}

const varOf = (source, name) => {
  const match = new RegExp(`"${name}"\\s*:\\s*"([^"]*)"`).exec(source);
  return match ? match[1] : null;
};

const list = (value) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

function checkWorkerConfig(file) {
  const label = relative(pkgRoot, file).split('\\').join('/');
  const source = readFileSync(file, 'utf8');

  const known = list(varOf(source, 'KNOWN_PROSPECTS'));
  if (known.length === 0) fail(`${label}: KNOWN_PROSPECTS is empty or missing`);

  // The bijection, both directions, against every slug this repo can build.
  for (const slug of buildable) {
    if (!known.includes(slug)) {
      const where = clientSlugs.includes(slug) ? 'clients/index.ts' : 'prospects/known.json';
      fail(
        `${label}: KNOWN_PROSPECTS is missing "${slug}" (in ${where}) — that demo's form would 422`,
      );
    }
  }
  for (const slug of known) {
    if (!buildable.includes(slug)) {
      fail(
        `${label}: KNOWN_PROSPECTS has "${slug}", which is neither a client config nor a slug in ` +
          `prospects/known.json. Either it is a typo, or a demo was retired without being ` +
          `de-registered — a slug the Worker admits and nobody can account for.`,
      );
    }
  }

  // Field rules, resolved the same way on both sides and compared field by
  // field. A prospect with no entry uses the defaults, which is why an absent
  // entry is not an error — only a *different* one is.
  const workerFields = parseWorkerFields(varOf(source, 'PROSPECT_FIELDS'));
  for (const [slug, rules] of workerFields) {
    if (!slugs.includes(slug)) {
      fail(
        prospectSlugs.includes(slug)
          ? `${label}: PROSPECT_FIELDS has "${slug}", a generated demo. Generated demos carry no ` +
              `forms.fields block, so there is no config side to hold this entry to and nothing ` +
              `would catch it going stale. Delete the entry; the defaults already agree.`
          : `${label}: PROSPECT_FIELDS has "${slug}", which is not a client config`,
      );
      continue;
    }
    if (!satisfiable(rules)) {
      fail(
        `${label}: PROSPECT_FIELDS[${slug}] has phone: "${rules.phone}" and email: ` +
          `"${rules.email}" — a lead nobody can answer. The Worker falls back to the default ` +
          `rules at runtime, but the config is still wrong.`,
      );
    }
  }
  for (const slug of slugs) {
    const client = byClient.get(slug);
    const worker = workerFields.get(slug) ?? DEFAULTS;
    const differences = FIELD_NAMES.filter((f) => client[f] !== worker[f]).map(
      (f) => `${f}: config says "${client[f]}", Worker says "${worker[f]}"`,
    );
    if (differences.length > 0) {
      fail(
        `${label}: PROSPECT_FIELDS disagrees with clients/${slug}.config.ts — ` +
          differences.join('; '),
      );
    }
  }

  // Routing. A recipient key that matches no prospect never matches at all, so
  // those leads quietly fall back to MAIL_TO and the map is a fiction.
  for (const entry of list(varOf(source, 'PROSPECT_RECIPIENTS'))) {
    const at = entry.indexOf('=');
    if (at === -1) {
      fail(`${label}: PROSPECT_RECIPIENTS entry "${entry}" is not slug=address`);
      continue;
    }
    const slug = entry.slice(0, at).trim();
    const address = entry.slice(at + 1).trim();
    if (!known.includes(slug)) {
      fail(`${label}: PROSPECT_RECIPIENTS routes "${slug}", which is not in KNOWN_PROSPECTS`);
    }
    if (!address.includes('@')) {
      fail(`${label}: PROSPECT_RECIPIENTS entry for "${slug}" is not an address: "${address}"`);
    }
  }

  return label;
}

const committed = join(workerDir, 'wrangler.jsonc');
const local = join(workerDir, 'wrangler.local.jsonc');

const checked = [checkWorkerConfig(committed)];
// The gitignored one is what actually deploys. Absent is normal (nobody has
// run a deploy from this checkout); present and wrong is the dangerous case.
if (existsSync(local)) checked.push(checkWorkerConfig(local));

/* ------------------------------------------------------------------- report */

if (problems.length > 0) {
  for (const problem of problems) console.error(`✗ ${problem}`);
  console.error(`\n${problems.length} problem(s) in the form field rules.`);
  process.exit(1);
}

console.log(
  `✓ ${clientSlugs.length} client(s) + ${prospectSlugs.length} generated demo(s): every form ` +
    `keeps a contact channel, and ${checked.join(' + ')} admit exactly those ${buildable.length} ` +
    `slug(s).`,
);
