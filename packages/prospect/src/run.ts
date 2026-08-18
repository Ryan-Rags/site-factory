import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Browser } from "playwright";

import { buildSite, copyAssets, planAssets } from "./build.js";
import { renderComparisonCard, renderQrCard } from "./cards.js";
import { ensureContent } from "./content.js";
import { deploySite, projectNameFor } from "./deploy.js";
import { ingestProspect, type IngestOptions } from "./ingest/index.js";
import { readFolder } from "./ingest/folder.js";
import { findPlaceId } from "./ingest/leads.js";
import { resolveFormEndpoint } from "./form-endpoint.js";
import { loadClientConfig } from "./ingest/seed.js";
import { knownProspectsFile, prospectPaths, prospectsDir, templateClientsDir } from "./paths.js";
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
import { known, valueOf } from "./types.js";

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
      /*
       * One field is filled even on a reuse: the place id.
       *
       * `--skip-ingest` exists so a re-run costs nothing and changes nothing,
       * and this does not violate that — it is a file read of a CSV already on
       * disk, not a Places call, and it only ever fills a field that is
       * `unavailable`. It is here rather than in `ingestProspect` because the
       * records that need it are precisely the ones that will never be
       * re-ingested: re-ingesting the 2026-08-16 batch under the call freeze
       * would blank the reviews, rating and photos they already carry.
       *
       * Without it the accent rotation in `design.ts` would silently fall back
       * to the slug for all 50, which is a worse design than the one that was
       * ruled on and would look identical in the output.
       */
      if (reused.placeId.status !== "known") {
        const found = findPlaceId(opts.id);
        if (found) {
          reused.placeId = known(found.placeId, "website", today(), `backfilled from data/${found.file}`);
          writeProspect(paths.configFile, reused);
          step(`ingest: place id backfilled from data/${found.file} (no Places call)`);
        } else {
          step(`ingest: no place id in any data/*.csv — design variety keys on the slug instead`);
        }
      }
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
  /*
   * Where this demo will be served from — and the one place a run can be told
   * that the answer is not the derived one.
   *
   * `projectNameFor(slug)` is a guess made before the deploy runs, and on
   * 2026-08-17 it was wrong for one prospect of fifty: `ensureProject` appends
   * a `-rr` suffix when the name is held in another account, which happens
   * after this line, so the config written below advertised a host that does
   * not resolve. Every absolute URL on that demo — the canonical, `og:url`,
   * the card and the graph — inherited it from `siteUrl` here.
   * `docs/known-issues.md` #13.
   *
   * `PREVIEW_ORIGIN` is the operator's correction, and it must move BOTH
   * halves: `siteUrl` (the identity claims) and the template's `cardOrigin`
   * (the fetched assets, via the build environment). Moving one and not the
   * other would produce a page whose canonical and card disagree about which
   * of our hosts is serving it, which is not an improvement on either being
   * wrong together. The deploy prints the exact command when it detects the
   * substitution it cannot prevent.
   */
  const previewOrigin = (process.env["PREVIEW_ORIGIN"] ?? "").trim();
  const projectName = projectNameFor(opts.id);
  const siteUrl = previewOrigin || `https://${projectName}.pages.dev`;
  if (previewOrigin) step(`origin: PREVIEW_ORIGIN overrides the derived host — ${previewOrigin}`);

  /*
   * The demo form endpoint, resolved once per prospect and passed to both the
   * projection and the build.
   *
   * Both, not either. The projection writes it into `forms.workerEndpoint` so
   * the generated config is an honest record of what the demo does; the build
   * gets it in the environment because `site.config.ts` reads `demoFormEndpoint`
   * directly to decide whether to send a `prospectId`, and a config that says
   * `worker` while the build sends no id would 422 every submission.
   */
  const formEndpoint = resolveFormEndpoint();
  step(
    formEndpoint.url === ""
      ? "forms: no DEMO_FORM_ENDPOINT in the environment or .env.deploy"
      : `forms: demo endpoint from ${formEndpoint.source}`,
  );

  const projection = await timed("project", () =>
    projectToSite(prospect, {
      siteUrl,
      seed: seed ?? undefined,
      assetPaths: assetPlan,
      formEndpoint: formEndpoint.url,
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
      return buildSite(opts.id, paths.siteConfigFile, formEndpoint.url);
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
        /*
         * A demo that serves perfectly and advertises another host is the
         * failure this reports. It is a warning rather than a step, because
         * the log scrolls and this one costs the link its unfurl, its
         * canonical and its structured data all at once — see the banner
         * `warnings` is printed under.
         */
        if (!deployed.stampedOk) {
          const problem =
            `${opts.id}: deployed to ${deployed.url}, but the published pages advertise a ` +
            `different origin. The demo works and its link is wrong.\n` +
            deployed.stampedProblems.map((line) => `      ${line}`).join("\n");
          warnings.push(problem);
          console.warn(`  WARNING: ${problem}`);
        }
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
 * Rewrite `packages/template/prospects/known.json` from the folders on disk.
 *
 * The registry has to be committed — a build gate reads it — while the records it
 * names are gitignored, so the two can only be kept in step by regenerating one
 * from the other. Doing that by hand means 50 lines a batch, which is 50 chances
 * to leave a slug out; a slug left out is a demo whose form 422s in front of the
 * prospect it was built for.
 *
 * Only slugs are written. Everything else about these businesses stays outside
 * the repo, and the `note` block explaining that is preserved from the existing
 * file rather than restated here, so the prose lives in the file a reader opens.
 */
export function emitKnownProspects(): { file: string; added: string[]; removed: string[] } {
  const onDisk = existsSync(prospectsDir)
    ? readdirSync(prospectsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];

  const existing = existsSync(knownProspectsFile)
    ? (JSON.parse(readFileSync(knownProspectsFile, "utf8")) as { note?: string[]; slugs?: string[] })
    : {};
  const before = existing.slugs ?? [];

  const doc = { note: existing.note ?? [], slugs: onDisk };
  writeFileSync(knownProspectsFile, `${JSON.stringify(doc, null, 2)}\n`, "utf8");

  return {
    file: knownProspectsFile,
    added: onDisk.filter((slug) => !before.includes(slug)),
    removed: before.filter((slug) => !onDisk.includes(slug)),
  };
}

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
