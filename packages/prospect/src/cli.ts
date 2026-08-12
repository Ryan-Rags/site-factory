#!/usr/bin/env node
import { withBrowser } from "./browser.js";
import { knownProspects, printSummary, runProspect } from "./run.js";
import { checkSchemaDrift } from "./site-config.js";
import type { ThemePreset } from "./types.js";

/**
 * One command:
 *
 *   pnpm demo -- --prospect <id>
 *
 * Ingest the prospect, generate their site, deploy it to its own Cloudflare
 * Pages project, and write the two cards. `--all` runs every prospect the repo
 * knows about, which is the acceptance test.
 */

const USAGE = `
usage: pnpm demo -- --prospect <id> [options]
       pnpm demo -- --all [options]

options:
  --prospect <id>    prospect slug; repeatable
  --all              every prospect in packages/template/clients/ and prospects/
  --niche <text>     override the niche (drives the generated palette + preset)
  --preset <name>    force a design family: forge | precision | heritage
  --skip-ingest      reuse prospects/<id>/prospect.json as it stands
  --skip-places      do not call the Places API even if a key is configured
  --skip-website     do not read the prospect's current website
  --skip-deploy      build, shoot and card, but do not touch Cloudflare
  --list             print the known prospect ids and exit
`.trim();

const PRESETS: ThemePreset[] = ["forge", "precision", "heritage"];

interface Args {
  ids: string[];
  all: boolean;
  list: boolean;
  niche?: string;
  preset?: ThemePreset;
  skipIngest: boolean;
  skipPlaces: boolean;
  skipWebsite: boolean;
  skipDeploy: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    ids: [],
    all: false,
    list: false,
    skipIngest: false,
    skipPlaces: false,
    skipWebsite: false,
    skipDeploy: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = (): string => {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`${flag} needs a value`);
      i += 1;
      return value;
    };
    switch (flag) {
      // pnpm 9 forwards the `--` separator through to the script verbatim.
      case "--":
        break;
      case "--prospect":
        args.ids.push(next());
        break;
      case "--all":
        args.all = true;
        break;
      case "--list":
        args.list = true;
        break;
      case "--niche":
        args.niche = next();
        break;
      case "--preset": {
        const value = next();
        if (!PRESETS.includes(value as ThemePreset)) {
          throw new Error(`unknown preset "${value}". Known: ${PRESETS.join(", ")}`);
        }
        args.preset = value as ThemePreset;
        break;
      }
      case "--skip-ingest":
        args.skipIngest = true;
        break;
      case "--skip-places":
        args.skipPlaces = true;
        break;
      case "--skip-website":
        args.skipWebsite = true;
        break;
      case "--skip-deploy":
        args.skipDeploy = true;
        break;
      case "-h":
      case "--help":
        console.log(USAGE);
        process.exit(0);
        break;
      default:
        throw new Error(`unknown argument: ${flag}`);
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    for (const id of knownProspects()) console.log(id);
    return;
  }

  const ids = args.all ? knownProspects() : args.ids;
  if (ids.length === 0) {
    console.error(USAGE);
    process.exit(2);
  }

  // The template's SiteConfig is edited by several streams. If it has grown a
  // field this package does not emit, say so before building five sites with a
  // hole in each.
  const drift = checkSchemaDrift();
  for (const warning of drift.warnings) console.warn(`warning: schema drift — ${warning}`);
  if (drift.errors.length > 0) {
    console.error("\nSiteConfig has changed in a way this package cannot satisfy:");
    for (const error of drift.errors) console.error(`  ${error}`);
    console.error("\nUpdate packages/prospect/src/site-config.ts and project.ts, then re-run.");
    process.exit(1);
  }

  const failures: string[] = [];
  await withBrowser(async (browser) => {
    for (const id of ids) {
      console.log(`\n> ${id}`);
      try {
        const result = await runProspect(browser, {
          id,
          niche: args.niche,
          preset: args.preset,
          skipIngest: args.skipIngest,
          skipPlaces: args.skipPlaces,
          skipWebsite: args.skipWebsite,
          skipDeploy: args.skipDeploy,
        });
        printSummary(result.manifest);
        if (!result.ok) {
          failures.push(id);
          console.error(result.error ?? `${id} did not complete`);
        }
      } catch (err) {
        failures.push(id);
        console.error(`  FAILED: ${(err as Error).message}`);
      }
    }
  });

  if (failures.length > 0) {
    console.error(`\n${failures.length} prospect(s) failed: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log(`\n${ids.length} prospect(s) complete.`);
}

main().catch((err: unknown) => {
  console.error((err as Error).message);
  process.exit(1);
});
