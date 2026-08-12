/**
 * WELDING & FABRICATION.
 *
 * Two customers share this trade and they want opposite things. One is a
 * homeowner with a cracked gate who wants to know if they can just turn up
 * and roughly what it will cost. The other is a contractor or a fabricator
 * who wants to know what the shop can handle and how fast.
 *
 * The pack writes for both by answering the turn-up question early and
 * plainly, which is the thing welding-shop websites are worst at: most of
 * them are a phone number and a stock photo of sparks.
 */
import type { CopyContext, FaqTemplate, NichePack, ServiceTemplate } from './types.js';

const IMG = {
  welding: '/images/service-welding-fitting.svg',
  fabrication: '/images/service-custom-fabrication.svg',
  repairs: '/images/service-repairs-rebuilds.svg',
} as const;

function howToStart(ctx: CopyContext): string {
  if (ctx.has('walk-ins') && ctx.has('quote-from-photo')) {
    return `Bring it in, or send a photo and we will tell you what it takes.`;
  }
  if (ctx.has('walk-ins')) return `Bring it to the shop in ${ctx.town} and we will take a look.`;
  return `Call ${ctx.phone} and describe the job.`;
}

const taxonomy: Record<string, ServiceTemplate> = {
  welding: {
    title: 'Welding',
    oneLiner: 'Repairs and joining work on steel, stainless and aluminium.',
    summary: (ctx) => `Welding repairs and joining work in ${ctx.town}.`,
    body: (ctx) => [
      `Cracked, snapped, worn through or never strong enough in the first place — most welding work that comes through the door is a repair, and most of it is on something the owner would rather not replace.`,
      `Bring the piece and you will be told whether welding is actually the right fix. Sometimes it is not, and hearing that is worth more than a weld that fails again in a month.`,
      howToStart(ctx),
    ],
    highlights: (ctx) => [
      'Repairs to steel, stainless and aluminium',
      ...(ctx.has('walk-ins') ? ['Walk-ins welcome'] : []),
      'Told honestly when welding is not the right fix',
    ],
    imageAlt: 'Welder repairing a steel component at the bench',
    icon: 'shield',
    image: IMG.welding,
  },

  'metal-fabrication': {
    title: 'Metal Fabrication',
    oneLiner: 'Custom pieces made from your sketch, your sample, or your mock-up.',
    summary: (ctx) => `Custom metalwork made to order in ${ctx.town}.`,
    body: (ctx) => [
      `Pieces that do not exist yet: a bracket for something the manufacturer never made a bracket for, a frame to fit an awkward space, a part for a restoration where the original is long gone.`,
      `A sketch is enough to start. So is a cardboard mock-up, or the thing it has to bolt to. What matters is that the shop can see what it has to fit.`,
      howToStart(ctx),
    ],
    highlights: () => [
      'Made from a sketch, a sample or a mock-up',
      'One-off pieces, not catalogue parts',
      'Fitted to the assembly, not just to a drawing',
    ],
    imageAlt: 'Custom fabricated steel piece beside the mock-up it was made from',
    icon: 'gear',
    image: IMG.fabrication,
  },

  'railings-gates': {
    title: 'Railings & Gates',
    oneLiner: 'Handrails, gates and security grilles, made to fit the opening you actually have.',
    summary: () => 'Railings and gates built to the opening rather than to a catalogue size.',
    body: (ctx) => [
      `Openings in older buildings are rarely square and almost never a standard size, which is why an off-the-shelf gate fits badly or not at all. Fabricated work is measured to what is there.`,
      `Repairs are as common as new work: a gate that has dropped, a rail that has rusted through at the base, a hinge that has torn out of the post.`,
      howToStart(ctx),
    ],
    highlights: () => [
      'Measured to the opening you have',
      'New work and repairs to existing railings',
    ],
    imageAlt: 'Fabricated steel gate under construction in the shop',
    icon: 'shield',
    image: IMG.fabrication,
  },

  'structural-welding': {
    title: 'Structural Welding',
    oneLiner: 'Beams, posts, lintels and frames for contractors and builders.',
    summary: () => 'Structural steel work for trades who need it right and need it now.',
    body: (ctx) => [
      `Work for builders and contractors: beams, posts, base plates, lintels and the connections between them.`,
      `Structural work carries requirements that vary by job and by inspector, so tell us what has been specified and what has to be signed off before anything is fabricated.`,
      howToStart(ctx),
    ],
    highlights: () => [
      'Fabricated to the specification you were given',
      'Requirements agreed before the steel is cut',
    ],
    imageAlt: 'Welder working on a structural steel frame',
    icon: 'wrench',
    image: IMG.welding,
  },

  'trailer-truck-repair': {
    title: 'Trailer & Truck Repair',
    oneLiner: 'Cracked frames, torn mounts, broken ramps and rusted-out floors.',
    summary: () => 'Welding repairs to trailers, bodies and equipment.',
    body: (ctx) => [
      `Trailers and truck bodies fail in predictable places: the frame at the tongue, the mounts, the ramp hinges, the floor where water has sat.`,
      `The repair is worth doing when the rest of the frame is sound, and it is worth knowing when it is not. You will be told which of the two you have.`,
      howToStart(ctx),
    ],
    highlights: () => [
      'Frames, mounts, ramps and floors',
      'A straight answer on whether the repair is worth doing',
    ],
    imageAlt: 'Welder repairing a cracked trailer frame',
    icon: 'truck',
    image: IMG.repairs,
  },
};

