import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Long-form prose lives here rather than in site.config.ts. Both collections
 * are schema-validated, so a missing heading or a service file whose id does
 * not match a `services[].slug` fails the build instead of rendering blank.
 */

const about = defineCollection({
  loader: glob({ base: './src/content/about', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
  }),
});

const services = defineCollection({
  loader: glob({ base: './src/content/services', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    /** Bullet list shown beside the prose on the service detail block. */
    highlights: z.array(z.string()).min(1),
  }),
});

export const collections = { about, services };
