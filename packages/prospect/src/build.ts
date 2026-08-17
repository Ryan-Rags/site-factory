import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";

import { prospectPaths, templateDir } from "./paths.js";
import type { FolderAssets } from "./ingest/folder.js";

/**
 * Build one prospect's site through the template's own build script.
 *
 * `pnpm -C packages/template build` rather than `astro build` directly, so the
 * marker gate runs on the generated output exactly as it does on a
 * hand-authored client. The two env vars are the contract added to
 * `clients/index.ts`: `SITE_CONFIG_FILE` supplies the config, `SITE_CLIENT`
 * names `dist/<slug>/`.
 */
export interface BuildResult {
  ok: boolean;
  output: string;
  distDir: string;
}

/**
 * @param formEndpoint the shared demo Worker URL, or `''` for none.
 *
 *   Passed explicitly rather than inherited from `process.env`, because it may
 *   have come from `.env.deploy`, which the spawned build does not read.
 *   `site.config.ts` reads `DEMO_FORM_ENDPOINT` from its own environment to
 *   decide whether the form sends a `prospectId`, so a build without it renders
 *   a form the Worker answers 422 to — a config that says `worker` and a build
 *   that sends no id are exactly the disagreement `check-form-fields.mjs` was
 *   written about.
 */
export function buildSite(slug: string, siteConfigFile: string, formEndpoint = ""): BuildResult {
  const res = spawnSync("pnpm", ["-C", templateDir, "build"], {
    encoding: "utf8",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      SITE_CLIENT: slug,
      SITE_CONFIG_FILE: siteConfigFile,
      ...(formEndpoint === "" ? {} : { DEMO_FORM_ENDPOINT: formEndpoint }),
    },
  });
  return {
    ok: res.status === 0,
    output: `${res.stdout ?? ""}${res.stderr ?? ""}`,
    distDir: prospectPaths(slug).distDir,
  };
}

/**
 * Public paths for the prospect's own images, decided *before* the build.
 *
 * The files themselves are copied in afterwards (Astro empties `dist/`), so
 * the naming has to be predictable rather than discovered. `/prospect-assets/`
 * is used instead of the template's `public/` directory for the same reason
 * the generated content is temporary: their photos are third-party data and do
 * not belong inside another stream's package.
 */
export interface AssetPlan {
  logo?: string;
  photos: string[];
}

export function planAssets(assets: FolderAssets): AssetPlan {
  const plan: AssetPlan = { photos: assets.photos.map((p) => `/prospect-assets/${basename(p.file ?? p.ref)}`) };
  if (assets.logo) plan.logo = `/prospect-assets/${basename(assets.logo)}`;
  return plan;
}

/** Copy the planned assets into the built site. Returns what was copied. */
export function copyAssets(slug: string, assets: FolderAssets): string[] {
  const files = [assets.logo, ...assets.photos.map((p) => p.file)].filter(
    (f): f is string => typeof f === "string" && existsSync(f),
  );
  if (files.length === 0) return [];

  const target = join(prospectPaths(slug).distDir, "prospect-assets");
  mkdirSync(target, { recursive: true });
  const copied: string[] = [];
  for (const file of files) {
    const to = join(target, basename(file));
    copyFileSync(file, to);
    copied.push(basename(file));
  }
  return copied;
}
