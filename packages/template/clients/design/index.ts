/**
 * Design payload loader.
 *
 * Every per-prospect design is a `.json` file in this directory. It is data,
 * not code: the discovery pipeline should be able to emit one without writing
 * TypeScript, and a plain Node script (`check-contrast.mjs`) has to be able to
 * read one without a compile step.
 *
 * A JSON import tells the type system nothing — `"forge"` widens to `string`
 * and every field looks optional — so nothing here is trusted. `parseDesign()`
 * validates the blob against `DesignConfig` and fails the build with the path
 * of the offending field.
 *
 * Imports are static for the same reason `clients/index.ts` keeps its client
 * registry static: Vite resolves the import graph at analysis time, so a
 * computed `import(\`./\${slug}.design.json\`)` would neither narrow to a type
 * nor stay in the static graph.
 */
import { parseDesign } from '../../src/lib/design';
import { deriveDesign, type DesignBrief } from './derive';
import type { SiteConfig } from '../../src/types/site';
import type { DesignConfig, HeroVariant, ThemeSelection } from '../../src/types/design';

import ksWeldingRaw from './ks-welding.design.json';
import khBrief from './kh-machine-works.brief.json';
import ktsBrief from './kts-machine-shop.brief.json';
import amsBrief from './american-machine-specialty.brief.json';
import imcBrief from './industrial-machine-corp.brief.json';
import longNameBrief from './zz-fixture-long-name.brief.json';
import motionBrief from './zz-fixture-motion.brief.json';

/** The full-payload reference. Every field stated; nothing derived. */
export const ksWeldingDesign = parseDesign('ks-welding', ksWeldingRaw);

/**
 * The four clients that predate the design system, each on a brief.
 *
 * Their `SiteConfig` already holds reviewed, confirmed content — headlines,
 * service copy, testimonials with their `sourceNote` and `status` intact — so
 * the brief adds only what the design layer introduces and `deriveDesign()`
 * reads the rest. See `derive.ts` for why that is worth a second authoring
 * mode rather than five copies of the same sentences.
 */
const briefs: Record<string, DesignBrief> = {
  'kh-machine-works': khBrief as unknown as DesignBrief,
  'kts-machine-shop': ktsBrief as unknown as DesignBrief,
  'american-machine-specialty': amsBrief as unknown as DesignBrief,
  'industrial-machine-corp': imcBrief as unknown as DesignBrief,

  // Not a prospect. The header lockup's regression fixture, on the widest
  // display face in the matrix (Heritage's signwriter) so its shipped cell is
  // also its worst case. See `clients/zz-fixture-long-name.config.ts`.
  'zz-fixture-long-name': longNameBrief as unknown as DesignBrief,

  // Not a prospect. Where the motion axis is proved: the only build carrying
  // an autoplaying reviews rail, and the only one on `apex`. See
  // `clients/zz-fixture-motion.config.ts`.
  'zz-fixture-motion': motionBrief as unknown as DesignBrief,
};

export function designFor(slug: string, site: SiteConfig): DesignConfig {
  const brief = briefs[slug];
  if (!brief)
    throw new Error(
      `No design brief for "${slug}". Add clients/design/${slug}.brief.json and register it in clients/design/index.ts.`,
    );
  return deriveDesign(slug, site, brief);
}

/**
 * The same prospect, in a different family.
 *
 * Used only by the side-by-side comparison builds: `ks-welding-forge`,
 * `-precision` and `-heritage` are one business's confirmed content rendered
 * three ways, which is exactly the thing worth putting in front of a client.
 * Re-stating the whole payload three times would let the three drift apart
 * and quietly turn a design comparison into a copy comparison.
 *
 * The hero variant travels with the theme because it is a compositional
 * choice, not a content one, and because each preset lists its layouts in a
 * different order of preference.
 */
export function inFamily(
  design: DesignConfig,
  theme: ThemeSelection,
  heroVariant: HeroVariant,
): DesignConfig {
  return {
    ...design,
    theme,
    sections: {
      ...design.sections,
      hero: { ...design.sections.hero, variant: heroVariant },
    },
  };
}
