#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BERGEN_MUNICIPALITIES } from "@site-factory/copy";
import {
  CallBudget,
  DISCOVERY_FIELD_MASK,
  UsageMeter,
  dataDir,
  requireApiKey,
} from "@site-factory/discover";

import { runAuditStage } from "./browser.js";
import { mergeScored, readScored, writeScored } from "./csv.js";
import { fixtureFetch } from "./fixture.js";
import {
  applyBackfill,
  planBackfill,
  readClientPlaceIds,
  renderBackfillPlan,
} from "./identity.js";
import { COPY_PACK_NICHE_SLUGS, NICHES, nicheBySlug, type Niche } from "./niches.js";
import { renderOrdering } from "./rank.js";
import { toScoredRow } from "./run.js";
import { renderHistogram, renderStatusTally, renderTop } from "./summary.js";
import { sweep } from "./sweep.js";

const DEFAULT_BUDGET = 250;
const DEFAULT_ENTERPRISE_BUDGET = 250;
const DEFAULT_AUDIT_CAP = 60;
const DEFAULT_PAGES = 1;
const TOP_N = 25;

const USAGE = `usage: pnpm sweep -- [options]

Sweeps Bergen County for leads, scores them, and writes the ranked call list
to data/prospects-scored.csv.

options:
  --niche <slug>         repeatable. Default: the three copy-pack niches
                         (${COPY_PACK_NICHE_SLUGS.join(", ")}).
                         All: ${NICHES.map((n) => n.slug).join(", ")}
  --town <name>          repeatable. Default: all ${BERGEN_MUNICIPALITIES.length} Bergen municipalities.
  --pages <n>            pages per (niche, town). Default ${DEFAULT_PAGES}. EACH follow-up
                         page is another Enterprise-tier call.
  --budget <n>           total Places calls this run may make. Default ${DEFAULT_BUDGET}.
  --budget-enterprise <n> ceiling on Enterprise-or-above calls. Default ${DEFAULT_ENTERPRISE_BUDGET}.
  --audit-cap <n>        live sites to audit. 0 = unlimited. Default ${DEFAULT_AUDIT_CAP}.
  --backfill-place-ids   write discovered place ids into lead rows matched by
                         slug fallback. Opt-in; prints the plan first.
  --dry-run              synthetic fixture, ZERO network calls and zero cost.
  --out <file>           output CSV. Default data/prospects-scored.csv
  --help

Discovery uses the official Places API only. One Text Search per (niche, town);
there is no second pass and nothing here calls Place Details.`;

interface Args {
  niches: string[];
  towns: string[];
  pages: number;
  budget: number;
  budgetEnterprise: number;
  auditCap: number;
  backfill: boolean;
  dryRun: boolean;
  out: string;
  help: boolean;
}

function parsePositiveInt(flag: string, value: string, allowZero = false): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || (!allowZero && n === 0)) {
    throw new Error(`${flag} expects a ${allowZero ? "non-negative" : "positive"} integer, got: ${value}`);
  }
  return n;
}

