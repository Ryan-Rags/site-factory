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
 * The name this key has always had in the spec, and the one every caller
 * should be reading. It says what the key is *for* — discovery uses the
 * official Places API and nothing else — where `GOOGLE_MAPS_API_KEY` invites
 * the reader to assume a Maps key, and Maps is the surface CLAUDE.md forbids
 * touching.
 */
export const PLACES_KEY = "GOOGLE_PLACES_API_KEY";

/** Accepted for one release, with a warning. Remove after that. */
export const PLACES_KEY_DEPRECATED = "GOOGLE_MAPS_API_KEY";

export interface ResolvedApiKey {
  key: string;
  /** The variable it was actually found under. */
  from: typeof PLACES_KEY | typeof PLACES_KEY_DEPRECATED;
}

let warnedOnce = false;

/**
 * The Places key, under either name, or `null`.
 *
 * `GOOGLE_PLACES_API_KEY` wins wherever both are set. The old name still works
 * so that renaming the variable is the operator's decision and not a
 * precondition for this release running at all — a rename that breaks
 * everyone's `.env` on upgrade is how a tidy-up becomes an outage.
 *
 * The deprecation warning is printed once per process rather than once per
 * lookup: this is called from a loop over prospects, and a warning repeated
 * twelve times is a warning nobody reads.
 */
export function resolvePlacesApiKey(
  env: Record<string, string | undefined> = process.env,
  file: Record<string, string> = loadEnv(),
  warn: (message: string) => void = console.warn,
): ResolvedApiKey | null {
  const pick = (name: string): string | undefined => {
    const fromProcess = env[name];
    if (fromProcess && fromProcess.trim()) return fromProcess.trim();
    const fromFile = file[name];
    if (fromFile && fromFile.trim()) return fromFile.trim();
    return undefined;
  };

  const current = pick(PLACES_KEY);
  if (current !== undefined) return { key: current, from: PLACES_KEY };

  const legacy = pick(PLACES_KEY_DEPRECATED);
  if (legacy !== undefined) {
    if (!warnedOnce) {
      warnedOnce = true;
      warn(
        `warning: ${PLACES_KEY_DEPRECATED} is deprecated and will stop being read after ` +
          `this release. Rename it to ${PLACES_KEY} in your .env.`,
      );
    }
    return { key: legacy, from: PLACES_KEY_DEPRECATED };
  }

  return null;
}

/** Test seam: the once-per-process warning is process state. */
export function resetDeprecationWarning(): void {
  warnedOnce = false;
}

/**
 * The Places key, or a thrown error. A missing key means the live path cannot
 * run, and inventing one or falling back to scraping is prohibited.
 */
export function requireApiKey(): string {
  const resolved = resolvePlacesApiKey();
  if (resolved !== null) return resolved.key;

  throw new Error(
    `${PLACES_KEY} is not set. Copy .env.example to .env and add a Places API key, ` +
      "or use --dry-run to exercise the pipeline against the checked-in fixture.",
  );
}
