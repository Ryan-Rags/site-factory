/**
 * MACHINE SHOP.
 *
 * The customer here is almost never a consumer. They are a maintenance
 * manager with a line down, an engineer who needs a first article proved, or
 * a contractor holding a part nobody makes any more. What they want from a
 * website is a fast read on two things: will this shop take my job, and can I
 * talk to someone who knows what they are looking at.
 *
 * So the copy leads with the work and the route to a human, and stays away
 * from the three things every machine shop site says and none of them prove —
 * quality, precision and service.
 */
import { orList } from '../text.js';
import type { CopyContext, FaqTemplate, NichePack, ServiceTemplate } from './types.js';

const IMG = {
  machining: '/images/service-precision-machining.svg',
  repairs: '/images/service-repairs-rebuilds.svg',
  fabrication: '/images/service-custom-fabrication.svg',
  welding: '/images/service-welding-fitting.svg',
} as const;

/**
 * The line every machine-shop customer wants and almost no machine-shop site
 * gives them: how to start, in one sentence, with no form in the way.
 */
function howToStart(ctx: CopyContext): string {
  if (ctx.has('quote-from-photo')) {
    return `Send a photo and the dimensions, or bring the part to the shop in ${ctx.town}.`;
  }
  if (ctx.has('walk-ins')) {
    return `Call, or bring the part to the shop in ${ctx.town}.`;
  }
  return `Call the shop and tell us what the part is, what it does and when you need it.`;
}

