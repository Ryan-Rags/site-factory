#!/usr/bin/env node
// Deploy every built client site in packages/template/dist to its own
// Cloudflare Pages project, one project per client, served at its own root.
//
// One project per client (not one project with per-client subpaths) because the
// template builds absolute, root-relative hrefs -- the same shape a real client
// build targets on their own domain. See PLAN-mockup.md "Backlog" for what a
// shared-subpath model would cost.
//
//   node scripts/deploy/deploy-mockups.mjs [--dist <dir>] [--dry-run]
//
// Requires DEMO_FORM_ENDPOINT, from the environment or from .env.deploy at the
// repo root. Refuses to publish sites whose built contact pages do not carry it
// -- see the "demo form endpoint gate" below for why that is a deploy-time
// check and not a build-time one. --dry-run still runs both gates, so it is a
// cheap preflight.
//
// Only DIRECTORIES under dist are treated as sites; loose files there are stale
// tsc stubs (index.js / index.d.ts*) and are ignored.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const PROJECT_SUFFIX = '-preview';
// Fallback suffix when a project name is already taken in someone else's account.
const COLLISION_SUFFIX = '-rr';
const PRODUCTION_BRANCH = 'main';

function parseArgs(argv) {
  const args = { dist: path.join(process.cwd(), 'packages', 'template', 'dist'), dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dist') {
      args.dist = path.resolve(argv[i + 1] ?? '');
      i += 1;
    } else if (argv[i] === '--dry-run') {
      args.dryRun = true;
    } else {
      throw new Error(`unknown argument: ${argv[i]}`);
    }
  }
  return args;
}

