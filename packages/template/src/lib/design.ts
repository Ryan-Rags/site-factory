/**
 * Loading, validating and tokenising a design config.
 *
 * The design payload arrives as JSON, so TypeScript can say nothing useful
 * about it on its own: a JSON import widens `"forge"` to `string` and knows
 * nothing about which fields are required. Everything below exists to turn
 * that untyped blob into a `DesignConfig` — or to fail the build with a
 * message that names the offending path.
 *
 * Failing loudly is the point. A design config with a typo'd family silently
 * falling back to a default would ship the wrong skin under the right
 * client's name, which is the same class of bug `resolveClient()` already
 * refuses to allow for client slugs.
 */

import {
  DESIGN_FAMILIES,
  DEFAULT_SECTION_ORDER,
  HERO_VARIANTS,
  type DesignConfig,
  type DesignPalette,
  type HeroMotion,
  type HeroVariant,
  type ReviewsVariant,
  type SectionKey,
  type ServicesVariant,
} from '../types/design';
import type { TestimonialStatus } from '../types/site';
import {
  DENSITY_SCALE,
  RADIUS_SCALE,
  getPreset,
  isDarkPalette,
  offeredPresets,
  type PresetId,
  type ResolvedTheme,
  type ThemeSelection,
} from '../design/presets';

