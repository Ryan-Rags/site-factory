import { slugify } from "@site-factory/discover";

import { NICHES } from "./niches.js";

/**
 * `pnpm shortlist` — print the demo batch command for the top N.
 *
 * It **prints**. It does not run anything, it makes no network calls, and it
 * writes nothing. Generating a batch of demos costs real time and touches real
 * businesses' pages, so the command to do it is something Ryan reads, edits if
 * he wants, and pastes — not something a convenience script fires off because
 * a flag was mistyped.
 */

const DEFAULT_TOP = 10;

export const USAGE = `usage: pnpm shortlist -- [--top <n>] [--niche <slug>] [--status <state>]

Reads data/prospects-scored.csv and prints (does not run) the demo batch
command for the highest-scoring prospects.

options:
  --top <n>        how many. Default ${DEFAULT_TOP}.
  --niche <slug>   filter by niche. ${NICHES.map((n) => n.slug).join(", ")}
  --status <state> filter by the status column. Default NEW.
  --file <path>    input CSV. Default data/prospects-scored.csv
  --help

Prints nothing but a command; it never runs it.`;

export interface Args {
  top: number;
  niche: string;
  status: string;
  file: string;
  help: boolean;
}

export function parseArgs(argv: readonly string[]): Args {
  const args: Args = { top: DEFAULT_TOP, niche: "", status: "NEW", file: "", help: false };

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
      case "--top": {
        const n = Number(takeValue());
        if (!Number.isInteger(n) || n <= 0) throw new Error("--top expects a positive integer");
        args.top = n;
        break;
      }
      case "--niche":
        args.niche = takeValue();
        break;
      case "--status":
        args.status = takeValue();
        break;
      case "--file":
        args.file = takeValue();
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

export interface ShortlistRow {
  placeId: string;
  name: string;
  niche: string;
  town: string;
  phone: string;
  score: number;
  reasons: string;
  copyPack: string;
  status: string;
  /** The id `pnpm demo` expects: the slug of the business name. */
  demoId: string;
}

/**
 * Select and rank. Filtering by niche accepts either the niche slug or the
 * label written in the CSV, because those differ (`welding-fabrication` vs
 * `welding/fabrication`) and expecting the operator to remember which is which
 * is how a convenience command stops being convenient.
 */
export function select(
  rows: readonly Record<string, string>[],
  args: { top: number; niche: string; status: string },
): ShortlistRow[] {
  const wantNiche = args.niche.trim().toLowerCase();
  const niche = NICHES.find((n) => n.slug === wantNiche);
  const acceptable = new Set(
    [wantNiche, niche?.label.toLowerCase(), niche?.slug].filter((s): s is string => Boolean(s)),
  );

  return rows
    .filter((r) => {
      if (args.status && (r["status"] ?? "").trim().toUpperCase() !== args.status.toUpperCase()) {
        return false;
      }
      if (wantNiche === "") return true;
      return acceptable.has((r["niche"] ?? "").trim().toLowerCase());
    })
    .map((r) => ({
      placeId: r["placeId"] ?? "",
      name: r["name"] ?? "",
      niche: r["niche"] ?? "",
      town: r["town"] ?? "",
      phone: r["phone"] ?? "",
      score: Number(r["score"] ?? 0) || 0,
      reasons: r["reasons"] ?? "",
      copyPack: r["copyPack"] ?? "",
      status: r["status"] ?? "",
      demoId: slugify(r["name"] ?? ""),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, args.top);
}

/** The command, exactly as `packages/prospect`'s CLI expects it. */
export function renderCommand(rows: readonly ShortlistRow[]): string {
  if (rows.length === 0) return "";
  return `pnpm demo -- ${rows.map((r) => `--prospect ${r.demoId}`).join(" ")}`;
}

export function render(rows: readonly ShortlistRow[], args: { niche: string; status: string }): string {
  if (rows.length === 0) {
    return (
      `No prospects matched (status=${args.status}${args.niche ? `, niche=${args.niche}` : ""}).\n` +
      "Run the sweep first: pnpm sweep -- --dry-run"
    );
  }

  const lines: string[] = [];
  lines.push(`Top ${rows.length}${args.niche ? ` — ${args.niche}` : ""} (status=${args.status})`);
  lines.push("");
  rows.forEach((r, i) => {
    lines.push(
      `${String(i + 1).padStart(3)}. [${String(r.score).padStart(3)}] ${r.name} — ${r.town}` +
        `${r.phone ? `  ${r.phone}` : "  (no phone)"}`,
    );
    if (r.reasons) lines.push(`      ${r.reasons}`);
  });

  const noPack = rows.filter((r) => r.copyPack === "");
  if (noPack.length > 0) {
    lines.push("");
    lines.push(
      `note: ${noPack.length} of these have no copy pack, so the demo falls back to the ` +
        "projection's own conservative copy.",
    );
  }

  lines.push("");
  lines.push("Demo batch command — NOT run. Copy it if you want it:");
  lines.push("");
  lines.push(`  ${renderCommand(rows)}`);
  lines.push("");
  lines.push(
    "The ids above are name slugs, which is what pnpm demo takes. Check they match " +
      "packages/template/clients/ before running a batch.",
  );
  return lines.join("\n");
}

export { DEFAULT_TOP };