const taxonomy: Record<string, ServiceTemplate> = {
  'precision-machining': {
    title: 'Precision Machining',
    oneLiner: 'Turning, milling and grinding to print, from one piece to a short run.',
    summary: (ctx) => `Machining to your drawing, done in ${ctx.town}.`,
    body: (ctx) => [
      `Work to print: turning, milling, drilling and grinding, in the materials the job calls for. Send the drawing and we will tell you whether it is work we take on and what it involves.`,
      ctx.has('no-minimum')
        ? `There is no minimum order. A single piece is a job like any other, and it is quoted the same way.`
        : `Quantities from a first article through to a repeat order, quoted the same way each time.`,
      howToStart(ctx),
    ],
    highlights: (ctx) => [
      'Machined to your drawing or your sample',
      ...(ctx.has('no-minimum') ? ['One-off pieces welcome — no minimum order'] : []),
      ...(ctx.has('from-the-part') ? ['No drawing? We can work from the part itself'] : []),
      'You deal with the people doing the work',
    ],
    imageAlt: 'Finished machined steel components on a workbench',
    icon: 'precision',
    image: IMG.machining,
  },

  'general-machining': {
    title: 'General Machining',
    oneLiner: 'Machining for manufacturers and maintenance departments, from one piece upward.',
    summary: (ctx) => `Day-to-day machining work for shops and plants around ${ctx.town}.`,
    body: (ctx) => [
      `The everyday work: turning, milling, threading, boring and finishing, in steel, stainless and the other materials that come through a working shop. Bring the drawing, the sample or the part itself.`,
      `Most of what comes in is not a production run. It is one thing that has to be right, and back where it belongs.`,
      howToStart(ctx),
    ],
    highlights: (ctx) => [
      'Work from a drawing, a sample or the part itself',
      ...(ctx.has('walk-ins') ? ['Walk-ins welcome'] : []),
      ...(ctx.has('rush') ? ['Urgent work taken on — say so when you call'] : []),
    ],
    imageAlt: 'Machined metal components on a workbench',
    icon: 'precision',
    image: IMG.machining,
  },

  machining: {
    title: 'Machining',
    oneLiner: 'Machined parts made to your drawing, your sample or the part you bring in.',
    summary: (ctx) => `Machining work taken on at the shop in ${ctx.town}.`,
    body: (ctx) => [
      `Parts machined to what you need: from a drawing, from a sample, or from the worn part itself where no drawing exists.`,
      `The quickest way to find out whether a job is one we take on is to ask. Tell us what the part is, what it does and when you need it, and you will get a straight answer rather than a form response.`,
      howToStart(ctx),
    ],
    highlights: () => [
      'Work from a drawing, a sample or the part itself',
      'A straight answer on whether the job is one we take on',
    ],
    imageAlt: 'Machined metal components on a workbench',
    icon: 'precision',
    image: IMG.machining,
  },

  manufacturing: {
    title: 'Manufacturing',
    oneLiner: 'Parts made to order, from a single piece through to a repeat run.',
    summary: (ctx) => `Manufacturing work from the shop in ${ctx.town}.`,
    body: (ctx) => [
      `Making parts to order rather than selling them off a shelf: you bring the requirement, we work out what it takes to produce it and what that costs.`,
      `Quantities and repeat schedules are worked out per job. Call and describe what you need made and how often you need it.`,
      howToStart(ctx),
    ],
    highlights: () => [
      'Made to order, not off the shelf',
      'One piece or a repeat run',
    ],
    imageAlt: 'Manufactured metal parts ready for despatch',
    icon: 'gear',
    image: IMG.fabrication,
  },

  'contract-manufacturing': {
    title: 'Contract Manufacturing',
    oneLiner: 'Ongoing build-to-print production, where the hundredth part matches the first.',
    summary: () => 'Build-to-print production for customers who have to prove every dimension.',
    body: (ctx) => [
      `Build-to-print production: you own the design, we make it repeatably. First article through to ongoing runs, with the process documented so the parts do not drift between orders.`,
      ctx.has('production-runs')
        ? `Repeat schedules are planned with you rather than quoted job by job, so the parts are on the shelf when your build needs them.`
        : `Scheduling is agreed per programme.`,
      `Send the drawing package and the quantities and we will come back with a quote and a lead time.`,
    ],
    highlights: () => [
      'Build to your print, to your revision',
      'First article through to ongoing production',
      'Documented process, so parts do not drift between runs',
    ],
    imageAlt: 'Production run of finished machined parts ready for inspection',
    icon: 'gear',
    image: IMG.fabrication,
  },

  'inspection-quality': {
    title: 'Inspection & Quality',
    oneLiner: 'Dimensional inspection, documented, so you can prove the part as well as ship it.',
    summary: () => 'Inspection treated as part of the job, not an afterthought at the end of it.',
    body: () => [
      `For regulated and precision work, the part is only half of what you are buying. The other half is the evidence that it is what the drawing says it is.`,
      `Dimensional inspection is carried out against your drawing and the results recorded, so the paperwork that has to accompany the part exists before it leaves.`,
      `Tell us what documentation your customer or your auditor expects and we will confirm what we can supply.`,
    ],
    highlights: () => [
      'Inspected against your drawing, and recorded',
      'Documentation agreed before the job starts',
    ],
    imageAlt: 'Coordinate measuring machine inspecting a machined part',
    icon: 'shield',
    image: IMG.repairs,
  },

  'repairs-rebuilds': {
    title: 'Repairs & Rebuilds',
    oneLiner: 'Bring us the broken part. We measure it, make it, and get you running.',
    summary: (ctx) => `Repair and rebuild work for machinery around ${ctx.town} and beyond.`,
    body: (ctx) => [
      `A worn shaft, a seized housing, a component the manufacturer no longer supports. Bring us what came out and we will work out what failed and what it takes to put it right.`,
      `Where a replacement can no longer be bought, it can usually be made. That is often the difference between a repair and a new machine.`,
      howToStart(ctx),
    ],
    highlights: (ctx) => [
      'Worn parts measured and remade',
      ...(ctx.has('from-the-part') ? ['No drawing needed — we work from the part'] : []),
      ...(ctx.has('rush') ? ['Line down? Say so when you call'] : []),
    ],
    imageAlt: 'Worn industrial shaft being measured with a micrometer',
    icon: 'wrench',
    image: IMG.repairs,
  },

  'replacement-parts': {
    title: 'Replacement Parts',
    oneLiner: 'Bring the worn part in and we will make you a new one.',
    summary: () => 'Parts for machines nobody supports any more.',
    body: (ctx) => [
      `When the machine still works and the part is no longer sold, the part can be made. Bring in the worn one — or what is left of it — and it gets measured and remade.`,
      `This is most of what keeps older plant running, and it is usually a fraction of what replacing the machine would cost.`,
      howToStart(ctx),
    ],
    highlights: (ctx) => [
      'Obsolete and unsupported parts remade',
      'Measured from the original, not guessed at',
      ...(ctx.has('walk-ins') ? ['Walk the part in — no appointment needed'] : []),
    ],
    imageAlt: 'Worn industrial shaft being measured with a micrometer',
    icon: 'wrench',
    image: IMG.repairs,
  },

  'rush-repairs': {
    title: 'Rush Repairs',
    oneLiner: 'Line down? Call or walk it in and you will get a straight answer on what can be done.',
    summary: () => 'Urgent work, and an honest answer about it.',
    body: (ctx) => [
      `When a line is down the only thing worth knowing is whether this shop can help today, and if not, when. You will be told which it is.`,
      `What we will not do is take the job, keep it on the bench and let you find out on Friday that it was never going to be ready. If the timing does not work, you hear that up front while you still have options.`,
      howToStart(ctx),
    ],
    highlights: (ctx) => [
      'A straight answer on timing, up front',
      ...(ctx.has('walk-ins') ? ['Walk it in — no appointment needed'] : []),
    ],
    imageAlt: 'Machinist working on an urgent repair at the bench',
    icon: 'clock',
    image: IMG.repairs,
  },

  prototypes: {
    title: 'Prototypes',
    oneLiner: 'First articles and one-off proof parts, made from your drawing or your sample.',
    summary: () => 'The part that has to exist before the run can be committed.',
    body: (ctx) => [
      `A prototype is a different job from a production part: the drawing is still moving, the tolerances are still being argued about, and what you need is something real to test.`,
      `Bring the drawing or the sketch and we will make the piece — and tell you where the design is going to be awkward or costly to produce before you commit a run to it.`,
      howToStart(ctx),
    ],
    highlights: () => [
      'One-off proof parts and first articles',
      'Made from a drawing, a sketch or a sample',
      'Told up front where a design will be awkward to produce',
    ],
    imageAlt: 'A one-off prototype part beside the drawing it was made from',
    icon: 'gear',
    image: IMG.fabrication,
  },

  'custom-fabrication': {
    title: 'Custom Fabrication',
    oneLiner: 'Brackets, shafts, bushings and fixtures built from a sketch or a sample.',
    summary: (ctx) => `One-off metalwork made to order in ${ctx.town}.`,
    body: (ctx) => [
      `The pieces that do not come from a catalogue: mounting brackets, spacers, bushings, guards, jigs and fixtures. A sketch on the back of an envelope is enough to start from.`,
      `If you have the thing it has to fit, bring that too. Fitting to a real assembly beats fitting to a dimension somebody wrote down.`,
      howToStart(ctx),
    ],
    highlights: () => [
      'Made from a sketch, a sample or an assembly',
      'One-off pieces, not catalogue parts',
    ],
    imageAlt: 'Custom fabricated steel bracket next to the sketch it was made from',
    icon: 'gear',
    image: IMG.fabrication,
  },

  'welding-fitting': {
    title: 'Welding & Fitting',
    oneLiner: 'Welding and on-bench fitting, so the assembly leaves as one finished piece.',
    summary: () => 'Welding and assembly work alongside the machining.',
    body: (ctx) => [
      `Welding and fitting done in the same building as the machining, which means an assembly does not have to travel between two trades and two schedules to get finished.`,
      `Tell us what the material is and what the joint has to do. If it is not work we take on, you will be told that rather than sold it.`,
      howToStart(ctx),
    ],
    highlights: () => [
      'Welding and machining under one roof',
      'Assemblies finished and fitted before they leave',
    ],
    imageAlt: 'Welder joining a steel assembly in the fabrication bay',
    icon: 'shield',
    image: IMG.welding,
  },
};

