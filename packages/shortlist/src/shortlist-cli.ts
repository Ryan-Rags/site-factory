#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";

import { dataDir } from "@site-factory/discover";

import { readScored } from "./csv.js";
import { USAGE, isOfferable, parseArgs, render, select } from "./shortlist.js";

/**
 * The entry point, kept apart from the logic in `shortlist.ts` so that
 * importing this package never executes a CLI. `index.ts` re-exports the pure
 * functions; only this file has a side effect, and only when run directly.
 */
function main(): number {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  const file = args.file || join(dataDir, "prospects-scored.csv");
  if (!existsSync(file)) {
    console.error(`${file} does not exist. Run the sweep first: pnpm sweep -- --dry-run`);
    return 1;
  }

  const existing = readScored(file);
  const rows = [...existing.rows.values(), ...existing.orphans];
  console.log(render(select(rows, args), args));

  // What the gate held back is always stated. A filter that silently shrinks a
  // list teaches the reader the list is complete when it is not.
  if (!args.includeMismatches) {
    const withheld = rows.filter((r) => !isOfferable(r["nicheMatch"] ?? "")).length;
    if (withheld > 0) {
      console.log("");
      console.log(
        `${withheld} row(s) withheld — their Places types contradict the niche that found them,\n` +
          "or they predate type persistence and were never judged. They are still in the file.\n" +
          "  --include-mismatches to list them.",
      );
    }
  }
  return 0;
}

process.exitCode = main();
