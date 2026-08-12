/**
 * The two joins, in one place.
 *
 * They live here rather than in whichever generator needed one first because
 * both the niche packs and the generators use them, and a pack importing a
 * generator to get a comma-joiner would put a cycle in the module graph for
 * the sake of four lines.
 */

/**
 * `a, b and c`.
 *
 * No Oxford comma: these shops write the way they talk, and a serial comma in
 * a sentence about brackets reads like a press release.
 */
export function list(items: string[]): string {
  const clean = items.filter((s) => s.trim() !== '');
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0] as string;
  return `${clean.slice(0, -1).join(', ')} and ${clean[clean.length - 1] as string}`;
}

/**
 * `a, b or c`.
 *
 * Alternatives, not a list. "Bring it in, send a photo and call us" reads as
 * three things the customer has to do; with "or" it reads as three ways in.
 * It is one word and it changes the instruction completely, which is why it
 * gets its own function rather than a boolean on `list`.
 */
export function orList(items: string[]): string {
  const clean = items.filter((s) => s.trim() !== '');
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0] as string;
  return `${clean.slice(0, -1).join(', ')} or ${clean[clean.length - 1] as string}`;
}
