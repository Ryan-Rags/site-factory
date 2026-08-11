import { join } from "node:path";

import { repoRoot } from "@site-factory/discover";

/**
 * Every path the demo pipeline reads or writes.
 *
 * `prospects/` is generated, gitignored, third-party data — the same category
 * as `audit/` and `outreach/`, and ignored for the same reason.
 */
export const prospectsDir: string = join(repoRoot, "prospects");

export const templateDir: string = join(repoRoot, "packages", "template");
export const templateDistDir: string = join(templateDir, "dist");
export const templateContentDir: string = join(templateDir, "src", "content");
export const templateClientsDir: string = join(templateDir, "clients");

/** Where the audit package leaves its "before" screenshots. */
export const auditOutDir: string = join(repoRoot, "audit", "out");

export interface ProspectPaths {
  id: string;
  dir: string;
  /** Operator drop-box: logo.*, photo-*.* */
  assetsDir: string;
  /** The ingested prospect config. */
  configFile: string;
  /** The generated `SiteConfig` handed to the template via SITE_CONFIG_FILE. */
  siteConfigFile: string;
  /** Before/after screenshots for this prospect. */
  shotsDir: string;
  /** The printable PNGs. */
  cardsDir: string;
  /** The run manifest: live URL, card paths, every unavailable field. */
  manifestFile: string;
  /** The built site for this prospect. */
  distDir: string;
}

export function prospectPaths(id: string): ProspectPaths {
  const dir = join(prospectsDir, id);
  return {
    id,
    dir,
    assetsDir: join(dir, "assets"),
    configFile: join(dir, "prospect.json"),
    siteConfigFile: join(dir, "site.config.json"),
    shotsDir: join(dir, "shots"),
    cardsDir: join(dir, "cards"),
    manifestFile: join(dir, "demo.json"),
    distDir: join(templateDistDir, id),
  };
}

export { repoRoot };