const faq: FaqTemplate[] = [
  {
    id: 'walk-in',
    question: () => 'Can I just bring it in?',
    answer: (ctx) =>
      ctx.has('walk-ins')
        ? `Yes — that is how most work arrives here. Bring the piece during opening hours and you can talk it through with someone looking at it. Small repairs are often done while you wait.`
        : null,
    ifMissing: 'Can customers walk in without an appointment?',
  },
  {
    id: 'cost',
    question: () => 'How much will it cost?',
    answer: (ctx) =>
      `That depends on what the job turns out to need, which is why you get the number before the work starts rather than on the invoice afterwards. ${
        ctx.has('quote-from-photo')
          ? 'Send a photo and you can usually get a sense of it without leaving the yard.'
          : `Call ${ctx.phone} and describe it, or bring it in.`
      }`,
    ifMissing: '',
  },
  {
    id: 'area',
    question: () => 'Where are you, and who do you work for?',
    answer: (ctx) => {
      const area = ctx.record.serviceTowns.concat(ctx.record.wider);
      if (area.length === 0) return null;
      return `The shop is in ${ctx.town}, ${ctx.record.region.value}, and work comes in from ${ctx.list(area.slice(0, 6))}. Customers are a mix: homeowners with one broken thing, contractors, restorers, and other trades who need a piece made.`;
    },
    ifMissing: 'Which towns do most of your customers come from?',
  },
  {
    id: 'too-small',
    question: () => 'Is my job too small to bother you with?',
    answer: (ctx) =>
      ctx.has('no-minimum') || ctx.has('walk-ins')
        ? `No. Small jobs are the bulk of the work here, and they are the ones the bigger shops turn down because they want production runs. A single bracket is a job.`
        : null,
    ifMissing: 'Do you take on small one-piece jobs, or do you need a minimum?',
  },
  {
    id: 'materials',
    question: () => 'What metals can you weld?',
    answer: (ctx) => {
      const detailed = ctx.record.services.find((s) => s.detail !== undefined);
      if (detailed?.detail === undefined) return null;
      return `${detailed.detail.value} If you are not sure what yours is, bring it in — it is a quick thing to identify in person and a slow one to describe over the phone.`;
    },
    ifMissing: 'Which metals do you weld, and which do you turn away?',
  },
  {
    id: 'no-drawing',
    question: () => 'I do not have a drawing. Can you still make it?',
    answer: (ctx) =>
      ctx.has('from-the-part')
        ? `Yes. A sketch, a photo, a cardboard mock-up or the broken original are all enough to work from. Bringing the thing it has to fit is better than any of them.`
        : null,
    ifMissing: 'Can you fabricate from a sketch or a sample rather than a drawing?',
  },
  {
    id: 'on-site',
    question: () => 'Can you come to me?',
    answer: (ctx) =>
      ctx.has('on-site')
        ? `For work that cannot be moved, yes — call and describe what and where, and you will be told whether it is a job for the shop or for the site.`
        : null,
    ifMissing: 'Do you do on-site or mobile welding, or shop work only?',
  },
  {
    id: 'hours',
    question: () => 'When are you open?',
    answer: (ctx) => {
      if (ctx.hours === undefined || ctx.hours.length === 0) return null;
      const open = ctx.hours.filter((h) => !h.closed && h.opens !== undefined && h.closes !== undefined);
      const first = open[0];
      const last = open[open.length - 1];
      if (first === undefined || last === undefined) return null;
      const sameSpan = open.every((h) => h.opens === first.opens && h.closes === first.closes);
      return sameSpan
        ? `${first.day} to ${last.day}, ${first.opens} to ${first.closes}. Weekend and holiday hours are worth a call to check.`
        : `${open.map((h) => `${h.day} ${h.opens}–${h.closes}`).join(', ')}.`;
    },
    ifMissing: 'What are your opening hours, including Saturdays?',
  },
  {
    id: 'wait',
    question: () => 'Will it be done while I wait?',
    answer: (ctx) =>
      ctx.has('walk-ins')
        ? `Some jobs, yes — a small repair on something you can carry in often goes straight on the bench. Anything that needs materials ordered, or that has to cool and be finished, will not. Ask when you arrive and you will be told which one yours is.`
        : null,
    ifMissing: 'Which jobs can you turn around while the customer waits?',
  },
  {
    id: 'who',
    question: () => 'Who runs the shop?',
    answer: (ctx) => {
      const people = ctx.record.people;
      if (people === undefined) return null;
      return `${people.value} That is who you will be dealing with, from the quote to picking the job up.`;
    },
    ifMissing: 'Who owns and runs the shop, and who does a customer speak to?',
  },
];

export const weldingFabrication: NichePack = {
  id: 'welding-fabrication',
  noun: 'welding and fabrication shop',
  work: 'welding and metal fabrication',
  object: 'the job',
  taxonomy,
  faq,
  townLines: (_ctx, town) => [
    `Welding repairs and custom metalwork for ${town} — homeowners with something broken, contractors who need a piece made, and restorers working on things nobody makes parts for any more.`,
    `Most ${town} jobs that come through the door are repairs: a cracked bracket, a gate that no longer closes, a rail that has rusted through at the base.`,
    `For ${town} customers the useful thing about a small shop is that somebody will look at the piece and tell you honestly whether welding is the right fix for it.`,
    `Fabrication for ${town}: a sketch, a sample or a cardboard mock-up is enough to start from, and the piece gets made to fit what you actually have rather than what a catalogue assumes.`,
    `${town} contractors and trades bring in the pieces that hold something else up — the bracket, the frame, the mount that has to be right.`,
  ],
};