function wrangler(args) {
  const res = spawnSync('npx', ['wrangler', ...args], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  return { code: res.status, out };
}

/**
 * Test fixtures, which exist to exercise a build rule and are not businesses.
 *
 * `zz-fixture-phone-optional` carries an invented name, an invented number and
 * invented services, for the sole purpose of proving the form-field rules. It
 * must never reach a public URL. `build-all.mjs` already declines to build the
 * prefix into a batch, but that is not the same guarantee: anyone who builds one
 * deliberately (`SITE_CLIENT=zz-… pnpm build`, which is the documented way to
 * work on it) leaves a `dist/zz-…/` behind, and this script would then publish
 * whatever it found there.
 */
const FIXTURE_PREFIX = 'zz-';

function listSites(distDir) {
  const dirs = readdirSync(distDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const fixtures = dirs.filter((name) => name.startsWith(FIXTURE_PREFIX));
  // Announced, never silent: a deploy that quietly publishes fewer sites than
  // the operator expects is the same class of problem as one that publishes
  // more, and this script's whole job is to be predictable about what went out.
  if (fixtures.length > 0) {
    console.log(
      `skipping ${fixtures.length} test fixture(s), never deployed: ${fixtures.join(', ')}`,
    );
  }
  return dirs.filter((name) => !name.startsWith(FIXTURE_PREFIX));
}

// --- demo form endpoint gate -------------------------------------------------
//
// A demo build without DEMO_FORM_ENDPOINT does not fail: site.config.ts falls
// back to each client's own `forms` block, which for a mockup is `mailto` or
// `disabled`. That is correct for a real client build and silently wrong for a
// demo -- the site deploys, looks finished, and the contact form a prospect is
// being shown does nothing a Worker ever sees. Nothing downstream notices.
//
// So the deploy is the gate. It refuses to publish unless it knows the endpoint
// AND every built page it is about to publish actually carries it, which also
// catches a stale dist/ built before the variable existed.

const ENV_DEPLOY = path.join(process.cwd(), '.env.deploy');

// Deliberately tiny: KEY=VALUE, `#` comments, optional surrounding quotes. Real
// values here are URLs, not shell fragments, and an unset variable is a hard
// error two lines below rather than something a parser gap can hide.
function loadEnvDeploy(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m || line.trimStart().startsWith('#')) continue;
    const key = m[1];
    const value = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    // A real environment variable always wins, so a one-off
    // `DEMO_FORM_ENDPOINT=... pnpm deploy:mockups` still overrides the file.
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

function requireEndpoint() {
  loadEnvDeploy(ENV_DEPLOY);
  const endpoint = (process.env.DEMO_FORM_ENDPOINT ?? '').trim();
  if (endpoint === '') {
    console.error(
      'DEMO_FORM_ENDPOINT is not set, so these sites would deploy with dead\n' +
        'contact forms (mailto/disabled per client config). Set it in .env.deploy\n' +
        `at the repo root (${ENV_DEPLOY}, gitignored):\n\n` +
        '  DEMO_FORM_ENDPOINT=https://site-factory-demo-form.<subdomain>.workers.dev\n\n' +
        'then rebuild and redeploy:\n\n' +
        '  pnpm --filter @site-factory/template build:all\n' +
        '  pnpm deploy:mockups\n',
    );
    process.exit(1);
  }
  if (!/^https:\/\/[^\s/]+/.test(endpoint)) {
    console.error(`DEMO_FORM_ENDPOINT is not an https URL: ${endpoint}`);
    process.exit(1);
  }
  return endpoint;
}

// The endpoint reaches the browser as a prop on the contact page's form island,
// so the built HTML is the honest record of what was compiled in -- checking the
// artifact rather than the variable is what makes a stale dist/ impossible to
// ship. Escaping: Astro serialises island props with `&quot;` around values, and
// an https URL has no characters of its own that get escaped, so a plain
// substring test is sound.
function verifyBuiltEndpoint(distDir, slugs, endpoint) {
  const bad = [];
  for (const slug of slugs) {
    const page = path.join(distDir, slug, 'contact', 'index.html');
    if (!existsSync(page)) {
      bad.push(`${slug}: no contact/index.html`);
      continue;
    }
    if (!readFileSync(page, 'utf8').includes(endpoint)) {
      bad.push(`${slug}: contact page does not post to the demo endpoint`);
    }
  }
  if (bad.length > 0) {
    console.error(
      `built sites do not carry DEMO_FORM_ENDPOINT (${endpoint}):\n` +
        bad.map((b) => `  ${b}`).join('\n') +
        '\n\nRebuild with the variable set, then deploy:\n\n' +
        `  DEMO_FORM_ENDPOINT=${endpoint} pnpm --filter @site-factory/template build:all\n` +
        '  pnpm deploy:mockups\n',
    );
    process.exit(1);
  }
}

// Returns the project name that now exists, or throws.
function ensureProject(slug) {
  let name = `${slug}${PROJECT_SUFFIX}`;
  let res = wrangler(['pages', 'project', 'create', name, `--production-branch=${PRODUCTION_BRANCH}`]);
  if (res.code === 0) return { name, substituted: false };

  // Already ours -> nothing to do.
  if (/already exists/i.test(res.out) && !/another account|not available|taken/i.test(res.out)) {
    return { name, substituted: false };
  }

  // Name held elsewhere -> retry once under a suffixed name.
  const fallback = `${slug}${PROJECT_SUFFIX}${COLLISION_SUFFIX}`;
  console.log(`  name "${name}" unavailable; retrying as "${fallback}"`);
  res = wrangler(['pages', 'project', 'create', fallback, `--production-branch=${PRODUCTION_BRANCH}`]);
  name = fallback;
  if (res.code === 0 || /already exists/i.test(res.out)) return { name, substituted: true };

  throw new Error(`could not create a Pages project for ${slug}:\n${res.out}`);
}

function deploy(slug, projectName, distDir) {
  const res = wrangler([
    'pages',
    'deploy',
    path.join(distDir, slug),
    `--project-name=${projectName}`,
    `--branch=${PRODUCTION_BRANCH}`,
    '--commit-dirty=true',
  ]);
  if (res.code !== 0) throw new Error(`deploy failed for ${slug}:\n${res.out}`);
  const url = res.out.match(/https:\/\/[^\s]*\.pages\.dev/g)?.pop();
  if (!url) throw new Error(`deploy for ${slug} printed no URL:\n${res.out}`);
  return url;
}

// A brand-new project's hostname can take a few seconds to start serving, so
// retry a handful of times before calling it a failure.
async function status(url, attempts = 6) {
  let last = '';
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (res.status === 200) return '200';
      last = String(res.status);
    } catch (err) {
      last = `error: ${err.message}`;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return last;
}

const { dist, dryRun } = parseArgs(process.argv.slice(2));
const slugs = listSites(dist);
if (slugs.length === 0) {
  console.error(`no site directories found under ${dist} -- run the template build first`);
  process.exit(1);
}

// Both gates run before the first Pages call, so a bad batch costs nothing.
const endpoint = requireEndpoint();
verifyBuiltEndpoint(dist, slugs, endpoint);

console.log(`deploying ${slugs.length} site(s) from ${dist}`);
console.log(`demo form endpoint: ${endpoint}\n`);

const rows = [];
let failed = 0;

for (const slug of slugs) {
  console.log(`> ${slug}`);
  if (dryRun) {
    rows.push({ slug, project: `${slug}${PROJECT_SUFFIX}`, url: '(dry run)', home: '-', sub: '-' });
    continue;
  }
  try {
    const { name, substituted } = ensureProject(slug);
    deploy(slug, name, dist);
    // Verify (and report) the canonical project alias, not the per-deployment
    // hash hostname: the alias is what a client gets sent, and the hash host's
    // cert is not always issued by the time the deploy command returns.
    const url = `https://${name}.pages.dev`;
    // Homepage + one internal page: the internal hit is what proves root-hosted
    // nav links resolve, which the old shared-subpath project broke.
    const home = await status(`${url}/`);
    const sub = await status(`${url}/services/`);
    if (home !== '200' || sub !== '200') failed += 1;
    console.log(`  ${url}  home=${home} services=${sub}${substituted ? '  (name substituted)' : ''}`);
    rows.push({ slug, project: name, url, home, sub, substituted });
  } catch (err) {
    failed += 1;
    console.log(`  FAILED: ${err.message}`);
    rows.push({ slug, project: '-', url: '-', home: 'failed', sub: 'failed' });
  }
}

console.log('\n| slug | project | url | home | /services/ |');
console.log('| --- | --- | --- | --- | --- |');
for (const r of rows) {
  console.log(`| ${r.slug} | ${r.project} | ${r.url} | ${r.home} | ${r.sub} |`);
}

if (failed > 0) {
  console.error(`\n${failed} site(s) did not fully verify`);
  process.exit(1);
}
console.log('\nall sites deployed and verified');
