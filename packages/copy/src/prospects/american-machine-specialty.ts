/**
 * AMERICAN MACHINE SPECIALTY LLC — Westwood, NJ. Bergen County.
 *
 * The best-sourced record of the five, and the only one with confirmed
 * certifications — which is why it is the only one whose trust strip can say
 * "ISO 9001:2015" without a marker, and the only one whose FAQ can answer the
 * licensing question at all.
 *
 * ON SERVICE TOWNS. AMS states a Bergen County service area itself. Naming
 * individual Bergen municipalities within that is an inference from the
 * business's own claim, not a new claim of our own — a shop that says it
 * serves the county serves the towns in it. That inference is the only one
 * this record makes, it is recorded here rather than buried in a generator,
 * and the towns chosen are near Westwood so the resulting copy is plausible
 * as well as permitted. If AMS says otherwise, this list is what changes.
 */
import { fact, unconfirmed, type ProspectRecord } from '../types.js';

const LIVE_SITE = "AMS's own live site americanmachinespecialty.com, retrieved Aug 2026";
const COUNTY_INFERENCE =
  'Bergen municipality within the county-level service area AMS states for itself; see the module note';

export const americanMachineSpecialty: ProspectRecord = {
  slug: 'american-machine-specialty',
  niche: 'machine-shop',

  tradingName: fact('American Machine Specialty', LIVE_SITE),
  legalName: fact('American Machine Specialty LLC', LIVE_SITE),
  town: fact('Westwood', `${LIVE_SITE}; address published by AMS`),
  region: fact('NJ', LIVE_SITE),
  county: fact('Bergen County', 'Westwood is a Bergen County, NJ municipality — public record'),
  phone: fact('(201) 664-2100', LIVE_SITE),
  // NOTE: this inbox is on a different domain from the marketing site. Both
  // were sourced independently; the mismatch is unexplained and may be a
  // legacy mail domain. Flagged for confirmation rather than silently
  // preferred one way or the other.
  email: fact('info@amsconj.com', `${LIVE_SITE}; domain differs from the site's — confirm which is current`),
  foundedYear: fact(1990, LIVE_SITE),

  hours: fact(
    [
      { day: 'Monday', opens: '08:00', closes: '17:00' },
      { day: 'Tuesday', opens: '08:00', closes: '17:00' },
      { day: 'Wednesday', opens: '08:00', closes: '17:00' },
      { day: 'Thursday', opens: '08:00', closes: '17:00' },
      { day: 'Friday', opens: '08:00', closes: '17:00' },
      { day: 'Saturday', closed: true },
      { day: 'Sunday', closed: true },
    ],
    LIVE_SITE,
  ),

  services: [
    {
      slug: 'precision-machining',
      title: 'Precision Machining',
      taxonomy: 'precision-machining',
      detail: fact(
        '5-axis and 3-axis milling alongside CNC turning, on HAAS and Doosan machining centres.',
        `${LIVE_SITE} — published equipment list (HAAS UMC-500SS, Doosan DNM 5700, Doosan HC 400, Doosan Lynx 2100)`,
      ),
    },
    {
      slug: 'contract-manufacturing',
      title: 'Contract Manufacturing',
      taxonomy: 'contract-manufacturing',
      detail: fact(
        'Build-to-print production for medical, aerospace and instrumentation customers.',
        `${LIVE_SITE} — markets served, stated by AMS`,
      ),
    },
    {
      slug: 'inspection-quality',
      title: 'Inspection & Quality',
      taxonomy: 'inspection-quality',
      detail: fact(
        'Inspection on a Mitutoyo Crysta PM443 coordinate measuring machine in a temperature-controlled room.',
        `${LIVE_SITE} — published equipment list`,
      ),
    },
  ],

  traits: {
    'production-runs': fact(
      'First article through to ongoing production',
      `${LIVE_SITE} — contract manufacturing described by AMS`,
    ),
    'family-run': fact(
      'Woman-owned and family-run',
      `${LIVE_SITE} — WOSB status and family ownership stated by AMS`,
    ),
    // Not a walk-in shop and should not be written as one: this is an RFQ
    // business whose customers send drawing packages.
    'quote-from-photo': unconfirmed(
      'traits.quote-from-photo',
      'Should the site invite photos as well as drawings and STEP files, or do you only want proper drawing packages?',
    ),
  },

  certifications: [
    fact(
      {
        label: 'ISO 9001:2015',
        detail: 'Quality management system certified by Perry Johnson Registrars.',
      },
      `${LIVE_SITE} — certification and registrar both named by AMS`,
    ),
    fact(
      {
        label: 'WOSB — Woman-Owned Small Business',
        detail: 'Woman-owned and family-run.',
      },
      `${LIVE_SITE} — stated by AMS`,
    ),
  ],

  // `people` omitted: AMS names no individuals publicly, and inventing a
  // "meet the team" line is exactly the kind of warmth that turns out to be
  // fiction when the client reads it.

  serviceTowns: [
    'Westwood',
    'Hillsdale',
    'Emerson',
    'River Vale',
    'Washington Township',
    'Oradell',
    'Paramus',
    'Montvale',
  ],
  wider: ['Bergen County', 'Northern New Jersey', 'the New York metro area'],

  voice: [
    {
      phrase:
        'The work is contract manufacturing for customers who have to prove every dimension: medical, aerospace and instrumentation. That means build-to-print parts, first articles, and ongoing production runs where the hundredth part has to match the first one.',
      source:
        'src/content/about/american-machine-specialty/about.md — written by the template stream from AMS\'s own published description of its markets and capabilities; not the owner\'s words',
      attributed: 'ours-pending-confirmation',
    },
    {
      phrase:
        'Inspection is not an afterthought here — for most of our customers it is the reason they came to us.',
      source: 'src/content/about/american-machine-specialty/about.md — same provenance as above',
      attributed: 'ours-pending-confirmation',
    },
  ],
};

/**
 * The inference recorded once, exported so the report can cite it verbatim
 * rather than paraphrasing it into something weaker.
 */
export const COUNTY_INFERENCE_NOTE = COUNTY_INFERENCE;
