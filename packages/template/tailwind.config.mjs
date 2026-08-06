/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,ts,tsx,md}'],
  theme: {
    extend: {
      colors: {
        // All brand colour flows from the two values in site.config.ts.
        // BaseLayout emits them as custom properties; the tints and shades
        // below are derived from those two in CSS, never hard-coded here.
        primary: 'var(--color-primary)',
        'primary-dark': 'var(--color-primary-dark)',
        'primary-tint': 'var(--color-primary-tint)',
        'primary-wash': 'var(--color-primary-wash)',
        accent: 'var(--color-accent)',
        'accent-dark': 'var(--color-accent-dark)',
        'accent-wash': 'var(--color-accent-wash)',
      },
      fontFamily: {
        heading: 'var(--font-heading)',
        body: 'var(--font-body)',
      },
      maxWidth: {
        prose: '68ch',
      },
    },
  },
  plugins: [],
};
