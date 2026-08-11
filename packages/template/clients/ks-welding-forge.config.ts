/**
 * K&S WELDING & FABRICATING — Forge family.
 *
 * One third of the design-system acceptance test: the same shop's confirmed
 * content rendered by all three families, so they can be compared side by
 * side on design alone. Not one word of copy differs between the three
 * builds — only the theme selection and the hero layout — which is the only
 * way the comparison means anything.
 *
 * These comparison builds are deliberately **customizer-free**, unlike
 * `ks-welding` itself. That build carries the preview panel and switches
 * families in the browser; this one is a static, single-theme, zero-extra-JS
 * proof that the family renders correctly without any of that machinery.
 *
 * `noindex`, like every mockup in this directory.
 */
import type { SiteConfig } from '../src/types/site';
import ksWelding from './ks-welding.config';
import { inFamily, ksWeldingDesign } from './design';

export const site: SiteConfig = {
  ...ksWelding,
  features: { ...ksWelding.features, customizer: false },
  // Its own social card: the three comparison builds are sent side by
  // side, so three identical unfurls would defeat the exercise.
  brand: { ...ksWelding.brand, ogImage: '/og/ks-welding-forge.png' },
  design: inFamily(
    ksWeldingDesign,
    { preset: 'forge', accent: 'ember', fontPairing: 'condensed-caps' },
    // Forge earns the full-bleed hero: the scrim is mixed from a near-black
    // base, so the copy stays legible over whatever photograph arrives.
    'full-bleed',
  ),
};

export default site;
