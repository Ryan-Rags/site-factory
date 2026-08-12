import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Browser } from "playwright";

import { buildSite, copyAssets, planAssets } from "./build.js";
import { renderComparisonCard, renderQrCard } from "./cards.js";
import { ensureContent } from "./content.js";
import { deploySite, projectNameFor } from "./deploy.js";
import { ingestProspect, type IngestOptions } from "./ingest/index.js";
import { readFolder } from "./ingest/folder.js";
import { loadClientConfig } from "./ingest/seed.js";
import { prospectPaths, prospectsDir, templateClientsDir } from "./paths.js";
import { projectToSite } from "./project.js";
import {
  buildManifest,
  printSummary,
  writeManifest,
  type DemoManifest,
  type RunTimings,
} from "./report.js";
import { readProspect, today, writeProspect } from "./schema.js";
import { serveDir } from "./serve.js";
import { captureAfter, captureBefore } from "./shots.js";
import { valueOf } from "./types.js";

/**
 * The whole pipeline for one prospect, in the order the steps depend on each
 * other. Every step is idempotent and re-runnable, and a failure late in the
 * run leaves the earlier artifacts on disk — a deploy that fails should not
 * cost you the build and the screenshots.
 */

export interface RunOptions extends IngestOptions {
  /** Reuse the prospect.json already on disk instead of re-ingesting. */
  skipIngest?: boolean;
  /** Build and shoot, but do not touch Cloudflare. */
  skipDeploy?: boolean;
}

export interface RunResult {
  manifest: DemoManifest;
  ok: boolean;
  /** Set when the run could not complete. */
  error?: string;
}

