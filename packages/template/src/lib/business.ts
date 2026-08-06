import type { Business } from '../types/site';

/**
 * Years in business, derived at build time from `business.foundedYear`.
 *
 * This exists so that no config and no component ever hard-codes an age.
 * A literal like "38 years of trust" or "four decades on the shop floor" is
 * correct for at most twelve months and silently wrong afterwards — and a
 * mockup can sit in someone's inbox across a new year.
 *
 * Returns `null` when `foundedYear` is absent, so callers must handle the
 * no-age case explicitly rather than rendering a stray "0 years".
 *
 * @param now Injectable for tests. Defaults to the build clock.
 */
export function yearsInBusiness(business: Business, now: Date = new Date()): number | null {
  if (business.foundedYear === undefined) return null;
  const years = now.getFullYear() - business.foundedYear;
  // A future or same-year founding date yields no meaningful span. Better to
  // render nothing than "0 years" or a negative number.
  return years > 0 ? years : null;
}

/**
 * `Since 1987` — the evergreen alternative to an age. Prefer this in headline
 * copy: it never goes stale, so it needs no derivation at all.
 *
 * Returns `null` when `foundedYear` is absent.
 */
export function foundedLabel(business: Business): string | null {
  return business.foundedYear === undefined ? null : `Since ${business.foundedYear}`;
}
