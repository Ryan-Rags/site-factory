#!/usr/bin/env node
import { createServer } from "node:net";

import {
  auditReportFile,
  leadsFile,
  readLeads,
  type LeadRow,
} from "@site-factory/discover";
import { chromium } from "playwright";

import { readCached, writeCached } from "./cache.js";
import { renderReport, writeReport } from "./report.js";
import { assignSlugs, auditOne } from "./run.js";
import type { AuditResult } from "./types.js";

const USAGE = `Usage: pnpm audit-sites -- [options]

  --top <n>        Audit at most n leads, in input file order. Default 5.
  --only <slug>    Audit just this slug.
  --force          Ignore cached results and re-audit.
  --input <path>   Lead CSV to read. Default data/businesses.csv.
  --help

Read-only GETs, at most 1 page navigation/sec/domain and 10 per site.
Results are cached per site in audit/.cache/, so an interrupted run resumes.`;

interface Args {
  top: number;
  only: string;
  force: boolean;
  input: string;
  help: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { top: 5, only: "", force: false, input: leadsFile, help: false };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i] as string;
    const takeValue = (): string => {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${flag} expects a value`);
      }
      i += 1;
      return value;
    };

    switch (flag) {
      // pnpm forwards the `--` from `pnpm audit-sites -- --flag` verbatim.
      case "--":
        break;
      case "--top": {
        const n = Number(takeValue());
        if (!Number.isInteger(n) || n <= 0) throw new Error("--top expects a positive integer");
        args.top = n;
        break;
      }
      case "--only":
        args.only = takeValue();
        break;
      case "--input":
        args.input = takeValue();
        break;
      case "--force":
        args.force = true;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${flag}\n\n${USAGE}`);
    }
  }
  return args;
}

/** An ephemeral port for Chromium's CDP endpoint, so parallel runs cannot clash. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close(() => reject(new Error("Could not determine a free port.")));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  const allRows = readLeads(args.input);
  if (allRows.length === 0) {
    console.error(
      `No leads in ${args.input}. Run \`pnpm discover\` first, or pass --input.`,
    );
    return 1;
  }

  const slugs = assignSlugs(allRows);
  let candidates = allRows;
  if (args.only) {
    candidates = allRows.filter((row) => slugs.get(row) === args.only);
    if (candidates.length === 0) {
      console.error(`No lead with slug "${args.only}" in ${args.input}.`);
      return 1;
    }
  }

  const noWebsite: LeadRow[] = [];
  const auditable: LeadRow[] = [];
  for (const row of candidates) {
    if (row.url.trim()) auditable.push(row);
    else noWebsite.push(row);
  }

  const selected = auditable.slice(0, args.top);
  console.log(
    `${selected.length} site(s) to audit; ${noWebsite.length} lead(s) have no website.`,
  );

  const results: AuditResult[] = [];
  const port = await freePort();
  const browser = await chromium.launch({
    args: [`--remote-debugging-port=${port}`],
  });

  try {
    for (const row of selected) {
      const slug = slugs.get(row) as string;

      if (!args.force) {
        const cached = readCached(slug);
        if (cached) {
          console.log(`  ${slug}: cached (${cached.score}/100)`);
          results.push(cached);
          continue;
        }
      }

      process.stdout.write(`  ${slug}: auditing ${row.url} ... `);
      try {
        const result = await auditOne({
          browser,
          debugPort: port,
          row,
          slug,
          now: new Date(),
        });
        // Written immediately so an interrupt does not lose completed work.
        writeCached(result);
        results.push(result);
        console.log(
          result.reachable
            ? `${result.score}/100`
            : `unreachable (all checks unavailable)`,
        );
      } catch (err: unknown) {
        console.log("failed");
        console.error(`    ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } finally {
    await browser.close();
  }

  const report = renderReport({
    results,
    noWebsite,
    generatedAt: new Date().toISOString(),
  });
  writeReport(auditReportFile, report);
  console.log(`\nWrote audit/report.md (${results.length} site(s)).`);
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  },
);
