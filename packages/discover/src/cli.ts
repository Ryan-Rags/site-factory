#!/usr/bin/env node
import { appendLeads } from "./csv.js";
import { requireApiKey } from "./env.js";
import { leadsFile, noSiteFile } from "./paths.js";
import {
  CallBudget,
  MAX_RESULTS,
  loadFixture,
  placeToLead,
  searchText,
  type PlacesPlace,
} from "./places.js";
import type { LeadRow } from "./types.js";

const USAGE = `Usage: pnpm discover -- --niche <text> [options]

  --niche <text>     Search text, e.g. "machine shop". Required unless --dry-run.
  --near <lat,lng>   Bias results around a point, e.g. --near "29.76,-95.37".
  --radius <metres>  Radius for --near. Default 5000.
  --max <n>          Results to keep. Capped at ${MAX_RESULTS} (the API ceiling).
  --city <label>     Label written to the city column for every row this run.
  --dry-run          Use the checked-in fixture. Makes zero network calls.
  --help

Rows with a website go to data/businesses.csv; rows without go to
data/no-site.csv. Both are append-only and de-duped. Discovery uses the
official Places API only.`;

const DEFAULT_MAX = 20;

interface Args {
  niche: string;
  near: { lat: number; lng: number } | undefined;
  radius: number | undefined;
  max: number;
  city: string;
  dryRun: boolean;
  help: boolean;
}

function parseNear(value: string): { lat: number; lng: number } {
  const parts = value.split(",").map((p) => Number(p.trim()));
  const [lat, lng] = parts;
  if (parts.length !== 2 || lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`--near expects "lat,lng", got: ${value}`);
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error(`--near is out of range: ${value}`);
  }
  return { lat, lng };
}

function parsePositiveInt(flag: string, value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${flag} expects a positive integer, got: ${value}`);
  }
  return n;
}

export function parseArgs(argv: readonly string[]): Args {
  const args: Args = {
    niche: "",
    near: undefined,
    radius: undefined,
    max: DEFAULT_MAX,
    city: "",
    dryRun: false,
    help: false,
  };

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
      // pnpm forwards the `--` from `pnpm discover -- --flag` verbatim.
      case "--":
        break;
      case "--niche":
        args.niche = takeValue();
        break;
      case "--near":
        args.near = parseNear(takeValue());
        break;
      case "--radius":
        args.radius = parsePositiveInt("--radius", takeValue());
        break;
      case "--max":
        args.max = Math.min(parsePositiveInt("--max", takeValue()), MAX_RESULTS);
        break;
      case "--city":
        args.city = takeValue();
        break;
      case "--dry-run":
        args.dryRun = true;
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

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  const discoveredAt = new Date().toISOString();
  let places: PlacesPlace[];
  let source: string;

  if (args.dryRun) {
    const fixture = loadFixture();
    places = (fixture.places ?? []).slice(0, args.max);
    source = "places-fixture";
    console.log(
      `dry run: ${places.length} place(s) from the checked-in fixture, 0 network calls.`,
    );
  } else {
    if (!args.niche.trim()) {
      throw new Error(`--niche is required for a live run.\n\n${USAGE}`);
    }
    const budget = new CallBudget();
    places = await searchText({
      niche: args.niche,
      near: args.near,
      radius: args.radius,
      max: args.max,
      apiKey: requireApiKey(),
      budget,
    });
    source = "places";
    console.log(
      `${places.length} place(s) from the Places API in ${budget.spent} call(s).`,
    );
  }

  const toLead = { niche: args.niche, city: args.city, source, discoveredAt };
  const withSite: LeadRow[] = [];
  const withoutSite: LeadRow[] = [];
  for (const place of places) {
    const row = placeToLead(place, toLead);
    if (row.url.trim()) withSite.push(row);
    else withoutSite.push(row);
  }

  const leads = appendLeads(leadsFile, withSite);
  const noSite = appendLeads(noSiteFile, withoutSite);

  console.log(
    `data/businesses.csv  +${leads.added} new, ${leads.duplicates} duplicate(s), ${leads.total} total`,
  );
  console.log(
    `data/no-site.csv     +${noSite.added} new, ${noSite.duplicates} duplicate(s), ${noSite.total} total`,
  );
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
