/**
 * GENERAL CONTRACTOR.
 *
 * The one niche of the three where the customer is scared. A homeowner
 * choosing a contractor is not comparing capabilities — they are trying to
 * work out who is going to take a deposit and vanish, who is going to come
 * back for a change order every Tuesday, and who is going to be honest about
 * what is behind the wall.
 *
 * So this pack's copy is disproportionately about process: who they will
 * deal with, what happens when the job uncovers something, how change is
 * handled, and what is in writing before work starts. Contractors' own sites
 * lead with photos of finished kitchens, which is the one thing every
 * competitor also has.
 *
 * Licensing and insurance are the two claims customers most want and the two
 * this pack will never assert on its own. In New Jersey a home-improvement
 * contractor's registration number is a matter of public record and a real
 * legal obligation; publishing one we did not verify is not a copy mistake,
 * it is a regulatory one. Both live behind confirmed certifications.
 */
import { isFact } from '../types.js';
import type { CopyContext, FaqTemplate, NichePack, ServiceTemplate } from './types.js';

const IMG = {
  build: '/images/service-custom-fabrication.svg',
  repair: '/images/service-repairs-rebuilds.svg',
  finish: '/images/service-precision-machining.svg',
} as const;

function howToStart(ctx: CopyContext): string {
  if (ctx.has('quote-from-photo')) {
    return `Send photos of the space and we will tell you what is involved, or call ${ctx.phone} to arrange a look.`;
  }
  return `Call ${ctx.phone} and we will arrange a time to come and look at it properly.`;
}

