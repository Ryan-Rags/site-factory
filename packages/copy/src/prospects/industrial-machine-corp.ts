/**
 * INDUSTRIAL MACHINE CORPORATION — Elmwood Park, NJ. Bergen County.
 *
 * THE MINIMUM-DATA CASE. Three facts are verified: the name, the address and
 * the phone number. That is genuinely all, and this record is the proof that
 * the engine degrades honestly rather than compensating.
 *
 * What that costs, concretely: no founding year, so no trust clause in the
 * headline and no age anywhere; no hours, so the FAQ's opening-hours question
 * is dropped rather than hedged and no `openingHoursSpecification` is
 * emitted; no confirmed traits, so a three-item trust strip; no people, so no
 * "who will I be dealing with". The FAQ comes out short — around half the
 * length of KTS's — and that is the correct output, not a bug to be padded
 * around. Every missing answer is a question in REPORT.md.
 *
 * The hours are a deliberate omission rather than a marker. What we hold
 * upstream is visibly corrupted, and a wrong hours table is worse than no
 * hours table in a way a marker does not fix: a customer who drives to a shop
 * that is shut does not care that the row said "verify with client".
 */
import { carried, fact, unconfirmed, type ProspectRecord } from '../types.js';

const MOCKUP = (what: string): string =>
  `clients/industrial-machine-corp.config.ts — ${what} carried from the approved mockup; read back to the owner`;

export const industrialMachineCorp: ProspectRecord = {
  slug: 'industrial-machine-corp',
  niche: 'machine-shop',

  tradingName: carried('Industrial Machine Corporation', MOCKUP('trading name')),
  legalName: carried('Industrial Machine Corporation', MOCKUP('legal name')),
  town: carried('Elmwood Park', MOCKUP('address')),
  region: carried('NJ', MOCKUP('address')),
  county: fact('Bergen County', 'Elmwood Park is a Bergen County, NJ municipality — public record'),
  phone: carried('(973) 345-1800', MOCKUP('phone number')),

  // Everything else is absent, and each absence is deliberate:
  //   foundedYear — not verified. No age appears anywhere on the site.
  //   email       — no confirmed inbox; the contact form is disabled.
  //   hours       — upstream data corrupted. See the module note.
  //   people      — unknown.
  //   geo         — never populated by this package.

  services: [
    { slug: 'machining', title: 'Machining', taxonomy: 'machining' },
    { slug: 'manufacturing', title: 'Manufacturing', taxonomy: 'manufacturing' },
  ],

  traits: {
    'walk-ins': unconfirmed(
      'traits.walk-ins',
      'Can a customer walk in with a part, or would you rather they called first?',
    ),
    rush: unconfirmed(
      'traits.rush',
      'Do you take urgent breakdown work, and how quickly can you usually turn it round?',
    ),
    'no-minimum': unconfirmed(
      'traits.no-minimum',
      'Will you quote a single piece, or is there a minimum order?',
    ),
    'from-the-part': unconfirmed(
      'traits.from-the-part',
      'Can you work from a worn part or a sample when the customer has no drawing?',
    ),
  },

  certifications: [
    unconfirmed(
      'certifications[0]',
      'Do you hold any certifications or trade affiliations? Nothing was found in public sources, so the site names none.',
    ),
  ],

  serviceTowns: [
    'Elmwood Park',
    'Fair Lawn',
    'Garfield',
    'Saddle Brook',
    'Lodi',
    'Rochelle Park',
  ],
  wider: ['Bergen County', 'Northern New Jersey'],

  // No voice notes. Nothing this business has published in its own words has
  // been found, and the About section is correspondingly short — which is the
  // honest shape for a page about a business we know three facts about.
  voice: [],
};
