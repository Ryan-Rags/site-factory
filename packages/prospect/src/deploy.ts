import { spawnSync } from "node:child_process";

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

function ensureProject(slug: string): { name: string; substituted: boolean } {
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

  return {
    project: name,
    url,
    home,
    services,
    verified: home === "200" && services === "200",
    substituted,
  };
}
