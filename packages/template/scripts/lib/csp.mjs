/**
 * The Content-Security-Policy, derived from built HTML.
 *
 * Shared by `gen-headers.mjs`, which writes the policy, and `check-headers.mjs`,
 * which re-derives it and fails the build if the file on disk disagrees. They
 * import the same code deliberately: two implementations of "what should this
 * policy be" would eventually disagree, and the gate would then be checking one
 * opinion against another instead of checking the file against the pages.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Features denied outright.
 *
 * Only names browsers actually recognise. Listing a feature a browser does not
 * know produces a console warning, and a console full of warnings is a console
 * nobody reads — which costs more than the imaginary hardening gains.
 *
 * These sites ask for none of it: no camera, no location, no payment. Saying so
 * explicitly means a future component cannot quietly start.
 */
export const DENIED_FEATURES = [
  'accelerometer',
  'autoplay',
  'camera',
  'display-capture',
  'encrypted-media',
  'fullscreen',
  'geolocation',
  'gyroscope',
  'magnetometer',
  'microphone',
  'midi',
  'payment',
  'picture-in-picture',
  'screen-wake-lock',
  'usb',
  'xr-spatial-tracking',
];

/** Script types that actually execute. `application/ld+json` does not. */
export const EXECUTABLE = /^(?:$|text\/javascript$|application\/javascript$|module$)/i;

export function walkHtml(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkHtml(full));
    else if (name.endsWith('.html')) out.push(full);
  }
  return out.sort();
}

export const originOf = (url) => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

/**
 * Everything the policy needs, read off one page.
 *
 * Returned as sets so the caller can union across every page of the site: the
 * `_headers` file applies to `/*`, so the policy has to be the union of what
 * each page needs, not what the home page happens to need.
 */