/**
 * The question bank.
 *
 * These are the questions that get asked on the phone. Not "what are your
 * hours" alone, but the ones a customer is slightly embarrassed to ask and
 * therefore never does — do you take small jobs, do I need a drawing, what
 * happens if it is wrong. Answering them in writing is most of the value of
 * an FAQ; the SEO is a side effect.
 */
const faq: FaqTemplate[] = [
  {
    id: 'area',
    question: () => 'Where are you, and what areas do you cover?',
    answer: (ctx) => {
      const area = ctx.record.serviceTowns.concat(ctx.record.wider);
      if (area.length === 0) return null;
      return `The shop is in ${ctx.town}, ${ctx.record.region.value}. Work comes in from ${ctx.list(area.slice(0, 6))}. If you are outside that and the job travels, call and ask — parts get shipped both ways more often than people expect.`;
    },
    ifMissing: 'Which towns and areas do most of your customers come from?',
  },
  {
    id: 'quote',
    question: () => 'How do I get a quote?',
    answer: (ctx) => {
      const routes: string[] = ['call the shop'];
      if (ctx.email !== undefined) routes.push(`email ${ctx.email}`);
      if (ctx.has('walk-ins')) routes.push(`bring the part in`);
      return `You can ${orList(routes)}. Tell us what the part is, what it does and when you need it. ${
        ctx.has('quote-from-photo')
          ? 'A photo with a ruler or a caliper next to it is usually enough to start.'
          : 'A drawing helps, but a description and a photo are enough to start.'
      }`;
    },
    ifMissing: 'What is the best way for a new customer to reach you for a quote?',
  },
  {
    id: 'what-to-send',
    question: () => 'What do you need from me to quote a job?',
    answer: () => {
      return `A drawing if you have one. If you do not, the part itself, a photo, or the dimensions and the material will get us most of the way. The two things people forget to say are the quantity and the date they need it — both change the answer, so include them.`;
    },
    ifMissing: '',
  },
  {
    id: 'no-drawing',
    question: () => 'I do not have a drawing. Can you still make the part?',
    answer: (ctx) =>
      ctx.has('from-the-part')
        ? `Yes. Bring in the old part, or what is left of it, and it gets measured and remade from that. Where a part has worn, the measurements are taken from the surfaces that have not, so the new one goes back to what it was meant to be rather than copying the wear.`
        : null,
    ifMissing: 'Can you work from a sample or a worn part when the customer has no drawing?',
  },
  {
    id: 'one-off',
    question: () => 'Will you take on a single part, or is there a minimum order?',
    answer: (ctx) => {
      if (ctx.has('no-minimum')) {
        return `A single part is fine — there is no minimum order. One-offs are a large share of the work here, and they are quoted the same way a batch is.`;
      }
      if (ctx.has('production-runs')) {
        return `Both one-off and production work is taken on. Tell us the quantity when you ask, because the quantity is what decides how the job is set up and therefore what it costs per piece.`;
      }
      return null;
    },
    ifMissing: 'Do you take single pieces, or is there a minimum order?',
  },
  {
    id: 'lead-time',
    question: () => 'How long will it take?',
    answer: () =>
      `It depends on the work and on what is already on the machines when your job comes in, so ask when you call and you will get the real answer rather than an optimistic one. If a date matters, say so up front — it is easier to plan around than to rescue.`,
    ifMissing: '',
  },
  {
    id: 'first-call',
    question: () => 'What happens after I get in touch?',
    answer: () =>
      `Someone looks at what you have sent or brought in, and you get told three things: whether it is work we take on, roughly what it involves, and when it could be done. If it is not work for us, you hear that straight away rather than after a week of waiting — and where we can, you get pointed at somebody who does take it on. Then the job is quoted before anything is started.`,
    ifMissing: '',
  },
  {
    id: 'worth-it',
    question: () => 'What if the repair is not worth doing?',
    answer: () =>
      `Then you will be told that. Sometimes making a new part costs more than the assembly it goes into is worth, and sometimes what has failed will fail again in the same place because the design was always going to. Either way you get the assessment before you commit to anything — a shop that never talks a customer out of a job is telling you something about how it makes its money.`,
    ifMissing: '',
  },
  {
    id: 'rush',
    question: () => 'Something has broken and the line is down. Can you help today?',
    answer: (ctx) =>
      ctx.has('rush')
        ? `Say that when you call. Urgent breakdown work is the kind of job this shop is set up for, and the first thing you will get is a straight answer on whether it can be done in your window — including when it cannot.`
        : null,
    ifMissing: 'Do you take emergency breakdown work, and how should a customer flag it?',
  },
  {
    id: 'walk-in',
    question: () => 'Can I just bring the part in?',
    answer: (ctx) =>
      ctx.has('walk-ins')
        ? `Yes. Walk-ins are welcome during opening hours — bring the part and you can talk it through with someone looking at it, which beats describing it over the phone.`
        : null,
    ifMissing: 'Can customers walk in without an appointment, or do you prefer a call first?',
  },
  {
    id: 'hours',
    question: () => 'When are you open?',
    answer: (ctx) => {
      if (ctx.hours === undefined || ctx.hours.length === 0) return null;
      const open = ctx.hours.filter((h) => !h.closed && h.opens !== undefined && h.closes !== undefined);
      if (open.length === 0) return null;
      const first = open[0];
      const last = open[open.length - 1];
      if (first === undefined || last === undefined) return null;
      const sameSpan = open.every((h) => h.opens === first.opens && h.closes === first.closes);
      const span = sameSpan
        ? `${first.day} to ${last.day}, ${first.opens} to ${first.closes}`
        : open.map((h) => `${h.day} ${h.opens}–${h.closes}`).join(', ');
      return `${span}. The full table is on the contact page, and the phone is the fastest way to catch someone.`;
    },
    ifMissing: 'What are your opening hours, including weekends?',
  },
  {
    id: 'who',
    question: () => 'Who will I be dealing with?',
    answer: (ctx) => {
      const people = ctx.record.people;
      if (people === undefined) return null;
      return `${people.value} You are talking to the people who will do the work, which is why you can get an answer about the job rather than a message passed on.`;
    },
    ifMissing: 'Who does a customer actually speak to when they call?',
  },
  {
    id: 'materials',
    question: () => 'What materials do you work in?',
    answer: (ctx) => {
      const detailed = ctx.record.services.find((s) => s.detail !== undefined);
      if (detailed?.detail === undefined) return null;
      return `${detailed.detail.value} If you are not sure what the original was made from, bring it in — that is usually easier to answer with the part in hand than over the phone.`;
    },
    ifMissing: 'Which materials do you regularly work in, and which do you not take on?',
  },
  {
    id: 'not-right',
    question: () => 'What if the part is not right?',
    answer: (ctx) =>
      ctx.has('owner-led')
        ? `Bring it back and speak to the owner. A shop this size cannot hide behind a process — the person who takes the call is the person accountable for the work, and that is the practical reason small shops get this right more often than large ones.`
        : null,
    ifMissing: 'What do you want a customer to do if a part comes back wrong?',
  },
];

export const machineShop: NichePack = {
  id: 'machine-shop',
  noun: 'machine shop',
  work: 'machining',
  object: 'the part',
  taxonomy,
  faq,
  townLines: (_ctx, town) => [
    `Parts, repairs and one-off pieces for customers in ${town} — manufacturers, maintenance departments, contractors and building engineers who need something made, measured or put right.`,
    `Work comes in from ${town} the way it comes in from anywhere: somebody has a part that has failed, a drawing that needs making, or a machine standing idle waiting on one piece.`,
    `For ${town} customers this is mostly repair and replacement work — the component nobody sells any more, the shaft that has worn, the bracket that was never right in the first place.`,
    `${town} manufacturers and maintenance departments use a shop like this for the jobs that do not justify a production run: one part, made properly, back where it belongs.`,
    `If you are in ${town} and holding something broken, the useful first step is a conversation with somebody who can look at it and say whether it can be made again.`,
  ],
};
