#!/usr/bin/env node
/**
 * mockup — build a client's site and produce the before/after screenshot set
 * that goes out with the pitch.
 *
 *   pnpm mockup --client kts-machine-shop
 *   pnpm mockup:all
 *
 * For each client it writes into `outreach/<slug>/`, beside the `pitch.md`
 * that `packages/outreach` already puts there:
 *
 *   before-desktop.png  before-mobile.png   (copied from audit/out/<slug>/,
 *                                            when the lead had a site to audit)
 *   after-desktop.png   after-mobile.png    (shot from the freshly built site)
 *
 * `outreach/` is gitignored — this writes client-facing artifacts and nothing
 * else. It reads `packages/template/` and `audit/out/` and never writes to
 * either.
 */
import { mkdirSync } from 'node:fs';
import { relative } from 'node:path';

import { buildClient } from './build.mjs';
import { copyBefore } from './before.mjs';
import { assertKnownClient, listClients } from './clients.mjs';
import { outreachDirFor, repoRoot } from './paths.mjs';
import { serveDir } from './serve.mjs';
import { shootSite } from './shoot.mjs';

const USAGE = `
Usage:
  node scripts/mockup/index.mjs --client <slug>   build + shoot one client
  node scripts/mockup/index.mjs --all             every registered client
`;

function parseArgs(argv) {
  const opts = { all: false, client: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--all') opts.all = true;
    else if (arg === '--client' || arg === '-c') opts.client = argv[++i];
    else if (arg.startsWith('--client=')) opts.client = arg.slice('--client='.length);
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`Unrecognised argument "${arg}".${USAGE}`);
  }
  return opts;
}

const rel = (p) => relative(repoRoot, p).split('\\').join('/');

async function mockupOne(slug) {
  console.log(`\n=== ${slug} ===`);

  const dist = buildClient(slug);

  const outDir = outreachDirFor(slug);
  mkdirSync(outDir, { recursive: true });

  const before = copyBefore(slug, outDir);
  if (before.length === 0) {
    console.log(`  no before screenshots for ${slug} (no existing site audited) — after-only`);
  } else {
    console.log(`  before: ${before.join(', ')}`);
  }

  // The server is closed in `finally` so a screenshot failure cannot leave a
  // listener holding the port for the rest of a `--all` run.
  const server = await serveDir(dist);
  let after;
  try {
    after = await shootSite(server.origin, outDir);
  } finally {
    await server.close();
  }
  console.log(`  after:  ${after.join(', ')}`);
  console.log(`  → ${rel(outDir)}/`);

  return { slug, before: before.length, after: after.length };
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  if (opts.help) {
    console.log(USAGE.trim());
    return;
  }

  const known = listClients();
  let slugs;
  if (opts.all) {
    if (opts.client) {
      console.error('Pass either --all or --client <slug>, not both.');
      process.exit(2);
    }
    slugs = known;
  } else if (opts.client) {
    slugs = [assertKnownClient(opts.client, known)];
  } else {
    console.error(`No client selected.${USAGE}\nKnown clients: ${known.join(', ')}`);
    process.exit(2);
  }

  // One client's failure does not abandon the rest of the batch — but the run
  // still exits non-zero, so a partial `mockup:all` can never read as success.
  const failures = [];
  for (const slug of slugs) {
    try {
      await mockupOne(slug);
    } catch (err) {
      console.error(`✗ ${slug}: ${err.message}`);
      failures.push(slug);
    }
  }

  console.log(`\n${slugs.length - failures.length}/${slugs.length} mockups produced.`);
  if (failures.length > 0) {
    console.error(`failed: ${failures.join(', ')}`);
    process.exit(1);
  }
}

await main();
