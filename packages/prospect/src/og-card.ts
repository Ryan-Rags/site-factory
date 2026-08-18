import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { Browser } from "playwright";

import { shootHtml } from "./browser.js";
import { dataUrl } from "./cards.js";
import { resolveTone, type DesignBlock } from "./design.js";
import { prospectPaths, templateDir } from "./paths.js";
import type { SiteConfig } from "./site-config.js";

/**
 * The 1200×630 social card for a generated demo.
 *
 * ## Why this exists at all
 *
 * Every unfurler declines SVG, and all 50 demos shipped `/images/og.svg` — so
 * 50 texted links arrived as bare URLs while the eight hand-authored clients
 * arrived as a picture. Issue #61, measured 6 of 6. `gen-brand-assets.mjs`
 * cannot help: it resolves a client out of `clients/<slug>.config.ts`, which a
 * generated demo does not have and will never get, because ingested
 * third-party data does not go in the repo.
 *
 * ## Why the drawing is not in here
 *
 * It is in `packages/template/scripts/lib/og-card.mjs`, which
 * `gen-brand-assets.mjs` also imports. A client's card and a prospect's card
 * are the same product photographed the same way; laid out twice they would
 * drift the first time either was retuned, and nobody would see it until both
 * were on a phone side by side.
 *
 * Loaded by absolute path through `pathToFileURL` rather than by specifier:
 * that module is a plain `.mjs` inside an Astro package with no exports map,
 * and this is TypeScript in another package. It is the same boundary
 * `ingest/seed.ts` already crosses for the copy engine — see `copyDistEntry`.
 *
 * ## Why it renders in the browser the run already has
 *
 * `runProspect` holds one Chromium open for palette extraction, both
 * screenshots and both printable cards. Shelling out to
 * `gen-brand-assets.mjs` per prospect would launch a second browser fifty more
 * times to draw markup this can call directly.
 */

/** The half of `og-card.mjs` this module uses. See its `.d.ts`. */
interface OgCardModule {
  OG_CARD_SIZE: { width: number; height: number };
  ogCardHtml: (info: {
    name: string;
    place: string;
    tagline: string;
    logoDataUri: string;
    palette: { base: string; ink: string; inkMuted: string };
    accent: string;
  }) => string;
}

let moduleCache: OgCardModule | undefined;

async function loadOgCard(): Promise<OgCardModule> {
  if (moduleCache === undefined) {
    const file = join(templateDir, "scripts", "lib", "og-card.mjs");
    moduleCache = (await import(pathToFileURL(file).href)) as OgCardModule;
  }
  return moduleCache;
}

/**
 * The prospect's OWN logo file, or `null` if they did not supply one.
 *
 * A card is screenshotted from a `setContent` page with no server behind it,
 * so a root-relative `src` resolves against nothing and the file has to be
 * found on disk and inlined.
 *
 * THE TEMPLATE'S `/images/logo.svg` IS DELIBERATELY NOT ACCEPTED HERE, and
 * that is the difference between this and the client generator. That file is
 * the stock placeholder mark — a "K" monogram — and a hand-authored client
 * ships it as a considered choice. A generated demo is a picture of somebody
 * else's business that we will text to them, and putting an unrelated
 * initial next to their town reads as a brand identity we invented for them.
 * The rule the whole pipeline runs on is that we do not assert what we were
 * not told; a logo is an assertion. Without one the card leads with the town
 * and the business name, both of which came from a source.
 *
 * Their own logo, when the operator dropped one in `prospects/<slug>/assets/`,
 * is theirs and is drawn.
 */
function ownLogoFile(slug: string, publicPath: string): string | null {
  if (!publicPath.startsWith("/prospect-assets/")) return null;
  return join(prospectPaths(slug).assetsDir, publicPath.slice("/prospect-assets/".length));
}

export interface OgCardInput {
  slug: string;
  /** The projected config, after `buildDesign` has written `site.design`. */
  site: SiteConfig;
  /** The design block, for the tone the demo actually renders in. */
  design: DesignBlock;
}

export interface OgCardResult {
  file: string;
  /** Worth printing in the run summary. */
  note: string;
}

/**
 * Draw one prospect's card and write it to `prospects/<slug>/cards/og.png`.
 *
 * Everything on it has already been through `project.ts`'s sourcing rules: the
 * business name, the town, and the tagline built from a sourced lead service
 * and a sourced place. Nothing new is asserted here — a card is a picture of
 * facts the page already carries.
 */
export async function renderOgCard(
  browser: Browser,
  input: OgCardInput,
  outFile: string,
): Promise<OgCardResult> {
  const { slug, site, design } = input;
  const { OG_CARD_SIZE, ogCardHtml } = await loadOgCard();
  const tone = resolveTone(design.theme);

  const logoPath = ownLogoFile(slug, site.brand.logo);
  const logoDataUri = logoPath ? (dataUrl(logoPath) ?? "") : "";

  const place = [site.business.address.locality, site.business.address.region]
    .filter(Boolean)
    .join(", ");

  const html = ogCardHtml({
    name: site.business.name,
    place,
    tagline: site.business.tagline,
    logoDataUri,
    palette: tone.palette,
    accent: tone.accent,
  });

  await shootHtml(browser, html, outFile, OG_CARD_SIZE);

  return {
    file: outFile,
    note:
      `card: ${OG_CARD_SIZE.width}×${OG_CARD_SIZE.height} og.png in ${design.theme.preset}'s ` +
      `${design.theme.scheme} tone on ${tone.accent}` +
      (logoDataUri === "" ? " — they supplied no logo, so it carries no mark" : ""),
  };
}
