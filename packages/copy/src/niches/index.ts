/**
 * The niche registry.
 *
 * Static imports for the same reason `packages/template/clients/index.ts`
 * uses them: a typo in a niche id should be a compile error, not a runtime
 * surprise on the one client that uses that niche.
 */
import type { NicheId } from '../types.js';
import type { NichePack } from './types.js';
import { machineShop } from './machine-shop.js';
import { weldingFabrication } from './welding-fabrication.js';
import { generalContractor } from './general-contractor.js';

export const niches = {
  'machine-shop': machineShop,
  'welding-fabrication': weldingFabrication,
  'general-contractor': generalContractor,
} satisfies Record<NicheId, NichePack>;

export function nicheFor(id: NicheId): NichePack {
  return niches[id];
}

export type { NichePack, ServiceTemplate, FaqTemplate, CopyContext } from './types.js';
export { machineShop, weldingFabrication, generalContractor };
