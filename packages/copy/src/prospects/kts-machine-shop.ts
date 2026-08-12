/**
 * KTS MACHINE SHOP — Elmwood Park, NJ. Bergen County.
 *
 * The first of the three Bergen County records, and therefore the first to
 * get real town-by-town service-area sections rather than a wider-area line.
 *
 * Weekend hours stay off the record entirely. Sources conflicted, an earlier
 * "Sat 7–12" turned out to come from a stale listing, and the FAQ's opening
 * hours answer is generated from what is here — so a wrong Saturday would
 * have propagated into the FAQ, the hours table and the JSON-LD at once.
 */
import { carried, fact, unconfirmed, type ProspectRecord } from '../types.js';

const MOCKUP = (what: string): string =>
  `clients/kts-machine-shop.config.ts — ${what} carried from the approved mockup; read back to the owner`;

export const ktsMachineShop: ProspectRecord = {
  slug: 'kts-machine-shop',
  niche: 'machine-shop',

  tradingName: carried('KTS Machine Shop', MOCKUP('trading name')),
  legalName: carried('KTS Machine Shop', MOCKUP('legal name')),
  town: carried('Elmwood Park', MOCKUP('address')),
  region: carried('NJ', MOCKUP('address')),
  county: fact('Bergen County', 'Elmwood Park is a Bergen County, NJ municipality — public record'),
  phone: carried('(201) 791-2228', MOCKUP('phone number')),
  foundedYear: carried(1987, MOCKUP('founding year')),
  // email deliberately absent: no confirmed inbox, which is also why the
  // contact form is disabled rather than shipped inert.

  hours: carried(
    [
      { day: 'Monday', opens: '07:00', closes: '17:00' },
      { day: 'Tuesday', opens: '07:00', closes: '17:00' },
      { day: 'Wednesday', opens: '07:00', closes: '17:00' },
      { day: 'Thursday', opens: '07:00', closes: '17:00' },
      { day: 'Friday', opens: '07:00', closes: '17:00' },
    ],
    MOCKUP('weekday hours (weekend deliberately omitted — sources conflict)'),
  ),

  services: [
    { slug: 'general-machining', title: 'General Machining', taxonomy: 'general-machining' },
    { slug: 'prototypes', title: 'Prototypes', taxonomy: 'prototypes' },
    { slug: 'replacement-parts', title: 'Replacement Parts', taxonomy: 'replacement-parts' },
    { slug: 'rush-repairs', title: 'Rush Repairs', taxonomy: 'rush-repairs' },
  ],

  traits: {
    'walk-ins': carried('Walk-ins welcome', MOCKUP('walk-in policy')),
    rush: carried('Urgent repairs taken on — say so when you call', MOCKUP('rush-repair service')),
    'from-the-part': carried(
      'Bring the worn part in and we will make you a new one',
      MOCKUP('replacement-parts service'),
    ),
    'owner-led': carried(
      'You deal with Stanley, Chris or Mike — the people doing the work',
      MOCKUP('the named people on the floor'),
    ),
    'no-minimum': unconfirmed(
      'traits.no-minimum',
      'Is there a minimum order, or will you quote a single piece?',
    ),
    'quote-from-photo': unconfirmed(
      'traits.quote-from-photo',
      'Can a customer text or email a photo to start a quote, or do you want them to call?',
    ),
  },

  certifications: [
    unconfirmed(
      'certifications[0]',
      'Which certifications, affiliations or quality approvals does the shop hold? Nothing was found in public sources, so the site names none.',
    ),
  ],

  people: carried(
    'Stanley Barszcz owns the shop; Chris and Mike work the floor. Between them, that is who you deal with from the quote to the part in your hand.',
    MOCKUP('the people on the floor'),
  ),

  // Elmwood Park first — the generator puts the home town at the top of the
  // section list, but the operator's order is what decides the rest.
  serviceTowns: [
    'Elmwood Park',
    'Fair Lawn',
    'Garfield',
    'Saddle Brook',
    'Lodi',
    'Rochelle Park',
    'Paramus',
    'Hackensack',
  ],
  wider: ['Bergen County', 'Northern New Jersey'],

  voice: [
    {
      phrase:
        'Most of the work is quick-turnaround machining for manufacturers: a prototype that needs proving before a run is committed, a replacement part for a machine that is no longer supported, or a repair on something that has to be back on the line this week.',
      source:
        'src/content/about/kts-machine-shop/about.md — written by the template stream from the shop\'s public description; not the owner\'s words',
      attributed: 'ours-pending-confirmation',
    },
    {
      phrase:
        'If the job is urgent, say so when you call — that is the kind of work the shop is set up for.',
      source: 'src/content/about/kts-machine-shop/about.md — same provenance as above',
      attributed: 'ours-pending-confirmation',
    },
  ],
};
