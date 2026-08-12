import { CallBudget, searchText } from "@site-factory/discover";

import {
  known,
  type ProspectAddress,
  type ProspectHours,
  type ProspectPhoto,
  type ProspectReview,
} from "../types.js";
import type { Contribution } from "./merge.js";

/**
 * Google Places, via the official API only.
 *
 * Scraping Google Search or Maps is prohibited by CLAUDE.md and is not done
 * anywhere in this package. What this module adds over `packages/discover` is
 * Place **Details**: reviews, photos, opening hours and a structured address,
 * none of which Text Search returns.
 *
 * Details is a more expensive SKU than Text Search, and this asks for the
 * Enterprise-tier fields (`reviews`, `photos`). One prospect costs at most two
 * calls — one Text Search to resolve the place id when we do not already have
 * one, then one Details — and both are drawn from the same run budget the
 * discover package enforces.
 */

const DETAILS_ENDPOINT = "https://places.googleapis.com/v1/places";

export const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "addressComponents",
  "nationalPhoneNumber",
  "websiteUri",
  "rating",
  "userRatingCount",
  "regularOpeningHours",
  "reviews",
  "photos",
].join(",");

interface AddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

interface PlacesReview {
  rating?: number;
  text?: { text?: string };
  originalText?: { text?: string };
  authorAttribution?: { displayName?: string };
  publishTime?: string;
}

interface PlacesPhotoRef {
  name?: string;
  authorAttributions?: { displayName?: string }[];
}

interface PlaceDetails {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: AddressComponent[];
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: {
    periods?: {
      open?: { day?: number; hour?: number; minute?: number };
      close?: { day?: number; hour?: number; minute?: number };
    }[];
  };
  reviews?: PlacesReview[];
  photos?: PlacesPhotoRef[];
}

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function redact(text: string, apiKey: string): string {
  return apiKey ? text.split(apiKey).join("[REDACTED]") : text;
}

export async function placeDetails(
  placeId: string,
  apiKey: string,
  budget: CallBudget,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<PlaceDetails> {
  budget.consume();
  const res = await fetchImpl(`${DETAILS_ENDPOINT}/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": DETAILS_FIELD_MASK,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Places details failed: HTTP ${res.status} ${res.statusText}. ${redact(detail, apiKey).slice(0, 300)}`,
    );
  }
  return (await res.json()) as PlaceDetails;
}

/**
 * Find the place id for a business we only know by name and address.
 *
 * A Text Search that returns several candidates is *not* resolved by picking
 * the first: a wrong place id would attach another business's reviews and
 * photos to this prospect's demo, which is the worst failure this pipeline
 * could produce. Anything ambiguous returns null and the Places fields stay
 * unavailable.
 */
export async function resolvePlaceId(
  query: string,
  apiKey: string,
  budget: CallBudget,
): Promise<string | null> {
  const places = await searchText({ niche: query, max: 3, apiKey, budget });
  const first = places[0];
  if (!first?.id) return null;
  if (places.length > 1) {
    const second = places[1];
    const nameOf = (p: typeof first): string => p?.displayName?.text?.toLowerCase() ?? "";
    // Two results with the same name in the same query is exactly the
    // ambiguity worth refusing.
    if (second && nameOf(second) === nameOf(first)) return null;
  }
  return first.id;
}

function toAddress(components: AddressComponent[] | undefined): ProspectAddress | undefined {
  if (!components) return undefined;
  const pick = (type: string, short = false): string | undefined => {
    const hit = components.find((c) => c.types?.includes(type));
    return short ? hit?.shortText : hit?.longText;
  };
  const locality = pick("locality") ?? pick("postal_town") ?? pick("sublocality");
  const region = pick("administrative_area_level_1", true);
  if (!locality || !region) return undefined;
  const streetNumber = pick("street_number");
  const route = pick("route");
  const address: ProspectAddress = {
    locality,
    region,
    country: pick("country", true) ?? "US",
  };
  const street = [streetNumber, route].filter(Boolean).join(" ");
  if (street) address.street = street;
  const postalCode = pick("postal_code");
  if (postalCode) address.postalCode = postalCode;
  return address;
}

