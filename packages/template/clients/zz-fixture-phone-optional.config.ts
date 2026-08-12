import type { SiteConfig } from '../src/types/site';

/**
 * TEST FIXTURE — NOT A PROSPECT. NOT A CLIENT. NEVER DEPLOYED.
 *
 * There is exactly one reason this file exists: something has to prove that
 * `forms.fields` actually works — that a shop can ask for an email address
 * instead of a phone number, that the form renders that way, and that the
 * Worker enforces it server-side rather than taking the form's word for it.
 *
 * The five pitchable demos stay uniform, so none of them is that something. A
 * real prospect's form is not a test fixture: the shop is going to see it, and
 * "we changed what your website asks customers for, to test our validator" is
 * not a sentence anybody should have to say.
 *
 * Hence a ninth config, named so that nobody can mistake it for a prospect:
 *
 *   - Every business detail below is invented, and looks it. The phone number
 *     is in the 555-01xx range, which is reserved for fiction and rings nowhere.
 *   - `seo.noindex` is true, like every other config here.
 *   - `scripts/build-all.mjs` skips it, so it never lands in `dist/` during a
 *     batch build and therefore never reaches `deploy-mockups.mjs`, which
 *     deploys whatever it finds there.
 *   - Build it deliberately, on its own:
 *       SITE_CLIENT=zz-fixture-phone-optional pnpm --filter @site-factory/template build
 *
 * The rule it exercises: `phone: 'optional'` with `email: 'required'`. A
 * submission with a phone number and no email is refused — by the form as a
 * courtesy, and by the Worker as the thing that counts. That is the legal
 * asymmetric shape; `phone: 'optional'` with `email: 'hidden'` is the illegal
 * one, and `src/lib/form-fields.ts` refuses to build it.
 */
export const site: SiteConfig = {
  business: {
    name: 'Fixture Fabrication (test data)',
    legalName: 'Fixture Fabrication (test data)',
    tagline: 'Invented business. Used to test form validation, nothing else.',
    phone: '(555) 010-0199',
    phoneHref: '+15550100199',
    email: 'nobody@example.invalid',
    address: {
      locality: 'Testville',
      region: 'NJ',
      country: 'US',
    },
    serviceArea: ['Testville'],
  },

  theme: {
    colors: {
      primary: '#1f4e79',
      accent: '#b03a12',
    },
    fonts: {
      heading: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Arial, sans-serif',
      body: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Arial, sans-serif',
      faces: [],
    },
  },

  brand: {
    logo: '/images/logo.svg',
    favicon: '/favicon.svg',
    ogImage: '/images/og.svg',
  },

  hero: {
    headline: 'This is a test fixture.',
    subhead: 'It exists so the per-client form rules can be proved. Nothing here is a real business.',
    ctaPrimary: { text: 'Send a message', href: '/contact' },
    ctaSecondary: { text: 'See the services', href: '/services' },
    image: '/images/hero.svg',
    imageAlt: 'Placeholder illustration',
  },

  trustStrip: [
    { icon: 'wrench', label: 'Test fixture' },
    { icon: 'gear', label: 'Email required' },
    { icon: 'phone', label: 'Phone optional' },
    { icon: 'shield', label: 'Never deployed' },
  ],

  services: [
    {
      slug: 'fixture-service',
      title: 'Fixture Service',
      oneLiner: 'A service that does not exist, for a business that does not exist.',
      icon: 'gear',
      image: '/images/service-precision-machining.svg',
      imageAlt: 'Placeholder illustration',
    },
  ],

  about: {
    headline: 'A fixture, not a shop.',
    entry: 'about',
    image: '/images/story.svg',
    imageAlt: 'Placeholder illustration',
  },

  // Deliberately `placeholder`: the template renders a loud banner over any
  // testimonial that is not verified, which is exactly what a fixture should
  // carry. Nobody said these words, and the site says so on the page.
  testimonials: [
    {
      quote: 'Invented quotation, kept here so the testimonials section has something to render.',
      attribution: 'Not a real customer',
      role: 'Test fixture',
      rating: 5,
      sourceNote: 'Invented for a test fixture. No customer, real or otherwise, said this.',
      status: 'placeholder',
    },
  ],

  certifications: [],

  cta: {
    headline: 'Still a fixture.',
    body: 'The form below asks for an email address and treats a phone number as optional.',
    buttonText: 'Send a message',
    buttonHref: '/contact',
  },

  pages: {
    home: {
      servicesHeading: 'One invented service',
      servicesIntro: 'Enough content for the page to render. No more than that.',
    },
    services: {
      title: 'Services',
      intro: 'One invented service, for a fixture.',
      metaDescription: 'Test fixture. Not a real business.',
    },
    about: {
      eyebrow: 'Fixture Fabrication · Testville, NJ',
      metaDescription: 'Test fixture. Not a real business.',
    },
    contact: {
      title: 'Send a message',
      intro: 'This form requires an email address. A phone number is optional.',
      metaDescription: 'Test fixture. Not a real business.',
    },
  },

  seo: {
    titleTemplate: '%s | Fixture Fabrication (test data)',
    defaultDescription: 'Test fixture for per-client form field rules. Not a real business.',
    siteUrl: 'https://example.invalid',
    noindex: true,
  },

  features: {
    gallery: false,
    customizer: false,
    offline: false,
  },

  forms: {
    mode: 'worker',
    // Empty, like every other pre-deploy config. The fixture is exercised
    // against `wrangler dev` with DEMO_FORM_ENDPOINT set on the build command,
    // which is what points it at the shared Worker.
    workerEndpoint: '',
    maxUploadMB: 10,
    acceptedFileTypes: ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'],
    turnstileSiteKey: '',

    /*
     * The whole point of the fixture.
     *
     * `email: 'required'` and `phone: 'optional'` is a legal asymmetric shape:
     * a submission cannot arrive without a way to reply, because the email
     * address is compulsory. The either/or rule does not apply here — that is
     * only for the both-optional pair — so a lead with a phone number and no
     * email is refused, by the form and by the Worker.
     *
     * Kept in step with `PROSPECT_FIELDS` in worker-demo/wrangler.jsonc by
     * scripts/check-form-fields.mjs.
     */
    fields: {
      phone: 'optional',
      email: 'required',
      // Hidden as well as asymmetric, so the fixture proves the other half of
      // the rules: a field the form does not render is not validated, and a
      // value posted into it anyway — by a phone holding a cached copy of an
      // older build — is carried through to the notification rather than
      // dropped. See `extras` in worker-demo/src/lib/validate.ts.
      service: 'hidden',
    },

    // Also exercises the derived compact field set: with email required and
    // the pair rule off, the quick block asks for an email address and drops
    // the phone field entirely. See quickFields() in src/lib/form-fields.ts.
    quickQuote: {
      enabled: true,
      heading: 'Quick fixture form',
      blurb: 'Derived fields: name, email, one line. No phone, no service, no upload.',
      buttonText: 'Send it',
      placements: ['home'],
    },
  },
};

export default site;
