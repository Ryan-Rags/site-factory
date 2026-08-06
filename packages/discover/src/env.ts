import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "./paths.js";

/**
 * Minimal `.env` reader. Node 20 can do this itself with `--env-file`, but
 * parsing it here keeps the CLI invocable as a plain `node dist/cli.js` with
 * no launcher flags, and adds no dependency.
 */
export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

export function loadEnv(file: string = join(repoRoot, ".env")): Record<string, string> {
  if (!existsSync(file)) return {};
  return parseEnv(readFileSync(file, "utf8"));
}

/**
 * The Places key, from the process environment or `.env`. Throws rather than
 * proceeding: a missing key means the live path cannot run, and inventing one
 * or falling back to scraping is prohibited.
 */
export function requireApiKey(): string {
  const fromProcess = process.env["GOOGLE_MAPS_API_KEY"];
  if (fromProcess && fromProcess.trim()) return fromProcess.trim();

  const fromFile = loadEnv()["GOOGLE_MAPS_API_KEY"];
  if (fromFile && fromFile.trim()) return fromFile.trim();

  throw new Error(
    "GOOGLE_MAPS_API_KEY is not set. Copy .env.example to .env and add a Places API key, " +
      "or use --dry-run to exercise the pipeline against the checked-in fixture.",
  );
}
