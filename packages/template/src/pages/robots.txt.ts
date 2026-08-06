import type { APIRoute } from 'astro';
import { site } from '../../site.config';

/**
 * robots.txt is generated from `seo.noindex`, so the mockup lock is a single
 * flag rather than two files that can drift apart.
 *
 * While noindex is true: disallow everything, and advertise no sitemap.
 * README step 8 is where that flag gets flipped, with client sign-off.
 */
export const GET: APIRoute = () => {
  const body = site.seo.noindex
    ? ['# Private pitch mockup — not for indexing.', 'User-agent: *', 'Disallow: /', ''].join('\n')
    : [
        'User-agent: *',
        'Allow: /',
        '',
        `Sitemap: ${new URL('sitemap-index.xml', site.seo.siteUrl).href}`,
        '',
      ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