function toHours(details: PlaceDetails): ProspectHours[] | undefined {
  const periods = details.regularOpeningHours?.periods;
  if (!periods || periods.length === 0) return undefined;
  const pad = (n: number): string => String(n).padStart(2, "0");
  const byDay = new Map<number, ProspectHours>();
  for (const period of periods) {
    const day = period.open?.day;
    if (day === undefined) continue;
    const name = DAYS[day];
    if (!name) continue;
    const opens = `${pad(period.open?.hour ?? 0)}:${pad(period.open?.minute ?? 0)}`;
    const closes =
      period.close === undefined
        ? undefined
        : `${pad(period.close.hour ?? 0)}:${pad(period.close.minute ?? 0)}`;
    // A period with no close is a 24-hour day; the template has no way to say
    // that, so it is left out rather than rendered as "00:00 to 00:00".
    if (closes) byDay.set(day, { day: name, opens, closes });
  }
  if (byDay.size === 0) return undefined;
  return DAYS.map((name, index) => byDay.get(index) ?? { day: name, closed: true });
}

/**
 * Reviews, kept verbatim.
 *
 * Google review content may be shown with visible attribution, which is what
 * `attribution` carries and what the template renders beside the quote. The
 * words are never edited — a paraphrased review presented as a quotation would
 * be a fabricated testimonial.
 */
function toReviews(details: PlaceDetails): ProspectReview[] | undefined {
  const reviews = (details.reviews ?? [])
    .map((r): ProspectReview | null => {
      const text = r.originalText?.text ?? r.text?.text;
      const author = r.authorAttribution?.displayName;
      if (!text || !author || r.rating === undefined) return null;
      const review: ProspectReview = {
        author,
        rating: r.rating,
        text,
        attribution: `${author} · via Google`,
      };
      if (r.publishTime) review.publishedAt = r.publishTime.slice(0, 10);
      return review;
    })
    .filter((r): r is ProspectReview => r !== null);
  return reviews.length > 0 ? reviews : undefined;
}

function toPhotos(details: PlaceDetails): ProspectPhoto[] | undefined {
  const photos = (details.photos ?? [])
    .map((p): ProspectPhoto | null => {
      if (!p.name) return null;
      const author = p.authorAttributions?.[0]?.displayName;
      const photo: ProspectPhoto = { ref: p.name, kind: "places" };
      photo.attribution = author ? `${author} · via Google` : "via Google";
      return photo;
    })
    .filter((p): p is ProspectPhoto => p !== null);
  return photos.length > 0 ? photos : undefined;
}

export interface PlacesIngest {
  contribution: Contribution;
  placeId?: string;
  /** Set when nothing could be fetched, with the reason, for the report. */
  failure?: string;
}

export async function ingestPlaces(
  opts: {
    placeId?: string | undefined;
    query: string;
    apiKey: string;
    budget: CallBudget;
    retrievedAt: string;
  },
): Promise<PlacesIngest> {
  let placeId = opts.placeId;
  if (!placeId) {
    placeId = (await resolvePlaceId(opts.query, opts.apiKey, opts.budget)) ?? undefined;
    if (!placeId) {
      return {
        contribution: {},
        failure: `Places returned no unambiguous match for "${opts.query}"`,
      };
    }
  }

  const details = await placeDetails(placeId, opts.apiKey, opts.budget);
  const at = opts.retrievedAt;
  const contribution: Contribution = {};

  const name = details.displayName?.text;
  if (name) contribution.businessName = known(name, "places", at, "Places displayName");

  if (details.nationalPhoneNumber) {
    contribution.phone = known(details.nationalPhoneNumber, "places", at, "Places listing");
  }
  if (details.websiteUri) {
    contribution.currentSiteUrl = known(details.websiteUri, "places", at, "Places listing");
  }

  const address = toAddress(details.addressComponents);
  if (address) contribution.address = known(address, "places", at, "Places addressComponents");

  const hours = toHours(details);
  if (hours) contribution.hours = known(hours, "places", at, "Places regularOpeningHours");

  const reviews = toReviews(details);
  if (reviews) {
    contribution.reviews = known(reviews, "places", at, "Places reviews, verbatim, with attribution");
  }

  const photos = toPhotos(details);
  if (photos) contribution.photos = known(photos, "places", at, "Places photo references");

  if (details.rating !== undefined && details.userRatingCount !== undefined) {
    contribution.ratingSummary = known(
      { rating: details.rating, count: details.userRatingCount },
      "places",
      at,
      "Places rating",
    );
  }

  return { contribution, placeId };
}