class DesignConfigError extends Error {
  constructor(slug: string, path: string, detail: string) {
    super(`${slug}: design config is invalid at \`${path}\` — ${detail}.`);
    this.name = 'DesignConfigError';
  }
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * A cursor over the raw JSON that remembers where it is, so every failure can
 * say `sections.reviews.items[2].rating` rather than "invalid config".
 */
function reader(slug: string, raw: unknown, path: string) {
  if (!isObj(raw)) throw new DesignConfigError(slug, path || '(root)', 'expected an object');
  const at = (key: string) => (path ? `${path}.${key}` : key);

  return {
    str(key: string): string {
      const v = raw[key];
      if (typeof v !== 'string' || v.trim() === '')
        throw new DesignConfigError(slug, at(key), 'expected a non-empty string');
      return v;
    },
    optStr(key: string): string | undefined {
      const v = raw[key];
      if (v === undefined) return undefined;
      if (typeof v !== 'string')
        throw new DesignConfigError(slug, at(key), 'expected a string when present');
      return v;
    },
    /** Alt text is the one string allowed to be empty — decorative images. */
    altStr(key: string): string {
      const v = raw[key];
      if (typeof v !== 'string')
        throw new DesignConfigError(slug, at(key), 'expected a string (use "" only if decorative)');
      return v;
    },
    num(key: string): number {
      const v = raw[key];
      if (typeof v !== 'number' || !Number.isFinite(v))
        throw new DesignConfigError(slug, at(key), 'expected a finite number');
      return v;
    },
    optNum(key: string): number | undefined {
      const v = raw[key];
      if (v === undefined) return undefined;
      if (typeof v !== 'number' || !Number.isFinite(v))
        throw new DesignConfigError(slug, at(key), 'expected a finite number when present');
      return v;
    },
    bool(key: string): boolean {
      const v = raw[key];
      if (typeof v !== 'boolean')
        throw new DesignConfigError(slug, at(key), 'expected true or false');
      return v;
    },
    obj(key: string): unknown {
      const v = raw[key];
      if (v === undefined) throw new DesignConfigError(slug, at(key), 'is required');
      return v;
    },
    optObj(key: string): unknown {
      return raw[key];
    },
    arr(key: string): unknown[] {
      const v = raw[key];
      if (!Array.isArray(v)) throw new DesignConfigError(slug, at(key), 'expected an array');
      return v;
    },
    optArr(key: string): unknown[] {
      const v = raw[key];
      if (v === undefined) return [];
      if (!Array.isArray(v))
        throw new DesignConfigError(slug, at(key), 'expected an array when present');
      return v;
    },
    strArr(key: string): string[] {
      return this.arr(key).map((entry, i) => {
        if (typeof entry !== 'string' || entry.trim() === '')
          throw new DesignConfigError(slug, `${at(key)}[${i}]`, 'expected a non-empty string');
        return entry;
      });
    },
    optStrArr(key: string): string[] | undefined {
      if (raw[key] === undefined) return undefined;
      return this.strArr(key);
    },
    path: at,
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * The runtime twin of `IconName`. `Icon.astro` indexes its path table by that
 * type, so an unknown name reaches the renderer as `undefined` and draws an
 * empty `<path>` — a silent blank square rather than an error. Validating the
 * string here turns that into a build failure naming the bad value.
 */
const ICON_NAMES: readonly ServiceIcon[] = [
  'precision',
  'clock',
  'shield',
  'wrench',
  'gear',
  'truck',
  'badge',
  'phone',
];

function colour(slug: string, r: ReturnType<typeof reader>, key: string): string {
  const v = r.str(key);
  if (!HEX.test(v))
    throw new DesignConfigError(slug, r.path(key), `expected a 6-digit hex colour, got "${v}"`);
  return v;
}

function cta(slug: string, raw: unknown, path: string) {
  const r = reader(slug, raw, path);
  return { text: r.str('text'), href: r.str('href') };
}

function optCta(slug: string, raw: unknown, path: string) {
  return raw === undefined ? undefined : cta(slug, raw, path);
}

function image(slug: string, raw: unknown, path: string) {
  const r = reader(slug, raw, path);
  const caption = r.optStr('caption');
  const width = r.optNum('width');
  const height = r.optNum('height');
  return {
    src: r.str('src'),
    alt: r.altStr('alt'),
    ...(caption !== undefined ? { caption } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  };
}

/**
 * Validate a raw JSON design payload.
 *
 * `slug` is only used to make failures traceable to a client.
 */
export function parseDesign(slug: string, raw: unknown): DesignConfig {
  const root = reader(slug, raw, '');

  // --- theme selection ------------------------------------------------------
  // Ids, never values. `resolveTheme()` in `design/presets.ts` turns them into
  // colours and rejects any id the chosen preset does not offer, so a config
  // cannot invent a palette or quietly drift from its family.
  const t = reader(slug, root.obj('theme'), 'theme');
  const preset = t.str('preset');
  if (!(DESIGN_FAMILIES as string[]).includes(preset))
    throw new DesignConfigError(
      slug,
      'theme.preset',
      `expected one of ${DESIGN_FAMILIES.join(', ')}, got "${preset}"`,
    );

  const radius = t.optStr('radius');
  if (radius !== undefined && radius !== 'sharp' && radius !== 'soft')
    throw new DesignConfigError(slug, 'theme.radius', 'expected "sharp" or "soft"');

  const density = t.optStr('density');
  if (density !== undefined && density !== 'compact' && density !== 'comfortable')
    throw new DesignConfigError(slug, 'theme.density', 'expected "compact" or "comfortable"');

  const rawOverride = t.optObj('paletteOverride');
  const paletteOverride = (() => {
    if (rawOverride === undefined) return undefined;
    const or = reader(slug, rawOverride, 'theme.paletteOverride');
    const keys: (keyof DesignPalette)[] = [
      'base',
      'surface',
      'surfaceAlt',
      'ink',
      'inkMuted',
      'line',
      'primary',
      'onPrimary',
      'accent',
      'onAccent',
    ];
    const out: Partial<DesignPalette> = {};
    for (const key of keys) {
      if (or.optStr(key) !== undefined) out[key] = colour(slug, or, key);
    }
    return out;
  })();

  const rawBrand = t.optObj('brandAccent');
  const brandAccent = (() => {
    if (rawBrand === undefined) return undefined;
    const bs = reader(slug, rawBrand, 'theme.brandAccent');
    return {
      id: bs.str('id'),
      label: bs.str('label'),
      accent: colour(slug, bs, 'accent'),
      onAccent: colour(slug, bs, 'onAccent'),
      // Where the colour came from. Unsourced, it is a guess wearing the
      // client's name — the same rule testimonials follow.
      sourceNote: bs.str('sourceNote'),
    };
  })();

  const theme: ThemeSelection = {
    preset: preset as PresetId,
    accent: t.str('accent'),
    fontPairing: t.str('fontPairing'),
    ...(radius !== undefined ? { radius } : {}),
    ...(density !== undefined ? { density } : {}),
    ...(brandAccent ? { brandAccent } : {}),
    ...(paletteOverride ? { paletteOverride } : {}),
  };

  const h = reader(slug, root.obj('header'), 'header');
  const header = {
    nav: h.arr('nav').map((entry, i) => {
      const nr = reader(slug, entry, `header.nav[${i}]`);
      return { label: nr.str('label'), href: nr.str('href') };
    }),
    ...(() => {
      const c = optCta(slug, h.optObj('cta'), 'header.cta');
      return c ? { cta: c } : {};
    })(),
    showPhone: h.bool('showPhone'),
  };

  const s = reader(slug, root.obj('sections'), 'sections');

  // --- hero -----------------------------------------------------------------
  const hr = reader(slug, s.obj('hero'), 'sections.hero');
  const variant = hr.str('variant');
  if (!(HERO_VARIANTS as string[]).includes(variant))
    throw new DesignConfigError(
      slug,
      'sections.hero.variant',
      `expected one of ${HERO_VARIANTS.join(', ')}, got "${variant}"`,
    );
  const motion = hr.optStr('motion');
  if (motion !== undefined && motion !== 'none' && motion !== 'pan' && motion !== 'zoom')
    throw new DesignConfigError(slug, 'sections.hero.motion', 'expected "none", "pan" or "zoom"');
  const heroEyebrow = hr.optStr('eyebrow');
  const heroSecondary = optCta(slug, hr.optObj('ctaSecondary'), 'sections.hero.ctaSecondary');
  const badges = hr.optStrArr('badges');
  const hero = {
    variant: variant as HeroVariant,
    ...(motion !== undefined ? { motion: motion as HeroMotion } : {}),
    ...(heroEyebrow !== undefined ? { eyebrow: heroEyebrow } : {}),
    headline: hr.str('headline'),
    subhead: hr.str('subhead'),
    ctaPrimary: cta(slug, hr.obj('ctaPrimary'), 'sections.hero.ctaPrimary'),
    ...(heroSecondary ? { ctaSecondary: heroSecondary } : {}),
    image: image(slug, hr.obj('image'), 'sections.hero.image'),
    ...(badges ? { badges } : {}),
    showPhone: hr.bool('showPhone'),
  };

  // --- sticky call bar ------------------------------------------------------
  const kr = reader(slug, s.obj('stickyCta'), 'sections.stickyCta');
  const callNote = kr.optStr('callNote');
  const stickySecondary = optCta(slug, kr.optObj('secondary'), 'sections.stickyCta.secondary');
  const stickyCta = {
    enabled: kr.bool('enabled'),
    callLabel: kr.str('callLabel'),
    ...(callNote !== undefined ? { callNote } : {}),
    ...(stickySecondary ? { secondary: stickySecondary } : {}),
  };

  // --- services -------------------------------------------------------------
  const vr = reader(slug, s.obj('services'), 'sections.services');
  const servicesEyebrow = vr.optStr('eyebrow');
  const servicesIntro = vr.optStr('intro');
  const servicesVariant = vr.optStr('variant');
  if (servicesVariant !== undefined && servicesVariant !== 'cards' && servicesVariant !== 'list')
    throw new DesignConfigError(slug, 'sections.services.variant', 'expected "cards" or "list"');
  const services = {
    enabled: vr.bool('enabled'),
    ...(servicesEyebrow !== undefined ? { eyebrow: servicesEyebrow } : {}),
    heading: vr.str('heading'),
    ...(servicesIntro !== undefined ? { intro: servicesIntro } : {}),
    ...(servicesVariant !== undefined ? { variant: servicesVariant as ServicesVariant } : {}),
    items: vr.arr('items').map((entry, i) => {
      const ir = reader(slug, entry, `sections.services.items[${i}]`);
      const icon = ir.optStr('icon');
      if (icon !== undefined && !(ICON_NAMES as string[]).includes(icon))
        throw new DesignConfigError(
          slug,
          `sections.services.items[${i}].icon`,
          `"${icon}" is not a known icon — expected one of ${ICON_NAMES.join(', ')}`,
        );
      const href = ir.optStr('href');
      const points = ir.optStrArr('points');
      const img = ir.optObj('image');
      return {
        title: ir.str('title'),
        body: ir.str('body'),
        ...(icon !== undefined ? { icon: icon as ServiceIcon } : {}),
        ...(img !== undefined
          ? { image: image(slug, img, `sections.services.items[${i}].image`) }
          : {}),
        ...(href !== undefined ? { href } : {}),
        ...(points ? { points } : {}),
      };
    }),
  };

  // --- reviews --------------------------------------------------------------
  const rr = reader(slug, s.obj('reviews'), 'sections.reviews');
  const reviewsEyebrow = rr.optStr('eyebrow');
  const reviewsIntro = rr.optStr('intro');
  const profileUrl = rr.optStr('profileUrl');
  const profileLinkText = rr.optStr('profileLinkText');
  const rawAggregate = rr.optObj('aggregate');
  const aggregate = (() => {
    if (rawAggregate === undefined) return undefined;
    const ar = reader(slug, rawAggregate, 'sections.reviews.aggregate');
    return { ratingValue: ar.num('ratingValue'), reviewCount: ar.num('reviewCount') };
  })();
  const reviews = {
    enabled: rr.bool('enabled'),
    ...(reviewsEyebrow !== undefined ? { eyebrow: reviewsEyebrow } : {}),
    heading: rr.str('heading'),
    ...(reviewsIntro !== undefined ? { intro: reviewsIntro } : {}),
    sourceLabel: rr.str('sourceLabel'),
    ...(profileUrl !== undefined ? { profileUrl } : {}),
    ...(profileLinkText !== undefined ? { profileLinkText } : {}),
    ...(aggregate ? { aggregate } : {}),
    ...(() => {
      const rv = rr.optStr('variant');
      if (rv !== undefined && rv !== 'grid' && rv !== 'carousel')
        throw new DesignConfigError(slug, 'sections.reviews.variant', 'expected "grid" or "carousel"');
      return rv !== undefined ? { variant: rv as ReviewsVariant } : {};
    })(),
    ...(() => {
      const ms = rr.optNum('autoplayMs');
      if (ms !== undefined && ms < 0)
        throw new DesignConfigError(slug, 'sections.reviews.autoplayMs', 'must not be negative');
      return ms !== undefined ? { autoplayMs: ms } : {};
    })(),
    items: rr.arr('items').map((entry, i) => {
      const ir = reader(slug, entry, `sections.reviews.items[${i}]`);
      const rating = ir.num('rating');
      if (!Number.isInteger(rating) || rating < 1 || rating > 5)
        throw new DesignConfigError(
          slug,
          `sections.reviews.items[${i}].rating`,
          'expected a whole number from 1 to 5',
        );
      const status = ir.str('status');
      if (status !== 'verified' && status !== 'placeholder')
        throw new DesignConfigError(
          slug,
          `sections.reviews.items[${i}].status`,
          'expected "verified" or "placeholder" — every review must declare whether we wrote it',
        );
      const date = ir.optStr('date');
      return {
        author: ir.str('author'),
        rating,
        quote: ir.str('quote'),
        ...(date !== undefined ? { date } : {}),
        sourceNote: ir.str('sourceNote'),
        status: status as TestimonialStatus,
      };
    }),
  };

  // --- stats ----------------------------------------------------------------
  const tr = reader(slug, s.obj('stats'), 'sections.stats');
  const statsHeading = tr.optStr('heading');
  const statsIntro = tr.optStr('intro');
  const stats = {
    enabled: tr.bool('enabled'),
    ...(statsHeading !== undefined ? { heading: statsHeading } : {}),
    ...(statsIntro !== undefined ? { intro: statsIntro } : {}),
    items: tr.arr('items').map((entry, i) => {
      const ir = reader(slug, entry, `sections.stats.items[${i}]`);
      const prefix = ir.optStr('prefix');
      const suffix = ir.optStr('suffix');
      const note = ir.optStr('note');
      return {
        value: ir.num('value'),
        ...(prefix !== undefined ? { prefix } : {}),
        ...(suffix !== undefined ? { suffix } : {}),
        label: ir.str('label'),
        ...(note !== undefined ? { note } : {}),
      };
    }),
  };

  // --- faq ------------------------------------------------------------------
  const qr = reader(slug, s.obj('faq'), 'sections.faq');
  const faqEyebrow = qr.optStr('eyebrow');
  const faqIntro = qr.optStr('intro');
  const faq = {
    enabled: qr.bool('enabled'),
    ...(faqEyebrow !== undefined ? { eyebrow: faqEyebrow } : {}),
    heading: qr.str('heading'),
    ...(faqIntro !== undefined ? { intro: faqIntro } : {}),
    items: qr.arr('items').map((entry, i) => {
      const ir = reader(slug, entry, `sections.faq.items[${i}]`);
      return { q: ir.str('q'), a: ir.str('a') };
    }),
  };

  // --- gallery --------------------------------------------------------------
  const gr = reader(slug, s.obj('gallery'), 'sections.gallery');
  const galleryEyebrow = gr.optStr('eyebrow');
  const galleryIntro = gr.optStr('intro');
  const gallery = {
    enabled: gr.bool('enabled'),
    ...(galleryEyebrow !== undefined ? { eyebrow: galleryEyebrow } : {}),
    heading: gr.str('heading'),
    ...(galleryIntro !== undefined ? { intro: galleryIntro } : {}),
    items: gr
      .arr('items')
      .map((entry, i) => image(slug, entry, `sections.gallery.items[${i}]`)),
  };

  // --- service area ---------------------------------------------------------
  const ar = reader(slug, s.obj('serviceArea'), 'sections.serviceArea');
  const areaEyebrow = ar.optStr('eyebrow');
  const areaIntro = ar.optStr('intro');
  const areaNote = ar.optStr('note');
  const mapUrl = ar.optStr('mapUrl');
  const mapLinkText = ar.optStr('mapLinkText');
  const serviceArea = {
    enabled: ar.bool('enabled'),
    ...(areaEyebrow !== undefined ? { eyebrow: areaEyebrow } : {}),
    heading: ar.str('heading'),
    ...(areaIntro !== undefined ? { intro: areaIntro } : {}),
    areas: ar.optArr('areas').map((entry, i) => {
      if (typeof entry !== 'string' || entry.trim() === '')
        throw new DesignConfigError(
          slug,
          `sections.serviceArea.areas[${i}]`,
          'expected a non-empty string',
        );
      return entry;
    }),
    ...(areaNote !== undefined ? { note: areaNote } : {}),
    ...(mapUrl !== undefined ? { mapUrl } : {}),
    ...(mapLinkText !== undefined ? { mapLinkText } : {}),
  };

  // --- before / after -------------------------------------------------------
  const br = reader(slug, s.obj('beforeAfter'), 'sections.beforeAfter');
  const baEyebrow = br.optStr('eyebrow');
  const baIntro = br.optStr('intro');
  const beforeAfter = {
    enabled: br.bool('enabled'),
    ...(baEyebrow !== undefined ? { eyebrow: baEyebrow } : {}),
    heading: br.str('heading'),
    ...(baIntro !== undefined ? { intro: baIntro } : {}),
    before: image(slug, br.obj('before'), 'sections.beforeAfter.before'),
    after: image(slug, br.obj('after'), 'sections.beforeAfter.after'),
    beforeLabel: br.str('beforeLabel'),
    afterLabel: br.str('afterLabel'),
    verified: br.bool('verified'),
  };

  // --- open / closed badge --------------------------------------------------
  const nr = reader(slug, s.obj('openNow'), 'sections.openNow');
  const openNow = {
    enabled: nr.bool('enabled'),
    openLabel: nr.str('openLabel'),
    closedLabel: nr.str('closedLabel'),
  };

  // --- footer ---------------------------------------------------------------
  const fr = reader(slug, s.obj('footer'), 'sections.footer');
  const blurb = fr.optStr('blurb');
  const legal = fr.optStr('legal');
  const rawColumns = fr.optObj('columns');
  const columns =
    rawColumns === undefined
      ? undefined
      : fr.arr('columns').map((entry, i) => {
          const cr = reader(slug, entry, `sections.footer.columns[${i}]`);
          return {
            heading: cr.str('heading'),
            links: cr
              .arr('links')
              .map((l, j) => cta(slug, l, `sections.footer.columns[${i}].links[${j}]`)),
          };
        });
  const footer = {
    ...(blurb !== undefined ? { blurb } : {}),
    ...(columns ? { columns } : {}),
    showHours: fr.bool('showHours'),
    ...(legal !== undefined ? { legal } : {}),
  };

  // --- order ----------------------------------------------------------------
  const rawOrder = root.optStrArr('order');
  if (rawOrder) {
    for (const key of rawOrder) {
      if (!(DEFAULT_SECTION_ORDER as string[]).includes(key))
        throw new DesignConfigError(
          slug,
          'order',
          `"${key}" is not a section — expected some of ${DEFAULT_SECTION_ORDER.join(', ')}`,
        );
    }
  }

  /*
   * Layout variants are checked against the *preset's* allow-list, not just
   * against the union of every variant that exists. A preset declares which
   * layouts it is willing to render, and a config asking for one it does not
   * offer is a mistake worth failing on — otherwise a family quietly renders
   * an arrangement nobody designed for it.
   */
  const allowed = getPreset(theme.preset);
  const requireVariant = (value: string | undefined, list: string[], path: string) => {
    if (value === undefined || list.includes(value)) return;
    throw new DesignConfigError(
      slug,
      path,
      `preset "${theme.preset}" does not offer "${value}" — it offers ${list.join(', ')}`,
    );
  };
  requireVariant(hero.variant, allowed.variants.hero, 'sections.hero.variant');
  requireVariant(services.variant, allowed.variants.services, 'sections.services.variant');
  requireVariant(reviews.variant, allowed.variants.reviews, 'sections.reviews.variant');

  return {
    theme,
    header,
    ...(rawOrder ? { order: rawOrder as SectionKey[] } : {}),
    sections: {
      hero,
      stickyCta,
      services,
      reviews,
      stats,
      faq,
      gallery,
      serviceArea,
      beforeAfter,
      openNow,
      footer,
    },
  };
}

/** Narrow re-export so the services validator above stays readable. */
type ServiceIcon = NonNullable<DesignConfig['sections']['services']['items'][number]['icon']>;

/**
 * The sections to render after the hero, in order, skipping disabled ones.
 *
 * `beforeAfter` carries a second condition: it also needs `verified`. A
 * before/after slider built from two placeholder images presents stock art as
 * this business's own work, which is the one thing the slider is for.
 */
export function sectionOrder(design: DesignConfig): SectionKey[] {
  const wanted = design.order ?? DEFAULT_SECTION_ORDER;
  return wanted.filter((key) => {
    if (key === 'beforeAfter')
      return design.sections.beforeAfter.enabled && design.sections.beforeAfter.verified;
    return design.sections[key].enabled;
  });
}

/**
 * The family's palette and type as CSS custom properties.
 *
 * This is the whole theming mechanism: `design.css` never names a colour, it
 * only references these. Swap the JSON and every rule follows.
 *
 * Derived values (`-soft`, `-strong`, the hero scrim, the texture tints) use
 * `color-mix()` against the palette rather than being separate config fields,
 * so a client cannot set a shade that disagrees with its own base colour.
 */
/**
 * The base-palette half of the token set: everything except the accent.
 *
 * Kept separate from the accent half so the customizer can emit
 * `[data-theme=…]` and `[data-theme=…][data-accent=…]` blocks independently
 * and switch either one with a single attribute write.
 */
export function paletteTokens(c: Omit<DesignPalette, 'accent' | 'onAccent'>): string {
  return `  --d-base: ${c.base};
  --d-surface: ${c.surface};
  --d-surface-alt: ${c.surfaceAlt};
  --d-ink: ${c.ink};
  --d-ink-muted: ${c.inkMuted};
  --d-line: ${c.line};
  --d-line-strong: color-mix(in srgb, ${c.ink} 55%, ${c.base});
  --d-primary: ${c.primary};
  --d-on-primary: ${c.onPrimary};
  --d-primary-soft: color-mix(in srgb, ${c.primary} 10%, ${c.surface});
  --d-scrim: color-mix(in srgb, ${c.base} 78%, transparent);
  --d-scrim-strong: color-mix(in srgb, ${c.base} 92%, transparent);
  --d-tint-2: color-mix(in srgb, ${c.ink} 4%, ${c.base});
  --d-tint-6: color-mix(in srgb, ${c.ink} 8%, ${c.base});`;
}

/**
 * The accent half.
 *
 * `--d-accent-strong` mixes the accent toward **`ink`**, not toward black.
 * That one choice is what lets a single rule serve a light and a dark family:
 * on Precision, ink is near-black and the hover state darkens as you would
 * expect; on Forge, ink is near-white and the hover state *lightens* — which
 * is the only direction that keeps a hot orange legible against carbon. Mixing
 * toward black instead put Forge's hover state at 3.5:1 and failed the gate.
 */
export function accentTokens(
  accent: string,
  onAccent: string,
  palette: { surface: string; ink: string; base: string },
): string {
  // On a dark palette the "strong" accent must get *lighter*, not darker:
  // mixing an ember orange toward black against a carbon background lands at
  // 3.5:1 and fails the gate, while mixing it toward the ink lifts it clear.
  // `isDarkPalette` decides, so one rule serves all three families.
  const toward = isDarkPalette(palette) ? palette.ink : '#000000';
  return `  --d-accent: ${accent};
  --d-on-accent: ${onAccent};
  --d-accent-strong: color-mix(in srgb, ${accent} 80%, ${toward});
  --d-accent-soft: color-mix(in srgb, ${accent} 12%, ${palette.surface});`;
}

/** The font half. */
export function fontTokens(f: DesignFontsLike): string {
  return `  --d-font-display: ${f.display};
  --d-font-body: ${f.body};
  --d-display-weight: ${f.displayWeight};
  --d-display-transform: ${f.displayTransform};
  --d-display-tracking: ${f.displayTracking};`;
}

interface DesignFontsLike {
  display: string;
  body: string;
  displayWeight: string;
  displayTransform: string;
  displayTracking: string;
}

/** Metric tokens: the only two that change geometry, hence the only two the
 *  customizer has to declare in every combination to avoid layout shift. */
export function metricTokens(theme: ResolvedTheme): string {
  return `  --d-radius-card: ${theme.radius.card};
  --d-radius-btn: ${theme.radius.btn};
  --d-section-y: ${theme.density.section};
  --d-section-y-lg: ${theme.density.sectionLg};
  --d-grid-gap: ${theme.density.gap};`;
}

/**
 * The whole token block for one resolved theme.
 *
 * This is the entire theming mechanism: `design.css` never names a colour, it
 * only references these properties. Swap the preset id in the JSON and every
 * rule in the stylesheet follows.
 */
export function designTokens(theme: ResolvedTheme): string {
  const c = theme.palette;
  return `:root {
${paletteTokens(c)}
${accentTokens(c.accent, c.onAccent, c)}
${fontTokens(theme.fonts)}
${metricTokens(theme)}
}`;
}

/**
 * The full switchable matrix, for demo builds with the customizer on.
 *
 * Emitted as static CSS keyed on `<html data-theme|data-accent|data-font>`, so
 * switching is three attribute writes and the browser does nothing beyond the
 * custom-property cascade it would do anyway. No stylesheet is swapped, no
 * geometry is recalculated beyond radius/density — and those are declared in
 * every combination, which is what keeps the switch free of layout shift.
 *
 * It is only ever emitted on demo builds. A delivered site gets the single
 * `:root` block from `designTokens()` and none of this.
 */
export function themeMatrixCss(design: DesignConfig): string {
  const blocks: string[] = [];

  // `offeredPresets()` is what the panel builds its controls from. Emitting
  // from the same call is the guarantee that every cell a prospect can select
  // has a block here — see the note on that function.
  for (const { preset, accents, fonts } of offeredPresets(design.theme)) {
    const radius = RADIUS_SCALE[preset.radius];
    const density = DENSITY_SCALE[preset.density];
    blocks.push(`:root[data-theme="${preset.id}"] {
${paletteTokens(preset.palette)}
  --d-radius-card: ${radius.card};
  --d-radius-btn: ${radius.btn};
  --d-section-y: ${density.section};
  --d-section-y-lg: ${density.sectionLg};
  --d-grid-gap: ${density.gap};
}`);

    // The prospect's own extracted brand colour is offered inside every
    // preset it was cleared for. It is in the matrix rather than bolted on,
    // so switching preset keeps the selection valid or drops it visibly.
    for (const swatch of accents) {
      blocks.push(`:root[data-theme="${preset.id}"][data-accent="${swatch.id}"] {
${accentTokens(swatch.accent, swatch.onAccent, preset.palette)}
}`);
    }

    for (const pairing of fonts) {
      // Font blocks are scoped by preset too: two presets may legitimately
      // offer pairings under the same id with different stacks.
      blocks.push(`:root[data-theme="${preset.id}"][data-font="${pairing.id}"] {
${fontTokens(pairing)}
}`);
    }
  }

  return blocks.join('\n');
}

/**
 * The offered cells as plain ids, for the scripts that must resolve a
 * selection before any CSS can help them.
 *
 * Both the pre-paint script in `DesignLayout` and the panel's own resolver
 * need to know which ids are legal together. They get this — the id skeleton
 * of the matrix above, ~200 bytes inlined — rather than a second hand-written
 * list that can drift from the CSS.
 */
export function offeredIds(design: DesignConfig): Record<string, { a: string[]; f: string[] }> {
  const out: Record<string, { a: string[]; f: string[] }> = {};
  for (const { preset, accents, fonts } of offeredPresets(design.theme)) {
    out[preset.id] = { a: accents.map((s) => s.id), f: fonts.map((p) => p.id) };
  }
  return out;
}

/**
 * Whether review structured data may be emitted.
 *
 * Both conditions are required: real aggregate numbers, and no review whose
 * words we wrote ourselves. Marking up a paraphrase as a `Review` would put a
 * fabricated quotation into a search engine's index under the client's name.
 */
export function canEmitReviewJsonLd(reviews: DesignConfig['sections']['reviews']): boolean {
  return (
    reviews.enabled &&
    reviews.aggregate !== undefined &&
    reviews.items.length > 0 &&
    reviews.items.every((r) => r.status === 'verified')
  );
}
