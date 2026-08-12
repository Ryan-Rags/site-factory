/**
 * The prospect records, keyed by client slug.
 *
 * The slug is the join between three things that must agree: this record, the
 * template client in `packages/template/clients/`, and the screenshot
 * directory `audit/out/<slug>/`. `checkProspects()` asserts the parts of that
 * agreement this package can see.
 */
import { BERGEN_MUNICIPALITIES, isBergenTown } from '../bergen.js';
import type { ProspectRecord } from '../types.js';
import { khMachineWorks } from './kh-machine-works.js';
import { ktsMachineShop } from './kts-machine-shop.js';
import { americanMachineSpecialty } from './american-machine-specialty.js';
import { industrialMachineCorp } from './industrial-machine-corp.js';
import { ksWelding } from './ks-welding.js';

export const prospects = {
  'kh-machine-works': khMachineWorks,
  'kts-machine-shop': ktsMachineShop,
  'american-machine-specialty': americanMachineSpecialty,
  'industrial-machine-corp': industrialMachineCorp,
  'ks-welding': ksWelding,
} satisfies Record<string, ProspectRecord>;

export type ProspectSlug = keyof typeof prospects;

export const PROSPECT_SLUGS = Object.keys(prospects) as ProspectSlug[];

export function prospectFor(slug: string): ProspectRecord {
  const record = (prospects as Record<string, ProspectRecord | undefined>)[slug];
  if (record === undefined) {
    throw new Error(
      `No prospect record for "${slug}". Known: ${PROSPECT_SLUGS.join(', ')}.\n` +
        `Add src/prospects/${slug}.ts and register it here.`,
    );
  }
  return record;
}

/**
 * Consistency checks that a type cannot express.
 *
 * The town one matters most. A misspelled municipality does not fail — it
 * quietly falls out of the Bergen partition into the wider-area line, so the
 * client loses a service-area section and nobody notices until someone
 * searches for that town.
 */
export function checkProspects(): void {
  for (const [slug, record] of Object.entries(prospects)) {
    if (record.slug !== slug) {
      throw new Error(`Prospect registered as "${slug}" but its record says "${record.slug}".`);
    }

    // A county of Bergen and towns that are not Bergen municipalities means
    // one of the two is wrong, and it is worth knowing which before the copy
    // claims a service area.
    if (record.county?.value === 'Bergen County') {
      for (const town of record.serviceTowns) {
        if (!isBergenTown(town)) {
          throw new Error(
            `${slug}: serviceTowns lists "${town}", which is not one of the ${BERGEN_MUNICIPALITIES.length} ` +
              `Bergen County municipalities. Check the spelling — "Township of Washington" is ` +
              `"Washington Township" here — or move it to \`wider\`.`,
          );
        }
      }
    }

    const slugs = new Set<string>();
    for (const service of record.services) {
      if (slugs.has(service.slug)) {
        throw new Error(`${slug}: two services share the slug "${service.slug}".`);
      }
      slugs.add(service.slug);
    }
  }
}
