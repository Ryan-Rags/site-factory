/**
 * Build every registered client into `dist/<slug>/`.
 *
 * Sequential rather than parallel: Astro writes shared caches under `.astro/`,
 * and concurrent builds race on them. Five clients take a few seconds each;
 * the complexity of isolating caches is not worth the saving.
 *
 * Each client's build runs the marker check for that client, so one client
 * going live with an unconfirmed value fails the whole batch.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const clientsDir = join(pkgRoot, 'clients');

/*
 * `PREVIEW_ORIGIN` names ONE origin, and this builds many clients.
 *
 * It exists so a slug whose Pages project name was substituted can be rebuilt
 * on the host it is really served from (`src/lib/preview-origin.mjs`). Left set
 * in a shell, it would stamp that one host into all eight builds — every card,
 * every canonical, every graph — and every build would still pass its own
 * gates, because the build and the gate read the same variable. That is the
 * c3m failure with the blast radius multiplied by eight, so the batch refuses
 * to start rather than trusting whoever exported it to remember.
 */
if ((process.env['PREVIEW_ORIGIN'] ?? '').trim() !== '') {
  console.error(
    `✗ PREVIEW_ORIGIN is set (${process.env['PREVIEW_ORIGIN']}), and it names one origin.\n` +
      '  A batch would stamp it into every client in dist/. It is for rebuilding a single\n' +
      '  slug whose Pages project name was substituted:\n\n' +
      '    PREVIEW_ORIGIN=https://<host> SITE_CLIENT=<slug> pnpm build\n\n' +
      '  Unset it, then run build:all again.',
  );
  process.exit(1);
}

// Slugs come from the filenames, since plain Node cannot import the
// TypeScript registry. `clients/index.ts` stays the source of truth for what
// is *buildable*, so we cross-check the two and fail on any drift rather than
// silently skipping a client that was added to one but not the other.
const fromFiles = readdirSync(clientsDir)
  .filter((f) => f.endsWith('.config.ts'))
  .map((f) => f.replace(/\.config\.ts$/, ''))
  .sort();

const registry = readFileSync(join(clientsDir, 'index.ts'), 'utf8');
const unregistered = fromFiles.filter((slug) => !registry.includes(`'${slug}'`));
if (unregistered.length > 0) {
  console.error(
    `✗ These configs exist but are not registered in clients/index.ts: ${unregistered.join(', ')}`,
  );
  process.exit(1);
}

/*
 * Test fixtures are registered, buildable and deliberately excluded from the
 * batch.
 *
 * `scripts/deploy/deploy-mockups.mjs` publishes every directory it finds under
 * `dist/`, which is the right behaviour for a batch of prospect demos and the
 * wrong one for a fixture with an invented business name. Keeping the fixture
 * out of `dist/` during `build:all` is what makes "never deployed" a property
 * of the pipeline rather than a note in a README.
 *
 * Build one on purpose with `SITE_CLIENT=<slug> pnpm build`, and delete its
 * `dist/<slug>/` before running a deploy.
 */
/*
 * TWO prefixes are excluded, for the same reason and with different names.
 *
 * `zz-fixture-` is a test fixture: registered, buildable, and proving a
 * behaviour to a gate.
 *
 * `portfolio-` is a demonstration build of an INVENTED business, deployed to
 * its own `portfolio-<slug>` Pages project and linked publicly from
 * raghubans.com/sites. It must stay out of `dist/` during a batch for exactly
 * the reason above: `deploy-mockups.mjs` publishes every directory it finds
 * there, so a batch run would republish five invented businesses into the
 * prospect mockup fleet under `-preview` hostnames nobody links. Their real
 * deploy is one project each, on purpose.
 *
 * Build one deliberately with `SITE_CLIENT=<slug> pnpm exec astro build`, and
 * delete its `dist/<slug>/` before running a deploy.
 */