const taxonomy: Record<string, ServiceTemplate> = {
  'additions-remodeling': {
    title: 'Additions & Remodeling',
    oneLiner: 'Extensions, conversions and whole-room rebuilds, run as one job with one point of contact.',
    summary: (ctx) => `Additions and remodeling work for homes around ${ctx.town}.`,
    body: (ctx) => [
      `Adding to a house or reworking what is already there: extensions, dormers, garage and basement conversions, and rebuilds that take a room back to the studs.`,
      `The part that decides whether one of these goes well is not the finish work — it is what happens when the walls come off and the house turns out to be different from what everyone assumed. You will be shown what was found, what it changes, and what it costs, before it is done rather than afterwards.`,
      howToStart(ctx),
    ],
    highlights: (ctx) => [
      'One point of contact for the whole job',
      'Changes priced and agreed before they are carried out',
      ...(ctx.has('owner-led') ? ['You deal with the owner, not a salesperson'] : []),
    ],
    imageAlt: 'Framed extension under construction on a residential property',
    icon: 'gear',
    image: IMG.build,
  },

  'kitchens-baths': {
    title: 'Kitchens & Bathrooms',
    oneLiner: 'The two rooms where the plumbing, the tiling and the schedule all have to line up.',
    summary: () => 'Kitchen and bathroom work, sequenced so the trades do not trip over each other.',
    body: (ctx) => [
      `Kitchens and bathrooms are the rooms with the most trades per square foot, which is why they are the ones that overrun. Getting them right is mostly scheduling: the tiler cannot start until the plumber is out, and the plumber cannot finish until the units are set.`,
      `That sequencing is our job, not yours. You should not be the person ringing round to find out why nobody turned up on Thursday.`,
      howToStart(ctx),
    ],
    highlights: () => [
      'Trades sequenced and scheduled for you',
      'Written scope before the first day',
      'One person to call when something changes',
    ],
    imageAlt: 'Kitchen mid-renovation with new cabinets being installed',
    icon: 'wrench',
    image: IMG.finish,
  },

  'roofing-siding': {
    title: 'Roofing & Siding',
    oneLiner: 'The outside of the building, where a small problem gets expensive quietly.',
    summary: () => 'Roof and siding work, including the repairs nobody wants to sell you.',
    body: (ctx) => [
      `Roofs and siding fail from the edges in: flashing, valleys, the trim behind the gutter, the course of siding nearest the ground. By the time it shows on a ceiling, the repair has usually grown.`,
      `Where a repair will do, you will be told that a repair will do. A contractor who only ever recommends full replacement is telling you something about their business, not about your roof.`,
      howToStart(ctx),
    ],
    highlights: () => [
      'Repairs recommended where a repair is the right answer',
      'What was found, shown to you before it is closed up',
    ],
    imageAlt: 'Roofer replacing flashing on a residential roof',
    icon: 'shield',
    image: IMG.repair,
  },

  'decks-porches': {
    title: 'Decks & Porches',
    oneLiner: 'Outdoor structures built to hold up, and permitted where they have to be.',
    summary: (ctx) => `Decks, porches and outdoor structures in and around ${ctx.town}.`,
    body: (ctx) => [
      `Decks and porches are structural, which is why they are inspected and why the failures are the dangerous kind: ledger boards pulling off a rim joist, posts set into soil, rails that pass a glance and not a lean.`,
      `Where a permit is required for the work, that is part of the job and not a surprise you find out about later.`,
      howToStart(ctx),
    ],
    highlights: () => [
      'Built to the structural detail, not just to look right',
      'Permitting handled as part of the job',
    ],
    imageAlt: 'New timber deck framing attached to the rear of a house',
    icon: 'gear',
    image: IMG.build,
  },

  'basements-finishing': {
    title: 'Basement Finishing',
    oneLiner: 'Usable rooms downstairs — done in the order that keeps them dry.',
    summary: () => 'Basement conversions, starting with the water and finishing with the room.',
    body: (ctx) => [
      `A finished basement is a straightforward job done in the wrong order and a disaster done in the right one. Water, drainage and ventilation come first; framing, insulation and finishes come after.`,
      `If there is a moisture problem, it gets dealt with before anything is closed in. Building a room over it hides it for a season and then ruins the room.`,
      howToStart(ctx),
    ],
    highlights: () => [
      'Moisture and drainage addressed before framing',
      'Egress and ceiling height checked before design',
    ],
    imageAlt: 'Basement being framed and insulated during a conversion',
    icon: 'wrench',
    image: IMG.build,
  },

  'general-repairs': {
    title: 'Repairs & Small Jobs',
    oneLiner: 'The list of things that are too small for most contractors to return a call about.',
    summary: () => 'Small jobs, taken seriously enough to actually turn up for.',
    body: (ctx) => [
      `Rotten trim, a door that has dropped, a leak that has damaged a ceiling, the list of small things that have accumulated. These are the jobs most contractors will not call back about, because the money is in the big ones.`,
      `Put the whole list together and it becomes a job worth scheduling, which is usually the most efficient way to get them done.`,
      howToStart(ctx),
    ],
    highlights: () => [
      'Small jobs actually scheduled and turned up for',
      'Send the whole list — one visit beats six',
    ],
    imageAlt: 'Carpenter repairing exterior trim on a house',
    icon: 'wrench',
    image: IMG.repair,
  },
};