export async function runProspect(browser: Browser, opts: RunOptions): Promise<RunResult> {
  const paths = prospectPaths(opts.id);
  mkdirSync(paths.dir, { recursive: true });
  const log: string[] = [];
  const step = (message: string): void => {
    log.push(message);
    console.log(`  ${message}`);
  };
  /**
   * Degradations that must not be read as ordinary progress.
   *
   * Collected apart from `log` and reprinted under their own banner at the end
   * of the summary, because the log is long and scrolls: a run that quietly
   * built a worse demo looks exactly like a run that went fine if the only
   * evidence is one line forty lines up.
   */
  const warnings: string[] = [];

  /*
   * Stage timing.
   *
   * Recorded into the manifest rather than left to be read off a terminal:
   * "how long does a demo take" is a question asked days later about a run
   * nobody was watching, and the answer decides how many prospects an operator
   * can prepare before a morning of calls. Wall-clock on purpose — it includes
   * the deliberate one-second-per-navigation crawl delay and the Places round
   * trips, which are most of the elapsed time and all of the part that grows
   * with the number of prospects.
   */
  const timings: RunTimings = {
    ingest: 0,
    project: 0,
    build: 0,
    shots: 0,
    deploy: 0,
    cards: 0,
    total: 0,
  };
  const runStart = Date.now();
  const timed = async <T>(
    stage: keyof Omit<RunTimings, "total">,
    work: () => Promise<T> | T,
  ): Promise<T> => {
    const started = Date.now();
    try {
      return await work();
    } finally {
      timings[stage] += Date.now() - started;
    }
  };

  // 1. ingest ---------------------------------------------------------------
  const prospect = await timed("ingest", async () => {
    if (opts.skipIngest && existsSync(paths.configFile)) {
      const reused = readProspect(paths.configFile);
      step(`ingest: reused ${paths.configFile}`);
      return reused;
    }
    const result = await ingestProspect(browser, opts);
    for (const entry of result.log) step(`ingest: ${entry}`);
    for (const entry of result.warnings) {
      warnings.push(entry);
      // Said once here as it happens, and again in the summary. A warning that
      // only appears in one of those is a warning somebody misses.
      console.warn(`  WARNING: ${entry}`);
    }
    writeProspect(paths.configFile, result.prospect);
    return result.prospect;
  });

  // 2. project onto the template's config -----------------------------------
  const seed = await loadClientConfig(opts.id);
  const assets = readFolder(paths.assetsDir);
  const assetPlan = planAssets(assets);
  const projectName = projectNameFor(opts.id);
  const siteUrl = `https://${projectName}.pages.dev`;

  const projection = await timed("project", () =>
    projectToSite(prospect, {
      siteUrl,
      seed: seed ?? undefined,
      assetPaths: assetPlan,
    }),
  );
  for (const note of projection.notes) step(`project: ${note}`);

  // Everything the manifest needs to describe this run, whatever happens next.
  // Assembled here so the failed-build path reports the same facts as the
  // successful one — a demo that failed to build is exactly when you want to
  // know which copy pack ran and what the site status was.
  const manifestExtras = {
    copy: {
      pack: projection.copy.pack,
      notes: projection.copy.notes,
      droppedQuestions: projection.copy.droppedQuestions,
      seoWarnings: projection.copy.seoWarnings,
    },
    site: projection.site,
    timings,
  };
  writeFileSync(paths.siteConfigFile, `${JSON.stringify(projection.site, null, 2)}\n`, "utf8");

  // 3. build ----------------------------------------------------------------
  const content = ensureContent(opts.id, projection.site, projection.site.about.entry);
  if (content.created.length > 0) {
    step(`content: generated ${content.created.length} temporary markdown file(s) for the build`);
  } else {
    step(`content: reused ${content.reused.length} existing markdown file(s)`);
  }

  const built = await timed("build", () => {
    try {
      return buildSite(opts.id, paths.siteConfigFile);
    } finally {
      // Always clean up, including when the build throws: the template package
      // must be left exactly as it was found.
      content.cleanup();
    }
  });

  if (!built.ok) {
    const manifest = buildManifest({
      prospect,
      liveUrl: null,
      project: null,
      verified: false,
      qrCard: null,
      comparisonCard: null,
      before: { source: "none", reason: "the build failed, so no comparison was made" },
      after: {},
      log,
      warnings,
      ...manifestExtras,
      timings: { ...timings, total: Date.now() - runStart },
    });
    writeManifest(paths.manifestFile, manifest);
    return {
      manifest,
      ok: false,
      error: `build failed for ${opts.id}:\n${built.output.slice(-2000)}`,
    };
  }
  step(`build: dist/${opts.id}`);

  // The template's `build` script is `astro build` followed by the marker,
  // fabrication, contrast and contact-link gates, so a zero exit means all
  // four passed on the *generated* config exactly as they do on a
  // hand-authored one. Worth saying out loud: "the gates ran and passed" is
  // the single most reassuring line in this output, and it was being swallowed
  // because the build only printed on failure.
  for (const line of built.output.split(/\r?\n/)) {
    if (line.startsWith("✓") || line.includes("contrast checks passed")) step(`gate: ${line.trim()}`);
  }

  const copied = copyAssets(opts.id, assets);
  if (copied.length > 0) step(`assets: copied ${copied.length} file(s) into the build`);

  // 4. screenshots -----------------------------------------------------------
  const after = await timed("shots", async () => {
    const server = await serveDir(built.distDir);
    try {
      return await captureAfter(browser, server.origin, paths.shotsDir);
    } finally {
      await server.close();
    }
  });
  step(`after: ${[after.desktop, after.mobile].filter(Boolean).length} shot(s)`);

  const currentUrl = valueOf(prospect.currentSiteUrl);
  const before = await timed("shots", () =>
    captureBefore(browser, opts.id, currentUrl, paths.shotsDir),
  );
  step(
    before.desktop
      ? `before: ${before.source === "audit-cache" ? "reused audit screenshots" : "captured from their live site"}`
      : `before: none — ${before.reason ?? "no reason recorded"}`,
  );

  // 5. deploy ----------------------------------------------------------------
  let liveUrl: string | null = null;
  let project: string | null = null;
  let verified = false;
  if (opts.skipDeploy) {
    step("deploy: skipped (--skip-deploy)");
  } else {
    await timed("deploy", async () => {
      try {
        const deployed = await deploySite(opts.id, built.distDir);
        liveUrl = deployed.url;
        project = deployed.project;
        verified = deployed.verified;
        step(
          `deploy: ${deployed.url}  home=${deployed.home} services=${deployed.services}` +
            (deployed.substituted ? "  (project name substituted)" : ""),
        );
      } catch (err) {
        step(`deploy: FAILED — ${(err as Error).message}`);
      }
    });
  }

  // 6. cards ------------------------------------------------------------------
  const colors = valueOf(prospect.brand.colors) ?? projection.site.theme.colors;
  const businessName = projection.site.business.name;
  const cardUrl = liveUrl ?? siteUrl;

  const qrCard = join(paths.cardsDir, "qr-card.png");
  const comparisonCard = join(paths.cardsDir, "before-after.png");
  await timed("cards", async () => {
    await renderQrCard(
      browser,
      {
        businessName,
        url: cardUrl,
        phone: projection.site.business.phone || undefined,
        colors,
      },
      qrCard,
    );

    await renderComparisonCard(
      browser,
      {
        businessName,
        before,
        after,
        currentUrl,
        demoUrl: cardUrl,
        colors,
        capturedOn: today(),
      },
      comparisonCard,
    );
  });
  step(`cards: qr-card.png, before-after.png`);

  timings.total = Date.now() - runStart;
  const manifest = buildManifest({
    prospect,
    liveUrl,
    project,
    verified,
    qrCard,
    comparisonCard,
    before,
    after,
    log,
    warnings,
    ...manifestExtras,
  });
  writeManifest(paths.manifestFile, manifest);
  return { manifest, ok: true };
}

export { printSummary };

/**
 * Every prospect this repo knows about: the hand-authored client configs, plus
 * any folder someone has created under `prospects/`.
 */
export function knownProspects(): string[] {
  const ids = new Set<string>();
  if (existsSync(templateClientsDir)) {
    for (const file of readdirSync(templateClientsDir)) {
      const match = file.match(/^(.+)\.config\.ts$/);
      if (match?.[1]) ids.add(match[1]);
    }
  }
  if (existsSync(prospectsDir)) {
    for (const entry of readdirSync(prospectsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) ids.add(entry.name);
    }
  }
  return [...ids].sort();
}