export function parseArgs(argv: readonly string[]): Args {
  const args: Args = {
    niches: [],
    towns: [],
    pages: DEFAULT_PAGES,
    budget: DEFAULT_BUDGET,
    budgetEnterprise: DEFAULT_ENTERPRISE_BUDGET,
    auditCap: DEFAULT_AUDIT_CAP,
    backfill: false,
    dryRun: false,
    out: "",
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i] as string;
    const takeValue = (): string => {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${flag} expects a value`);
      i += 1;
      return value;
    };

    switch (flag) {
      case "--":
        break;
      case "--niche":
        args.niches.push(takeValue());
        break;
      case "--town":
        args.towns.push(takeValue());
        break;
      case "--pages":
        args.pages = parsePositiveInt("--pages", takeValue());
        break;
      case "--budget":
        args.budget = parsePositiveInt("--budget", takeValue());
        break;
      case "--budget-enterprise":
        args.budgetEnterprise = parsePositiveInt("--budget-enterprise", takeValue(), true);
        break;
      case "--audit-cap":
        args.auditCap = parsePositiveInt("--audit-cap", takeValue(), true);
        break;
      case "--backfill-place-ids":
        args.backfill = true;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--out":
        args.out = takeValue();
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

export function resolveNiches(slugs: readonly string[]): Niche[] {
  const wanted = slugs.length > 0 ? slugs : [...COPY_PACK_NICHE_SLUGS];
  return wanted.map((slug) => {
    const niche = nicheBySlug(slug);
    if (!niche) {
      throw new Error(
        `Unknown --niche "${slug}". Known: ${NICHES.map((n) => n.slug).join(", ")}`,
      );
    }
    return niche;
  });
}

export function resolveTowns(names: readonly string[]): string[] {
  if (names.length === 0) return [...BERGEN_MUNICIPALITIES];
  return names.map((name) => {
    const hit = BERGEN_MUNICIPALITIES.find((t) => t.toLowerCase() === name.toLowerCase());
    if (!hit) throw new Error(`"${name}" is not a Bergen County municipality.`);
    return hit;
  });
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  const niches = resolveNiches(args.niches);
  const towns = resolveTowns(args.towns);
  const outFile = args.out || join(dataDir, "prospects-scored.csv");
  const runId = new Date().toISOString();

  const projected = niches.length * towns.length * args.pages;

  // ---- run header: everything the run will do, before it does any of it ----
  console.log(`site-factory sweep — run ${runId}`);
  console.log(`  niches:  ${niches.map((n) => n.slug).join(", ")}`);
  console.log(`  towns:   ${towns.length} municipalit${towns.length === 1 ? "y" : "ies"}`);
  console.log(`  queries: ${niches.length} x ${towns.length} x ${args.pages} page(s) = ${projected} projected call(s)`);
  console.log(`  budget:  ${args.budget} total, ${args.budgetEnterprise} Enterprise-or-above`);
  console.log(`  mask:    ${DISCOVERY_FIELD_MASK}`);
  console.log("           (Enterprise tier, knowingly: websiteUri and nationalPhoneNumber are");
  console.log("            Enterprise fields, and rating/userRatingCount ride along free.)");
  console.log(`  audit:   cap ${args.auditCap === 0 ? "unlimited" : args.auditCap}`);
  console.log(`  mode:    ${args.dryRun ? "DRY RUN — synthetic fixture, zero network calls" : "LIVE"}`);
  console.log("");

  if (projected > args.budget) {
    console.warn(
      `warning: ${projected} projected calls exceeds the ${args.budget} budget. The run will ` +
        "abort partway when the ceiling is reached; raise --budget or narrow --niche/--town.\n",
    );
  }

  const meter = new UsageMeter({ total: args.budget, enterprise: args.budgetEnterprise }, runId);
  const budget = new CallBudget(args.budget);

  const sweepOutcome = await sweep({
    niches,
    towns,
    apiKey: args.dryRun ? "dry-run-no-key" : requireApiKey(),
    meter,
    budget,
    pages: args.pages,
    fetchImpl: args.dryRun ? fixtureFetch(niches) : undefined,
    onQuery: (p) => {
      if (p.index % 10 === 0 || p.index === p.total) {
        process.stdout.write(`  swept ${p.index}/${p.total} (${p.niche.slug}/${p.town})\r`);
      }
    },
  });
  console.log(`\n  ${sweepOutcome.results.length} distinct business(es) from ${sweepOutcome.queries} call(s).`);

  // The mask that was actually emitted, asserted against the declared one.
  if (sweepOutcome.emittedMasks.length > 1) {
    throw new Error(
      `The sweep emitted ${sweepOutcome.emittedMasks.length} different field masks. It must emit exactly one.`,
    );
  }
  const emitted = sweepOutcome.emittedMasks[0];
  if (emitted !== undefined && emitted !== DISCOVERY_FIELD_MASK) {
    throw new Error(`The sweep emitted a mask that is not the declared sweep mask:\n  ${emitted}`);
  }

  for (const failure of sweepOutcome.failures) {
    console.warn(`  query failed: ${failure.niche}/${failure.town}: ${failure.reason}`);
  }

  // ---- assess -------------------------------------------------------------
  // `runAuditStage` owns the browser because it owns the DevTools port: the port
  // is opened at launch and handed to the audit, which is what lets Lighthouse
  // attach. A browser launched without one makes every Lighthouse-derived check
  // read `unavailable` and neglect compute over the probe checks alone —
  // silently, with a plausible number coming out the other end.
  console.log("");
  const outcome = await runAuditStage({
    results: sweepOutcome.results,
    auditCap: args.auditCap,
    clientPlaceIds: readClientPlaceIds(
      new URL("../client-place-ids.json", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    ),
    onStatus: (d: number, t: number) => {
      if (d % 10 === 0 || d === t) process.stdout.write(`  status ${d}/${t}\r`);
    },
    onAudit: (d, t, r) => process.stdout.write(`  audit ${d}/${t}: ${r.name}\r`.padEnd(78)),
  });
  console.log("");

  // ---- output -------------------------------------------------------------
  const rows = outcome.assessments.map(toScoredRow);
  const existing = readScored(outFile);
  const merged = mergeScored(existing, rows);
  writeScored(outFile, merged.text);

  const usageFile = join(dataDir, `usage-${runId.replace(/[:.]/g, "-")}.json`);
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(usageFile, JSON.stringify(meter.toJSON(), null, 2), "utf8");

  console.log("");
  console.log(renderOrdering(outcome.degradedRanking, outcome.assessments.filter((a) => a.status.status === "live").length));
  console.log("");
  console.log(renderStatusTally(outcome.assessments));
  console.log("");
  console.log(renderHistogram(outcome.assessments));
  console.log("");
  console.log(renderTop(outcome.assessments, TOP_N));
  console.log("");
  console.log(meter.renderSummary());
  console.log("");
  console.log(
    `${outFile}: +${merged.added} new, ${merged.refreshed} refreshed, ${merged.untouched} untouched.`,
  );
  if (merged.humanColumns.length > 0) {
    console.log(`  preserved human column(s): ${merged.humanColumns.join(", ")}`);
  }
  console.log(`usage log: ${usageFile}`);

  // ---- backfill -----------------------------------------------------------
  const plan = planBackfill(outcome.assessments);
  if (plan.planned.length > 0) {
    console.log("");
    console.log(renderBackfillPlan(plan));
    if (args.backfill) {
      const applied = applyBackfill(plan);
      console.log(`  backfilled ${applied.written} place_id cell(s).`);
    } else {
      console.log("  not written — pass --backfill-place-ids to apply.");
    }
  }

  const slugMatches = outcome.assessments.filter((a) => a.identity.how === "slug-fallback");
  if (slugMatches.length > 0) {
    console.log("");
    console.log(`${slugMatches.length} row(s) matched by name slug rather than place id:`);
    for (const a of slugMatches) console.log(`  ${a.identity.warning}`);
  }

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