const faq: FaqTemplate[] = [
  {
    id: 'credentials',
    question: () => 'Are you licensed and insured?',
    answer: (ctx) => {
      const confirmed = ctx.record.certifications.filter(isFact);
      if (confirmed.length === 0) return null;
      return `${confirmed.map((c) => `${c.value.label}: ${c.value.detail}`).join(' ')} Ask to see the paperwork before you sign anything — with us or with anybody else.`;
    },
    ifMissing:
      'What is your NJ home-improvement contractor registration number, and who carries your liability and workers compensation insurance? (Needed in writing — this is the claim customers care about most and the one we will not print unverified.)',
  },
  {
    id: 'estimate',
    question: () => 'How do estimates work?',
    answer: (ctx) =>
      `Someone comes and looks at the job, because an estimate given over the phone for work nobody has seen is a number that will change. You get the scope in writing — what is included, what is not, and what happens if something is found once work starts. ${howToStart(ctx)}`,
    ifMissing: '',
  },
  {
    id: 'change-orders',
    question: () => 'What happens if you find something once the work starts?',
    answer: () =>
      `You get told, and you get shown. Older houses hide things: rot behind siding, undersized framing, wiring that was never right. When one turns up, the work stops at that point, you see what was found and what the options are, and the price of the change is agreed before it goes ahead. Nothing extra appears on the final invoice that you have not already agreed to.`,
    ifMissing: '',
  },
  {
    id: 'who',
    question: () => 'Who will actually be on my job?',
    answer: (ctx) => {
      const people = ctx.record.people;
      if (people === undefined) return null;
      return `${people.value} ${ctx.has('owner-led') ? 'The person who quotes the job is the person running it, so you are never relaying a message through somebody who was not there.' : ''}`.trim();
    },
    ifMissing: 'Who runs the job day to day, and does the owner attend?',
  },
  {
    id: 'permits',
    question: () => 'Do I need a permit, and who deals with it?',
    answer: (ctx) =>
      `Structural work, most additions, decks, and anything touching electric or plumbing generally need one, and requirements differ between towns — ${ctx.town} and its neighbours do not all read the code the same way. Permitting is part of the job we handle, and if a job does not need one you will be told that too rather than charged for it.`,
    ifMissing: '',
  },
  {
    id: 'area',
    question: () => 'What areas do you work in?',
    answer: (ctx) => {
      const area = ctx.record.serviceTowns.concat(ctx.record.wider);
      if (area.length === 0) return null;
      return `Based in ${ctx.town}, working across ${ctx.list(area.slice(0, 6))}. Staying local is deliberate: a contractor who is twenty minutes away comes back to fix a snag, and one who is two hours away finds a reason not to.`;
    },
    ifMissing: 'Which towns do you work in, and how far will you travel?',
  },
  {
    id: 'timeline',
    question: () => 'How long will my job take, and when could you start?',
    answer: () =>
      `Both depend on the job and on what is already booked, so you get real dates rather than reassuring ones. What we will not do is start your job to hold the slot and then disappear onto somebody else's — a crew that is on your site is on your site.`,
    ifMissing: '',
  },
  {
    id: 'payment',
    question: () => 'How does payment work?',
    answer: (ctx) => {
      const terms = ctx.trait('free-quotes');
      if (terms === undefined) return null;
      return `${terms} Payments are staged against work completed, set out in the written scope before anything starts. Be wary of anyone asking for the bulk of the money up front — that is the single most reliable warning sign in this trade.`;
    },
    ifMissing:
      'How do you stage payments, and do you charge for estimates? (Payment terms are a commitment — we will not describe them without your confirmation.)',
  },
  {
    id: 'references',
    question: () => 'Can I see work you have done nearby?',
    answer: (ctx) =>
      ctx.record.serviceTowns.length > 0
        ? `Ask. Work in ${ctx.list(ctx.record.serviceTowns.slice(0, 3))} is close enough that seeing a finished job in person is usually possible, and it tells you more than any photograph. A contractor who cannot show you anything is worth a second thought.`
        : null,
    ifMissing: 'Which recent local jobs are you happy for prospective customers to view?',
  },
  {
    id: 'hours',
    question: () => 'What hours do you work?',
    answer: (ctx) => {
      if (ctx.hours === undefined || ctx.hours.length === 0) return null;
      const open = ctx.hours.filter((h) => !h.closed && h.opens !== undefined && h.closes !== undefined);
      const first = open[0];
      const last = open[open.length - 1];
      if (first === undefined || last === undefined) return null;
      return `${first.day} to ${last.day}, ${first.opens} to ${first.closes}. Crews start early, which is worth knowing if you have neighbours who will not thank you for it.`;
    },
    ifMissing: 'What are your normal working hours on site?',
  },
];

export const generalContractor: NichePack = {
  id: 'general-contractor',
  noun: 'general contractor',
  work: 'building and remodeling',
  object: 'the project',
  taxonomy,
  faq,
  townLines: (_ctx, town) => [
    `Additions, remodeling and repair work for homeowners in ${town} — with the scope written down before the first day and the changes agreed before they happen.`,
    `${town} houses hide the usual things behind their walls. What matters is that you are shown what was found and asked about it, rather than billed for it at the end.`,
    `Permit requirements differ from one town to the next, and ${town}'s are handled as part of the job rather than raised as a surprise partway through.`,
    `Work in ${town} runs with one point of contact: the person who quoted the job is the person you call when something changes on it.`,
    `For ${town} homeowners the questions worth asking any contractor are the same three — what is in the written scope, what happens when something is found, and who is actually on site.`,
  ],
};