export function measurePage(html, siteOrigin) {
  const found = {
    hashes: new Set(),
    scriptHosts: new Set(),
    frameHosts: new Set(),
    connectHosts: new Set(),
    fontHosts: new Set(),
    imgHosts: new Set(),
    dataImg: false,
    unhashable: [],
  };

  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    const body = m[2];
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
    const type = (/\btype\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ?? '').trim();

    if (src) {
      const origin = originOf(src);
      // A root-relative src is 'self' and needs no entry.
      if (origin && origin !== siteOrigin) found.scriptHosts.add(origin);
      continue;
    }

    // `application/ld+json` and friends are data, not code: browsers do not
    // execute them and script-src does not govern them. Hashing them would add
    // churn to the policy every time a client's config changed, for nothing.
    if (!EXECUTABLE.test(type)) continue;
    if (body.trim() === '') continue;

    // CSP hashes the element's exact text content, byte for byte.
    found.hashes.add(`sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}`);

    // Inline scripts are also where the two fetch targets live: the customizer
    // posts to its configured endpoint from here.
    for (const u of body.matchAll(/https?:\/\/[^\s"'`<>\\]+/g)) {
      const origin = originOf(u[0]);
      if (origin && origin !== siteOrigin) found.connectHosts.add(origin);
    }
  }

  for (const m of html.matchAll(/<iframe([^>]*)>/gi)) {
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(m[1])?.[1];
    const origin = src ? originOf(src) : null;
    if (origin && origin !== siteOrigin) found.frameHosts.add(origin);
  }

  /*
   * The island's props are the *other* fetch target: the contact form receives
   * its Worker endpoint as a prop, so on a demo build with DEMO_FORM_ENDPOINT
   * set the URL appears here and nowhere else in the HTML.
   *
   * Read from props specifically rather than from every `https://` on the page.
   * A page-wide sweep would pick up ordinary outbound links — a Google Business
   * Profile link, a map URL — and widen connect-src to origins the page never
   * connects to, which is the opposite of what this file is for.
   */
  for (const m of html.matchAll(/<astro-island[^>]*\bprops\s*=\s*["']([^"']*)["']/gi)) {
    const decoded = m[1].replace(/&quot;/g, '"').replace(/&#38;/g, '&').replace(/&amp;/g, '&');
    for (const u of decoded.matchAll(/https?:\/\/[^\s"'`<>\\]+/g)) {
      const origin = originOf(u[0]);
      if (origin && origin !== siteOrigin) found.connectHosts.add(origin);
    }
  }

  for (const m of html.matchAll(/<link([^>]*)>/gi)) {
    const attrs = m[1];
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
    if (!href) continue;
    const as = /\bas\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1];
    const origin = originOf(href);
    if (!origin || origin === siteOrigin) continue;
    if (as === 'font') found.fontHosts.add(origin);
    else if (as === 'image') found.imgHosts.add(origin);
  }

  for (const m of html.matchAll(/<img([^>]*)>/gi)) {
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(m[1])?.[1];
    if (!src) continue;
    if (src.startsWith('data:')) found.dataImg = true;
    else {
      const origin = originOf(src);
      if (origin && origin !== siteOrigin) found.imgHosts.add(origin);
    }
  }

  // Fonts and images referenced from the inlined stylesheets.
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const u of m[1].matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      const ref = u[1].trim();
      if (ref.startsWith('data:')) {
        if (/^data:font|^data:application\/font/i.test(ref)) continue;
        found.dataImg = true;
        continue;
      }
      const origin = originOf(ref);
      if (!origin || origin === siteOrigin) continue;
      if (/\.(woff2?|ttf|otf|eot)(\?|$)/i.test(ref)) found.fontHosts.add(origin);
      else found.imgHosts.add(origin);
    }
  }

  return found;
}

export function buildPolicy(m) {
  const list = (...parts) => parts.filter(Boolean).join(' ');

  const scriptSrc = list("'self'", [...m.hashes].sort().map((h) => `'${h}'`).join(' '), [...m.scriptHosts].sort().join(' '));

  /**
   * Frames come from two places, and only one of them is in the HTML.
   *
   * Measuring `<iframe>` elements alone produced `frame-src 'none'` on a build
   * carrying Turnstile — correct about the markup and wrong about the page,
   * because Turnstile injects its widget iframe at runtime from its own script.
   * The policy would have loaded the script and then blocked the widget it
   * exists to draw, and the first person to notice would have been a client
   * whose contact form stopped taking submissions.
   *
   * So a host trusted to execute script is also trusted to frame. That is not a
   * widening of trust — a third-party script already runs with the page's full
   * authority, and every widget of this kind works by framing back to its own
   * origin. Both halves are still measured; nothing is allowed that the build
   * did not actually reference.
   */
  const frameHosts = new Set([...m.frameHosts, ...m.scriptHosts]);
  const frameSrc = frameHosts.size === 0 ? "'none'" : [...frameHosts].sort().join(' ');
  const connectSrc = list("'self'", [...m.connectHosts].sort().join(' '));
  const imgSrc = list("'self'", m.dataImg ? 'data:' : '', [...m.imgHosts].sort().join(' '));
  const fontSrc = list("'self'", [...m.fontHosts].sort().join(' '));

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // See the header note: forced by inline style attributes, and harmless
    // because there is no injection sink. Never let script-src follow it.
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    `font-src ${fontSrc}`,
    `connect-src ${connectSrc}`,
    `frame-src ${frameSrc}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",
  ].join('; ');
}


/** A zero measurement, for callers unioning across many pages. */
export function emptyMeasurement() {
  return {
    hashes: new Set(),
    scriptHosts: new Set(),
    frameHosts: new Set(),
    connectHosts: new Set(),
    fontHosts: new Set(),
    imgHosts: new Set(),
    dataImg: false,
    unhashable: [],
  };
}

/** Union `found` into `into`, in place. */
export function mergeMeasurement(into, found) {
  for (const key of ['hashes', 'scriptHosts', 'frameHosts', 'connectHosts', 'fontHosts', 'imgHosts']) {
    for (const v of found[key]) into[key].add(v);
  }
  into.dataImg = into.dataImg || found.dataImg;
  return into;
}

/**
 * Measure a whole built client: every page unioned, because `_headers` applies
 * to `/*` and the policy must satisfy the union rather than any one page.
 */
export function measureClient(distDir) {
  const files = walkHtml(distDir);
  const siteOrigin =
    originOf(
      /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(
        readFileSync(join(distDir, 'index.html'), 'utf8'),
      )?.[1] ?? '',
    ) ?? null;

  const merged = emptyMeasurement();
  for (const file of files) {
    mergeMeasurement(merged, measurePage(readFileSync(file, 'utf8'), siteOrigin));
  }
  return { merged, siteOrigin, files };
}
