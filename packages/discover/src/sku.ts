/**
 * Which billing tier a Places (New) field mask lands in.
 *
 * A Places request is billed at the **highest tier any requested field belongs
 * to**. One stray field promotes the whole call, and the promotion is silent —
 * the response looks identical and the bill arrives a month later. That is the
 * failure this module exists to make loud.
 *
 * ## VERIFY BEFORE A LIVE RUN
 *
 * The table below is transcribed from Google's published SKU breakdown, and a
 * transcription is a claim like any other — the same warning `bergen.ts` puts
 * on its municipality list, for the same reason. Google has restructured these
 * tiers before (the Essentials/Pro/Enterprise split replaced the old
 * Basic/Contact/Atmosphere one) and can again. `checkSkuTable()` guards the
 * table's internal consistency; it cannot guard it against being out of date.
 *
 * Check the current SKU tables before trusting a cost projection:
 * https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
 *
 * What the table *is* good for regardless of drift: it is a closed allow-list.
 * A field nobody has classified resolves to {@link UNKNOWN_TIER} rather than
 * quietly passing, so adding a field to a mask without deciding what it costs
 * is a gate failure and not a surprise.
 */

/**
 * Ascending by price. The order is load-bearing: {@link tierOf} takes the
 * maximum over a mask, and `max` here means "further down this list".
 */
export const TIERS = ["essentials", "pro", "enterprise", "atmosphere"] as const;

export type PlacesTier = (typeof TIERS)[number];

/** Human label for the run summary and the usage log. */
export const TIER_LABELS: Record<PlacesTier, string> = {
  essentials: "Essentials",
  pro: "Pro",
  enterprise: "Enterprise",
  atmosphere: "Enterprise + Atmosphere",
};

const RANK: Record<PlacesTier, number> = {
  essentials: 0,
  pro: 1,
  enterprise: 2,
  atmosphere: 3,
};

/**
 * A field the table does not know. Treated as the most expensive tier, never
 * the cheapest: an unclassified field is an unpriced field, and guessing
 * downward is how a mask silently becomes expensive.
 */
export const UNKNOWN_TIER: PlacesTier = "atmosphere";

/**
 * Field → tier, keyed without the `places.` prefix so one table serves both
 * Text Search (`places.rating`) and Place Details (`rating`).
 *
 * Only fields this repo has reason to request are listed. It is an allow-list,
 * not a mirror of Google's full catalogue — see the module note on
 * {@link UNKNOWN_TIER}.
 */
export const FIELD_TIERS: Readonly<Record<string, PlacesTier>> = {
  // -- Essentials: identity and paging. ------------------------------------
  id: "essentials",
  name: "essentials",
  attributions: "essentials",
  nextPageToken: "essentials",

  // -- Pro: who and where. -------------------------------------------------
  displayName: "pro",
  formattedAddress: "pro",
  shortFormattedAddress: "pro",
  addressComponents: "pro",
  postalAddress: "pro",
  types: "pro",
  primaryType: "pro",
  primaryTypeDisplayName: "pro",
  location: "pro",
  viewport: "pro",
  plusCode: "pro",
  businessStatus: "pro",
  googleMapsUri: "pro",
  photos: "pro",

  // -- Enterprise: how to reach them, and what people think. ---------------
  //
  // `nationalPhoneNumber` and `websiteUri` sit HERE, not in Pro. This is the
  // single most consequential row in the table — see PLAN-discovery.md §1.1
  // and the finding recorded against it. A mask that asks for a phone number
  // or a website URL is an Enterprise call no matter what else is in it.
  nationalPhoneNumber: "enterprise",
  internationalPhoneNumber: "enterprise",
  websiteUri: "enterprise",
  rating: "enterprise",
  userRatingCount: "enterprise",
  priceLevel: "enterprise",
  priceRange: "enterprise",
  regularOpeningHours: "enterprise",
  currentOpeningHours: "enterprise",

  // -- Enterprise + Atmosphere: the dearest fields. ------------------------
  reviews: "atmosphere",
  editorialSummary: "atmosphere",
};

/** Strip the Text Search `places.` prefix so one table serves both endpoints. */
export function normalizeField(field: string): string {
  const trimmed = field.trim();
  return trimmed.startsWith("places.") ? trimmed.slice("places.".length) : trimmed;
}

/** The tier one field bills at. Unknown fields are {@link UNKNOWN_TIER}. */
export function fieldTier(field: string): PlacesTier {
  return FIELD_TIERS[normalizeField(field)] ?? UNKNOWN_TIER;
}

/** Split a comma-separated field mask into its fields, dropping blanks. */
export function maskFields(mask: string): string[] {
  return mask
    .split(",")
    .map((f) => f.trim())
    .filter((f) => f !== "");
}

/**
 * The tier a whole mask bills at: the maximum over its fields.
 *
 * An empty mask is `essentials` — it cannot cost more than the cheapest thing
 * on offer — but note that Places rejects an empty mask outright, so this is a
 * degenerate case rather than a useful one.
 */
export function tierOf(mask: string): PlacesTier {
  let worst: PlacesTier = "essentials";
  for (const field of maskFields(mask)) {
    const tier = fieldTier(field);
    if (RANK[tier] > RANK[worst]) worst = tier;
  }
  return worst;
}

/** Every field in `mask` that bills at `tier` or above. */
export function fieldsAtOrAbove(mask: string, tier: PlacesTier): string[] {
  return maskFields(mask).filter((f) => RANK[fieldTier(f)] >= RANK[tier]);
}

/** Fields in `mask` the table has never heard of. */
export function unknownFields(mask: string): string[] {
  return maskFields(mask).filter((f) => FIELD_TIERS[normalizeField(f)] === undefined);
}

/** True when `a` is strictly more expensive than `b`. */
export function isAbove(a: PlacesTier, b: PlacesTier): boolean {
  return RANK[a] > RANK[b];
}

/**
 * Guard the table's internal consistency at startup, in the spirit of
 * `checkBergenList()`. Catches a tier string that is not a tier — the kind of
 * typo that would otherwise make a field silently unclassified and therefore
 * silently expensive.
 */
export function checkSkuTable(): void {
  const valid = new Set<string>(TIERS);
  for (const [field, tier] of Object.entries(FIELD_TIERS)) {
    if (!valid.has(tier)) {
      throw new Error(
        `SKU table is corrupt: field "${field}" has tier "${tier}", which is not one of ${TIERS.join(", ")}.`,
      );
    }
    if (field !== normalizeField(field)) {
      throw new Error(
        `SKU table is corrupt: field "${field}" carries a "places." prefix. ` +
          "Keys are stored unprefixed so one table serves Text Search and Details.",
      );
    }
  }
}
