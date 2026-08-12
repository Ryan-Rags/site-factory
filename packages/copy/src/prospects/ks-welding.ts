/**
 * K&S WELDING & FABRICATING — Bergenfield, NJ. Bergen County.
 *
 * The welding-niche record, and the one with no founding year. That absence
 * is load-bearing: with no `foundedYear` the headline formula drops its trust
 * slot to a sourced trait instead of a date, and no copy anywhere on the site
 * says how long the shop has been going. There is no path by which "serving
 * Bergen County for years" can appear.
 */
import { carried, fact, unconfirmed, type ProspectRecord } from '../types.js';

const MOCKUP = (what: string): string =>
  `clients/ks-welding.config.ts — ${what} carried from the approved mockup; read back to the owner`;

export const ksWelding: ProspectRecord = {
  slug: 'ks-welding',
  niche: 'welding-fabrication',

  tradingName: carried('K&S Welding & Fabricating', MOCKUP('trading name')),
  legalName: carried('K&S Welding & Fabricating', MOCKUP('legal name')),
  town: carried('Bergenfield', MOCKUP('address')),
  region: carried('NJ', MOCKUP('address')),
  county: fact('Bergen County', 'Bergenfield is a Bergen County, NJ municipality — public record'),
  phone: carried('(201) 385-8848', MOCKUP('phone number')),
  // foundedYear deliberately absent — not verified, and nothing in the copy
  // implies an age as a result.
  // email deliberately absent — no confirmed inbox.

  hours: carried(
    [
      { day: 'Monday', opens: '07:00', closes: '16:00' },
      { day: 'Tuesday', opens: '07:00', closes: '16:00' },
      { day: 'Wednesday', opens: '07:00', closes: '16:00' },
      { day: 'Thursday', opens: '07:00', closes: '16:00' },
      { day: 'Friday', opens: '07:00', closes: '16:00' },
    ],
    MOCKUP('weekday hours'),
  ),

  services: [
    {
      slug: 'welding',
      title: 'Welding',
      taxonomy: 'welding',
      detail: carried(
        'Steel, stainless and aluminium are all welded here.',
        MOCKUP('materials named in the services copy'),
      ),
    },
    { slug: 'metal-fabrication', title: 'Metal Fabrication', taxonomy: 'metal-fabrication' },
  ],

  traits: {
    'walk-ins': carried('Walk-ins welcome', MOCKUP('the walk-in model')),
    'quote-from-photo': carried('Send a photo for a quote', MOCKUP('the CTA')),
    'from-the-part': carried(
      'Bring a sketch, a sample or a mock-up and we will make the real thing',
      MOCKUP('the fabrication service copy'),
    ),
    'owner-led': carried('Simon owns the shop and runs it', MOCKUP("the owner's first name")),
    'no-minimum': unconfirmed(
      'traits.no-minimum',
      'Is any job too small, or will you take a single bracket?',
    ),
    'on-site': unconfirmed(
      'traits.on-site',
      'Do you ever go out to a site for work that cannot be moved, or is it shop work only?',
    ),
  },

  certifications: [
    unconfirmed(
      'certifications[0]',
      'Do you hold welding certifications, and who carries your liability insurance? Nothing was found in public sources, so the site names neither.',
    ),
  ],

  people: carried('Simon owns the shop and runs it.', MOCKUP("the owner's first name")),

  serviceTowns: [
    'Bergenfield',
    'Dumont',
    'New Milford',
    'Teaneck',
    'Tenafly',
    'Englewood',
    'Paramus',
    'Hackensack',
  ],
  wider: ['Bergen County', 'Northern New Jersey'],

  voice: [
    {
      phrase:
        'Most jobs here are the ones that are too small, too odd, or too urgent for a shop that wants production runs: a cracked bracket, a gate that no longer closes, a custom piece that exists only as a sketch or a mock-up.',
      source:
        "src/content/about/ks-welding/about.md — written by the template stream from the shop's public description; not the owner's words",
      attributed: 'ours-pending-confirmation',
    },
    {
      phrase:
        'You will be told what it costs before the work starts. If it is not a job we can do, we will say so rather than take it on and leave you waiting.',
      source: 'src/content/about/ks-welding/about.md — same provenance as above',
      attributed: 'ours-pending-confirmation',
    },
  ],
};
