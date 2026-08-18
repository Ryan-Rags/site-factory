import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { templateDir } from "./paths.js";

/**
 * Deploy one prospect's built site to its own Cloudflare Pages project.
 *
 * One project per prospect, served at the project root — the model
 * `scripts/deploy/deploy-mockups.mjs` settled on, and for its reason: the
 * template emits root-absolute hrefs, so a shared project with per-prospect
 * subpaths breaks internal navigation. The project name *is* the subdomain,
 * which is what makes `<slug>-preview.pages.dev` the clean per-prospect URL.
 */

const PROJECT_SUFFIX = "-preview";
/** Fallback when the name is already taken in someone else's account. */
const COLLISION_SUFFIX = "-rr";
const PRODUCTION_BRANCH = "main";

export function projectNameFor(slug: string): string {
  return `${slug}${PROJECT_SUFFIX}`;
}

function wrangler(args: string[]): { code: number | null; out: string } {
  const res = spawnSync("npx", ["wrangler", ...args], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return { code: res.status, out: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

/**
 * The project named by `PREVIEW_ORIGIN`, when the operator set one.
 *
 * An override that moves the build's stamp but not the deploy's target is not
 * an override, it is a new way to produce the same defect — and it produced it:
 * the first rebuild of c3m stamped the `-rr` host and `ensureProject` published
 * it to the derived `-preview` one, so the gate went red on our own fix. The
 * variable names where this demo lives; both halves have to read it.
 *
 * Only a `*.pages.dev` origin yields a project name. Anything else is left to
 * the derivation, because a Pages project name is the subdomain and there is
 * nothing to extract from a custom domain.
 */
function overrideProjectName(): string | null {
  const raw = (process.env["PREVIEW_ORIGIN"] ?? "").trim();
  if (raw === "") return null;
  let host: string;
  try {
    host = new URL(raw).hostname;
  } catch {
    return null;
  }
  return host.endsWith(".pages.dev") ? (host.split(".")[0] ?? null) : null;
}

function ensureProject(slug: string): { name: string; substituted: boolean } {
  const override = overrideProjectName();
  if (override !== null) {
    // Create it if it is not there, accept it if it is, and do NOT fall back to
    // another name: the operator named this one, and silently publishing
    // somewhere else is the whole failure being fixed.
    const res = wrangler([
      "pages",
      "project",
      "create",
      override,
      `--production-branch=${PRODUCTION_BRANCH}`,
    ]);
    if (res.code === 0 || /already exists/i.test(res.out)) {
      return { name: override, substituted: override !== projectNameFor(slug) };
    }
    throw new Error(
      `PREVIEW_ORIGIN names the Pages project "${override}", which could not be used:\n${res.out}`,
    );
  }

  const name = projectNameFor(slug);
  let res = wrangler(["pages", "project", "create", name, `--production-branch=${PRODUCTION_BRANCH}`]);
  if (res.code === 0) return { name, substituted: false };
  if (/already exists/i.test(res.out) && !/another account|not available|taken/i.test(res.out)) {
    return { name, substituted: false };
  }

  const fallback = `${name}${COLLISION_SUFFIX}`;
  res = wrangler(["pages", "project", "create", fallback, `--production-branch=${PRODUCTION_BRANCH}`]);
  if (res.code === 0 || /already exists/i.test(res.out)) return { name: fallback, substituted: true };

  throw new Error(`could not create a Pages project for ${slug}:\n${res.out}`);
}

/**
 * A new project's hostname takes a few seconds to start serving, so a single
 * failed request proves nothing.
 */
async function status(url: string, attempts = 6): Promise<string> {
  let last = "";
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (res.status === 200) return "200";
      last = String(res.status);
    } catch (err) {
      last = `error: ${(err as Error).message}`;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return last;
}

export interface DeployResult {
  project: string;
  url: string;
  /** HTTP status of the homepage and one internal page. */
  home: string;
  services: string;
  verified: boolean;
  substituted: boolean;
  /** Every absolute URL the published pages stamp names this origin, and the assets answer 200. */
  stampedOk: boolean;
  /** What the stamped-origin gate said, when it failed. */
  stampedProblems: string[];
}

/**
 * Run `check-stamped-origins.mjs` against what was just published.
 *
 * Spawned rather than imported: it is a template gate written in plain `.mjs`,
 * this is TypeScript in another package, and a spawn is the boundary
 * `buildSite` already uses for the same reason.
 *
 * THE ORIGIN IS PASSED IN, and that is the whole reason this catches what
 * nothing else did. Every other check derives the origin from the slug exactly
 * as the build does, so the two agree with each other and can be wrong
 * together — which is what happened to c3m. Here the input is the project name
 * wrangler actually deployed to, substitution included.
 */
function verifyStampedOrigins(
  slug: string,
  origin: string,
  distDir: string,
): { ok: boolean; problems: string[] } {
  const gate = join(templateDir, "scripts", "check-stamped-origins.mjs");
  const res = spawnSync(
    process.execPath,
    [gate, "--slug", slug, "--origin", origin, "--dist", distDir],
    { encoding: "utf8" },
  );
  if (res.status === 0) return { ok: true, problems: [] };
  const out = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  return {
    ok: false,
    problems: out
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== ""),
  };
}

export async function deploySite(slug: string, distDir: string): Promise<DeployResult> {
  const { name, substituted } = ensureProject(slug);

  const res = wrangler([
    "pages",
    "deploy",
    distDir,
    `--project-name=${name}`,
    `--branch=${PRODUCTION_BRANCH}`,
    "--commit-dirty=true",
  ]);
  if (res.code !== 0) throw new Error(`deploy failed for ${slug}:\n${res.out}`);

  // Verify (and hand out) the canonical project alias rather than the
  // per-deployment hash hostname: the alias is the URL the prospect is given,
  // and the hash host's certificate is not always issued by the time the
  // deploy command returns.
  const url = `https://${name}.pages.dev`;
  const home = await status(`${url}/`);
  const services = await status(`${url}/services/`);

  /*
   * The published bytes must name the host they were published to.
   *
   * Run unconditionally, not only when `substituted` is true. Substitution is
   * the cause we know about; "the artifact advertises somewhere else" is the
   * defect, and a gate that only fires on the one cause already recorded is a
   * gate that will miss the second one — a project pointed at another client's
   * dist, a stale build, an override typed wrong.
   */
  const stamped = verifyStampedOrigins(slug, url, distDir);

  return {
    project: name,
    url,
    home,
    services,
    verified: home === "200" && services === "200" && stamped.ok,
    substituted,
    stampedOk: stamped.ok,
    stampedProblems: stamped.problems,
  };
}
