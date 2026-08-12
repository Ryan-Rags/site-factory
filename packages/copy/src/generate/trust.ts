/**
 * The trust block: the strip of four claims under the hero, and the
 * certifications list.
 *
 * This is the highest-risk copy on the page. It is short, it is styled to
 * look authoritative, and it is where "Licensed & Insured" ends up on ninety
 * per cent of local service sites regardless of whether anyone checked. A
 * badge is read as a verified claim precisely because it looks like one.
 *
 * Hence: every item here comes from a `Fact`, or it is a marker, and there is
 * no code path producing a third kind of item. Where a shop has fewer than
 * four sourced items, the strip is shorter. A three-item trust strip is not a
 * design problem worth lying to solve.
 */
import type { CopyContext } from '../niches/types.js';
import type { IconName } from '../niches/types.js';
import type { MarkerReport } from '../types.js';
import { isFact, isUnconfirmed, type TraitId } from '../types.js';
import { marked } from '../marker.js';

export interface TrustItem {
  icon: IconName;
  label: string;
}

/** Which icon reads as which claim. Cosmetic, but consistent across clients. */
const TRAIT_ICON: Record<TraitId, IconName> = {
  'walk-ins': 'wrench',
  'no-minimum': 'wrench',
  rush: 'clock',
  'production-runs': 'gear',
  'from-the-part': 'precision',
  'quote-from-photo': 'phone',
  'on-site': 'truck',
  'free-quotes': 'badge',
  'family-run': 'badge',
  'owner-led': 'badge',
};

export interface TrustOutput {
  strip: TrustItem[];
  certifications: { label: string; detail: string }[];
  markers: MarkerReport[];
}

export function trust(ctx: CopyContext): TrustOutput {
  const markers: MarkerReport[] = [];
  const strip: TrustItem[] = [];

  // A founding year is the strongest trust item a local business has, and the
  // only one that improves without effort. It leads whenever it exists.
  if (ctx.foundedYear !== undefined) {
    strip.push({ icon: 'badge', label: `Since ${ctx.foundedYear}` });
  }

  for (const [id, maybe] of Object.entries(ctx.record.traits) as [
    TraitId,
    (typeof ctx.record.traits)[TraitId],
  ][]) {
    if (isFact(maybe)) {
      strip.push({ icon: TRAIT_ICON[id], label: maybe.value });
    } else if (isUnconfirmed(maybe)) {
      markers.push({ field: `traits.${id}`, question: maybe.question });
    }
  }

  const certifications: { label: string; detail: string }[] = [];
  for (const [i, c] of ctx.record.certifications.entries()) {
    if (isFact(c)) {
      certifications.push(c.value);
    } else {
      certifications.push({
        label: marked('Certifications and insurance'),
        detail: 'Confirm what this business holds before anything is published.',
      });
      markers.push({ field: `certifications[${i}]`, question: c.question });
    }
  }

  // Four is what the strip is laid out for. More than four wraps to a second
  // row that reads as filler; the surplus is not lost, it is on the about and
  // services pages where it has room to be explained.
  return { strip: strip.slice(0, 4), certifications, markers };
}
