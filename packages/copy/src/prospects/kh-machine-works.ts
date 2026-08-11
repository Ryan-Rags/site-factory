/**
 * K-H MACHINE WORKS INC — North Bergen, NJ.
 *
 * The best-sourced of the five on history: 1918 is stated by K-H themselves
 * on their live site and corroborated by two directory listings, which is why
 * it is the one client whose copy can carry a founding year without a marker.
 *
 * It is also the only one of the five with a genuine voice note. "Keeping
 * Things Running Since 1918" is K-H's own hero line, so the tagline derived
 * from it is a quotation rather than our invention. Everything else in the
 * About section is ours until the owner says otherwise, and is labelled so.
 */
import { carried, fact, unconfirmed, type ProspectRecord } from '../types.js';

/** The one provenance string that appears on more than one fact. */
const LIVE_SITE = "K-H's own live site khmachineworks.com, retrieved Aug 2026";

export const khMachineWorks: ProspectRecord = {
  slug: 'kh-machine-works',
  niche: 'machine-shop',

  tradingName: fact('K-H Machine Works', LIVE_SITE),
  legalName: fact('K-H Machine Works Inc', `${LIVE_SITE}; corroborated by D&B and Manta listings`),
  town: fact('North Bergen', `${LIVE_SITE}; address published by K-H`),
  region: fact('NJ', LIVE_SITE),
  // Hudson County, not Bergen. This record is the reason `partitionTowns`
  // exists: the Bergen County service-area sections must not silently claim
  // a Hudson County shop is a Bergen one.
  county: fact('Hudson County', `${LIVE_SITE}; North Bergen is in Hudson County, NJ`),
  phone: fact('(201) 867-2338', LIVE_SITE),
  email: fact('KHCanDo@optonline.net', LIVE_SITE),
  foundedYear: fact(
    1918,
    `${LIVE_SITE} — hero line "Keeping Things Running Since 1918"; corroborated by D&B and Manta listings (est. 1918)`,
  ),

  hours: carried(
    [
      { day: 'Monday', opens: '07:00', closes: '16:30' },
      { day: 'Tuesday', opens: '07:00', closes: '16:30' },
      { day: 'Wednesday', opens: '07:00', closes: '16:30' },
      { day: 'Thursday', opens: '07:00', closes: '16:30' },
      { day: 'Friday', opens: '07:00', closes: '15:00' },
      { day: 'Saturday', closed: true },
      { day: 'Sunday', closed: true },
    ],
    'clients/kh-machine-works.config.ts — hours carried from the approved mockup, not re-verified this run',
  ),

  // geo deliberately absent. See `Geo` in types.ts: coordinates arrive from
  // the pipeline's ingestion path or not at all, and this package never calls
  // Places to fill the gap.

  services: [
    {
      slug: 'precision-machining',
      title: 'Precision Machining',
      taxonomy: 'precision-machining',
    },
    { slug: 'repairs-rebuilds', title: 'Repairs & Rebuilds', taxonomy: 'repairs-rebuilds' },
    { slug: 'custom-fabrication', title: 'Custom Fabrication', taxonomy: 'custom-fabrication' },
    {
      slug: 'welding-fitting',
      title: 'Welding & Fitting',
      taxonomy: 'welding-fitting',
      detail: carried(
        'Steel, stainless and aluminium are all worked here, along with on-bench fitting and assembly.',
        'clients/kh-machine-works.config.ts service one-liner — read back to the owner before publishing',
      ),
    },
  ],

  traits: {
    'no-minimum': carried(
      'One-off parts welcome — no minimum order',
      'clients/kh-machine-works.config.ts trust strip — read back to the owner',
    ),
    'from-the-part': carried(
      'Bring the broken part and we will measure it and make a new one',
      'clients/kh-machine-works.config.ts service one-liner — read back to the owner',
    ),
    'quote-from-photo': carried(
      'Send a photo and the dimensions for a quote',
      'clients/kh-machine-works.config.ts CTA — read back to the owner',
    ),
    'owner-led': carried(
      'You deal with the machinist, not a salesperson',
      'clients/kh-machine-works.config.ts about copy — read back to the owner',
    ),
    // Deliberately unconfirmed rather than assumed from "family-run since
    // 1918". Family continuity over a century is a strong claim and it is a
    // different claim from current family ownership.
    'family-run': unconfirmed(
      'traits.family-run',
      'Is the business still family-owned today, and is it the same family it started with in 1918?',
    ),
    rush: unconfirmed(
      'traits.rush',
      'Do you take breakdown work that has to be turned round the same day, and how should a customer flag it when they call?',
    ),
  },

  certifications: [
    unconfirmed(
      'certifications[0]',
      'Do you hold any certifications, trade affiliations or quality approvals we can name? (Nothing has been found in public sources, so the site currently names none.)',
    ),
  ],

  // `people` deliberately omitted, which is why nothing in K-H's copy says who
  // runs the shop. The earlier mockup's "the same family keeping things
  // running since 1918" conflated the company's age with a family's tenure —
  // nobody has stood at a machine since 1918 — and the absence of this field
  // is what stops that line being reconstructible.

  serviceTowns: [],
  wider: [
    'North Bergen',
    'Union City',
    'Secaucus',
    'Jersey City',
    'Hoboken',
    'Hudson County',
    'Northern New Jersey',
    'the New York City metro area',
  ],

  voice: [
    {
      phrase:
        'Keeping things running since 1918 — the one-off bracket, the shaft nobody makes any more, the pump housing that has to be back on the line tomorrow morning.',
      source: `${LIVE_SITE} — hero line "Keeping Things Running Since 1918", extended with the work types described in the approved mockup`,
      // Half quotation, half ours. Labelled by the weaker half on purpose.
      attributed: 'ours-pending-confirmation',
    },
    {
      phrase:
        'We are not the cheapest shop in the county and we do not pretend to be. What we offer is a machinist who will pick up the phone, tell you honestly whether the job is worth doing, and stand behind the work when it leaves the building.',
      source:
        'src/content/about/kh-machine-works/about.md — written by the template stream from K-H\'s public description of itself; not the owner\'s words',
      attributed: 'ours-pending-confirmation',
    },
  ],

  // `profile` omitted: we hold review numbers on the lead row, and this
  // package would only ever decline to print them. Carrying them here would
  // suggest otherwise.
};
