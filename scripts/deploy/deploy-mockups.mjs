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
// Only DIRECTORIES under dist are treated as sites; loose files there are stale
// tsc stubs (index.js / index.d.ts*) and are ignored.

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
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

function listSites(distDir) {
  return readdirSync(distDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
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
console.log(`deploying ${slugs.length} site(s) from ${dist}\n`);

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
