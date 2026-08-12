import { readFileSync } from 'node:fs';

import type { SiteConfig } from '../src/types/site';

import khMachineWorks from './kh-machine-works.config';
import ktsMachineShop from './kts-machine-shop.config';
import americanMachineSpecialty from './american-machine-specialty.config';
import industrialMachineCorp from './industrial-machine-corp.config';
import ksWelding from './ks-welding.config';
import ksWeldingForge from './ks-welding-forge.config';
import ksWeldingPrecision from './ks-welding-precision.config';
import ksWeldingHeritage from './ks-welding-heritage.config';

/**
 * Every buildable client, keyed by slug.
 *
 * Imports are static on purpose. Astro's config is loaded by Vite, which
 * resolves imports at analysis time — a dynamic `import(`./${slug}.config`)`
 * would not narrow to a type and would break the build's static graph. The
 * cost of listing clients here is one line each; the benefit is that a typo
 * in a slug is a compile error rather than a mystery at runtime.
 *
 * The slug is also the output directory (`dist/<slug>/`) and the key the
 * mockup bridge uses to find `audit/out/<slug>/` screenshots, so it must
 * match the discovery pipeline's slug for that business exactly.
 */
export const clients = {
  'kh-machine-works': khMachineWorks,
  'kts-machine-shop': ktsMachineShop,
  'american-machine-specialty': americanMachineSpecialty,
  'industrial-machine-corp': industrialMachineCorp,
  'ks-welding': ksWelding,

  // The design-system acceptance test: one shop, three families, identical
  // content. See clients/ks-welding-forge.config.ts for why they exist
  // alongside `ks-welding` rather than replacing it.
  'ks-welding-forge': ksWeldingForge,
  'ks-welding-precision': ksWeldingPrecision,
  'ks-welding-heritage': ksWeldingHeritage,
} satisfies Record<string, SiteConfig>;

export type ClientSlug = keyof typeof clients;

/** The client built when nothing selects one. */
export const DEFAULT_CLIENT: ClientSlug = 'kh-machine-works';

export const CLIENT_SLUGS = Object.keys(clients) as ClientSlug[];

export function isClientSlug(value: string): value is ClientSlug {
  return Object.prototype.hasOwnProperty.call(clients, value);
}

/**
 * Resolve the client to build.
 *
 * Selection is by `SITE_CLIENT` env var rather than a CLI flag: `astro build`
 * owns its own argv, so an extra `--client` flag would have to be stripped
 * before handing off. An env var passes through `pnpm build:client` cleanly
 * and is equally visible in CI.
 *
 * An unknown slug is a hard error listing the valid ones — silently falling
 * back to the default would ship the wrong client's site under the right
 * client's name.
 */
export function resolveClient(slug: string | undefined = process.env.SITE_CLIENT): {
  slug: string;
  site: SiteConfig;
} {
  /**
   * Generated-config escape hatch, used by the demo pipeline
   * (`packages/prospect`): `SITE_CONFIG_FILE` points at a JSON `SiteConfig`
   * on disk and `SITE_CLIENT` names the output directory.
   *
   * It exists so a generated prospect site never has to be written into
   * `clients/` — the five configs there are hand-authored and carry the
   * provenance of every value they hold, and a generator that overwrote one
   * would destroy that record. Ingested third-party data stays outside the
   * repo (`prospects/` is gitignored) and only ever reaches the build as this
   * file path.
   *
   * JSON rather than a module on purpose: the file is read at config-load
   * time, and a runtime `import()` of an arbitrary absolute path is not
   * something Vite's static graph can resolve.
   */
  const generated = process.env.SITE_CONFIG_FILE;
  if (generated !== undefined && generated !== '') {
    if (slug === undefined || slug === '') {
      throw new Error('SITE_CONFIG_FILE is set but SITE_CLIENT is not. Set both: SITE_CLIENT names the dist/<slug> output directory.');
    }
    let site: SiteConfig;
    try {
      site = JSON.parse(readFileSync(generated, 'utf8')) as SiteConfig;
    } catch (err) {
      throw new Error(`SITE_CONFIG_FILE "${generated}" could not be read as JSON: ${(err as Error).message}`);
    }
    return { slug, site };
  }

  if (slug === undefined || slug === '') {
    return { slug: DEFAULT_CLIENT, site: clients[DEFAULT_CLIENT] };
  }
  if (!isClientSlug(slug)) {
    throw new Error(
      `Unknown client "${slug}". Known clients: ${CLIENT_SLUGS.join(', ')}.\n` +
        `Add clients/${slug}.config.ts and register it in clients/index.ts.`,
    );
  }
  return { slug, site: clients[slug] };
}
