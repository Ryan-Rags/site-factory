/** Combining diacritical marks, left over after an NFKD decomposition. */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/**
 * Slugs are cache keys, so they must be stable across runs: the same business
 * name must always produce the same slug. Accented characters decompose to
 * their base letter rather than collapsing to a separator, so "Café" and
 * "Cafe" do not become different sites.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Deduplicate a slug against those already issued, appending a numeric suffix.
 * `taken` is mutated so repeated calls stay consistent within a run.
 */
export function uniqueSlug(input: string, taken: Set<string>): string {
  const base = slugify(input) || "site";
  let candidate = base;
  let n = 2;
  while (taken.has(candidate)) candidate = `${base}-${n++}`;
  taken.add(candidate);
  return candidate;
}