const EXCLUDED_PREFIXES = ['zz-fixture-', 'portfolio-'];
const isExcluded = (slug) => EXCLUDED_PREFIXES.some((prefix) => slug.startsWith(prefix));

const fixtures = fromFiles.filter(isExcluded);
const CLIENT_SLUGS = fromFiles.filter((slug) => !isExcluded(slug));

if (fixtures.length > 0) {
  console.log(`skipping ${fixtures.length} fixture/demonstration build(s): ${fixtures.join(', ')}`);
}

/*
 * The form-field gate runs once, before anything is built, and it covers every
 * config including the fixtures this batch skips. It is a check on config
 * rather than on output — an unanswerable form or a Worker that disagrees with
 * a config is wrong before a single page is rendered — so failing here saves
 * eight builds and reports the real problem instead of a symptom.
 */
const fields = spawnSync(
  process.execPath,
  [join(pkgRoot, 'scripts', 'check-form-fields.mjs')],
  { cwd: pkgRoot, stdio: 'inherit' },
);
if (fields.status !== 0) {
  console.error('✗ form field rules failed — nothing was built');
  process.exit(1);
}

let failed = 0;
for (const slug of CLIENT_SLUGS) {
  console.log(`\n=== building ${slug} ===`);
  const res = spawnSync('pnpm', ['exec', 'astro', 'build'], {
    cwd: pkgRoot,
    stdio: 'inherit',
    env: { ...process.env, SITE_CLIENT: slug },
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) {
    console.error(`✗ ${slug}: build failed`);
    failed++;
    continue;
  }
  /*
   * The same per-client chain `pnpm build` runs, and for the same reason: a
   * batch build that checked less than a single build would make `build:all`
   * the easier way to ship something the gates would have caught.
   */
  let clientFailed = false;
  for (const script of [
    'check-markers.mjs',
    'check-fabrication.mjs',
    'check-contact-links.mjs',
    'check-links.mjs',
    // gen-headers must precede check-headers: the gate compares the file this
    // writes against the pages, and would otherwise fail on a batch build for
    // the absence of a file the batch is responsible for producing.
    'gen-headers.mjs',
    'check-headers.mjs',
    'check-metadata.mjs',
    'check-schema.mjs',
    'check-go-live.mjs',
  ]) {
    const check = spawnSync(process.execPath, [join(pkgRoot, 'scripts', script), slug], {
      cwd: pkgRoot,
      stdio: 'inherit',
    });
    if (check.status !== 0) clientFailed = true;
  }
  if (clientFailed) failed++;
}

/*
 * The contrast gate runs once for the batch rather than once per client: it
 * checks the whole preset matrix and every design config in the package, so
 * running it eight times would print the same 234 assertions eight times.
 */
const contrast = spawnSync(process.execPath, [join(pkgRoot, 'scripts', 'check-contrast.mjs')], {
  cwd: pkgRoot,
  stdio: 'inherit',
});
if (contrast.status !== 0) failed++;

/*
 * The runtime CSP check runs once for the batch, over every client in dist/,
 * and is deliberately not in the per-client `pnpm build`: it launches a
 * browser, which is far too heavy to pay on every single-client build.
 *
 * It is the only check here that proves the generated policy does not break
 * the site. check-headers proves the _headers file agrees with the pages, which
 * is two files agreeing with each other — a perfectly derived policy can still
 * stop the customizer applying a selection or the service worker registering,
 * and neither shows up anywhere but in front of a customer.
 */
const runtime = spawnSync(process.execPath, [join(pkgRoot, 'scripts', 'check-csp-runtime.mjs'), '--all'], {
  cwd: pkgRoot,
  stdio: 'inherit',
});
if (runtime.status !== 0) failed++;

console.log(`\n${CLIENT_SLUGS.length - failed}/${CLIENT_SLUGS.length} clients built and checked.`);
process.exit(failed === 0 ? 0 : 1);
