/**
 * Resolves a client slug to the client whose content it actually renders.
 *
 * The design-family comparison builds (`ks-welding-forge`, `-heritage`,
 * `-precision`) are spreads of another client's config — `{ ...ksWelding,
 * design: … }` — overriding the theme and nothing factual. They have no
 * `business` block of their own and no prospect record of their own, because
 * every word on them belongs to the base client.
 *
 * Checks that reason about a client's *facts* therefore have to follow the
 * spread. The alternative — skipping a build a check cannot resolve — is the
 * failure mode worth avoiding: three of eight demos would silently stop being
 * checked at all.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The slug `slug` inherits from, or `slug` itself when it declares its own
 * config. Follows a chain of spreads, and refuses to loop forever on a cycle.
 */
export function resolveBaseSlug(clientsDir, slug, seen = []) {
  const file = join(clientsDir, `${slug}.config.ts`);
  if (!existsSync(file)) return slug;
  const source = readFileSync(file, 'utf8');

  // A config that declares its own business block is the base, by definition.
  if (/\bbusiness:\s*\{/.test(source)) return slug;

  const spread = /=\s*\{[\s\S]*?\.\.\.([A-Za-z_$][\w$]*)/.exec(source);
  if (!spread) return slug;
  const imported = new RegExp(
    `import\\s+${spread[1]}\\s+from\\s+'\\./([\\w-]+)\\.config'`,
  ).exec(source);
  if (!imported) return slug;

  const base = imported[1];
  if (seen.includes(base)) {
    throw new Error(`Circular config spread: ${[...seen, slug, base].join(' -> ')}`);
  }
  return resolveBaseSlug(clientsDir, base, [...seen, slug]);
}
