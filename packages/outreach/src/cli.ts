#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { readCached, type AuditResult } from "@site-factory/audit";
import {
  leadsFile,
  outreachDir,
  outreachSkippedFile,
  readLeads,
  uniqueSlug,
} from "@site-factory/discover";

import { pitchBlocker, renderPitch, renderSkipped, type SkipReason } from "./pitch.js";

const USAGE = `Usage: pnpm outreach -- [options]

  --top <n>       Write pitches for the n highest-scoring audited leads. Default 3.
  --input <path>  Lead CSV to read slugs from. Default data/businesses.csv.
  --help

Reads audit/.cache/, not audit/report.md. Leads with fewer than two confirmed
findings are skipped and listed in outreach/skipped.md.`;

interface Args {
  top: number;
  input: string;
  help: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { top: 3, input: leadsFile, help: false };

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
      // pnpm forwards the `--` from `pnpm outreach -- --flag` verbatim.
      case "--":
        break;
      case "--top": {
        const n = Number(takeValue());
        if (!Number.isInteger(n) || n <= 0) throw new Error("--top expects a positive integer");
        args.top = n;
        break;
      }
      case "--input":
        args.input = takeValue();
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

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  const rows = readLeads(args.input);
  if (rows.length === 0) {
    console.error(`No leads in ${args.input}.`);
    return 1;
  }

  // Slugs are assigned exactly as the audit assigns them, in file order.
  const taken = new Set<string>();
  const audited: AuditResult[] = [];
  for (const row of rows) {
    const slug = uniqueSlug(row.name, taken);
    const cached = readCached(slug);
    if (cached) audited.push(cached);
  }

  if (audited.length === 0) {
    console.error("No audit results found. Run `pnpm audit-sites` first.");
    return 1;
  }

  const ranked = [...audited].sort((a, b) => b.score - a.score).slice(0, args.top);
  const skips: SkipReason[] = [];
  let written = 0;

  for (const result of ranked) {
    const blocker = pitchBlocker(result);
    if (blocker) {
      skips.push({ slug: result.slug, name: result.name, reason: blocker });
      console.log(`  ${result.slug}: skipped — ${blocker}`);
      continue;
    }

    const pitch = renderPitch(result);
    const dir = join(outreachDir, result.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "pitch.md"), pitch.markdown, "utf8");
    written += 1;
    console.log(
      `  ${result.slug}: pitch written (cites ${pitch.findingsUsed.map((f) => f.id).join(", ")})`,
    );
  }

  mkdirSync(outreachDir, { recursive: true });
  writeFileSync(outreachSkippedFile, renderSkipped(skips, new Date().toISOString()), "utf8");

  console.log(
    `\n${written} pitch(es) written, ${skips.length} skipped (see outreach/skipped.md).`,
  );
  return 0;
}

try {
  process.exitCode = main();
} catch (err: unknown) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
