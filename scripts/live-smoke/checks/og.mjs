/**
 * §3.4 — the social card actually resolves, and is a real raster of the
 * declared size.
 *
 * This is the class of defect that is invisible from every angle except the one
 * that matters: the link is sent, the page is perfect, and the card arrives in
 * the chat blank. Ledger 2026-08-12 records that Facebook, X, LinkedIn,
 * iMessage, WhatsApp and Slack all decline to render an SVG `og:image`, so a
 * `Content-Type` header is not evidence — the bytes are.
 *
 * Hence the IHDR parse. A PNG is 8 signature bytes, then a length, then the
 * chunk type `IHDR`, then width and height as big-endian u32. Reading them
 * directly proves the file is a PNG rather than trusting the server's opinion
 * of it, needs no image library and no new dependency, and costs 33 bytes.
 *
 * **Two different ways this fails, and they are not the same finding.** The
 * asset can be wrong — missing, an SVG, too small. Or the asset can be perfect
 * and the *tag* can name a host that does not serve it: the template builds
 * `og:image` as an absolute URL against `seo.siteUrl`, which on a demo is the
 * client's own domain and not the Pages origin the link actually points at. The
 * card is then blank for a reason no local check can see — the file is there,
 * it is correct, and it is being advertised at an address nobody can fetch it
 * from. So when the declared URL fails, the same path is probed at the origin
 * serving the demo, and the report says which of the two problems it is.
 */
import { FINDING, assertion, finding, request, summarise, unavailable } from '../fleet.mjs';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** The card size every platform documents as the minimum for a large card. */
export const MIN_WIDTH = 1200;
export const MIN_HEIGHT = 630;

const metaContent = (html, re) => {
  const tag = re.exec(html)?.[0];
  return tag ? (/content=["']([^"']*)["']/i.exec(tag)?.[1] ?? null) : null;
};

/**
 * Width and height off the IHDR chunk, or a reason it is not a PNG.
 * Deliberately strict: a JPEG, an SVG or an HTML error page all land in the
 * `not a PNG` branch with their first bytes reported.
 */
export function readPngHeader(bytes) {
  if (!bytes || bytes.length < 24) {
    return { ok: false, reason: `only ${bytes ? bytes.length : 0} byte(s) read` };
  }
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    const head = bytes.subarray(0, 8).toString('hex');
    const ascii = bytes.subarray(0, 8).toString('latin1').replace(/[^\x20-\x7e]/g, '.');
    return { ok: false, reason: `not a PNG — first 8 bytes are ${head} ("${ascii}")` };
  }
  if (bytes.subarray(12, 16).toString('latin1') !== 'IHDR') {
    return { ok: false, reason: 'PNG signature present but the first chunk is not IHDR' };
  }
  return { ok: true, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/**
 * One card URL, measured: reachable, right type, real PNG bytes, big enough.
 * Returns the measurement rather than assertions, so the same routine can be
 * pointed at the declared URL and at the deploy origin's copy of it.
 */
async function measureCard(url, politeness) {
  /*
   * `Range: bytes=0-32` covers the signature and the whole IHDR. A server that
   * ignores the header returns 200 and the whole body, which is correct and
   * costs one image — so both answers are handled rather than one being an
   * error.
   */
  const res = await request(url, { politeness, headers: { Range: 'bytes=0-32' }, read: 'bytes' });
  const reachable = res.status === 200 || res.status === 206;
  const type = res.contentType.split(';')[0].trim().toLowerCase();
  const header = reachable ? readPngHeader(res.bytes) : { ok: false, reason: 'not fetched' };
  return {
    url,
    status: res.status,
    error: res.error,
    reachable,
    type,
    header,
    big: header.ok && header.width >= MIN_WIDTH && header.height >= MIN_HEIGHT,
    ok: reachable && type === 'image/png' && header.ok && header.width >= MIN_WIDTH && header.height >= MIN_HEIGHT,
    describe: reachable
      ? `HTTP ${res.status} ${type || '(no type)'}${header.ok ? `, ${header.width}×${header.height}` : `, ${header.reason}`}`
      : res.error || `HTTP ${res.status}`,
  };
}

export async function run(ctx) {
  const { slug, origin, politeness, pages } = ctx;
  const assertions = [];
  const findings = [];

  const home = pages.get('/');
  const declared = metaContent(home.body, /<meta[^>]+property=["']og:image["'][^>]*>/i);
  const twitter = metaContent(home.body, /<meta[^>]+name=["']twitter:image["'][^>]*>/i);

  if (!declared) {
    return unavailable('og', 'og:image', 'the live / declares no og:image', [
      finding(FINDING.OG, `${slug}: the live home page declares no og:image at all`),
    ]);
  }

  let url;
  try {
    url = new URL(declared, `${origin}/`);
  } catch {
    assertions.push(assertion('og:image resolves to a URL', false, declared, 'an absolute or root-relative URL'));
    findings.push(finding(FINDING.OG, `${slug}: og:image "${declared}" is not a URL`));
    return summarise('og', 'og:image', assertions, findings, { declared });
  }

  // Prefixed `context ·` because it is a measurement the report should carry,
  // not a claim that passed. A ✓ against a row nothing was asserted about is
  // the sort of thing a reader counts as evidence.
  assertions.push(assertion('context · og:image declared', true, url.href));
  if (twitter) {
    const twitterUrl = new URL(twitter, `${origin}/`).href;
    assertions.push(
      assertion('twitter:image matches og:image', twitterUrl === url.href, twitterUrl, url.href),
    );
  }

  /*
   * The origin assertion, made before the fetch because it is a different
   * question. A crawler resolves the card against the URL it was given — the
   * demo's Pages origin — and a card advertised on another host is unfetchable
   * however good the file behind it is.
   */
  const sameOrigin = url.origin === origin;
  assertions.push(
    assertion(
      'og:image is advertised on the origin serving this demo',
      sameOrigin,
      url.origin,
      origin,
      sameOrigin ? '' : 'the template builds og:image absolute against seo.siteUrl',
    ),
  );

  const card = await measureCard(url.href, politeness);
  assertions.push(
    assertion('og:image is reachable', card.reachable, card.describe, '200 or 206'),
  );

  if (card.reachable) {
    assertions.push(
      assertion('og:image content-type', card.type === 'image/png', card.type || '(none)', 'image/png'),
      assertion(
        'og:image bytes are a PNG',
        card.header.ok,
        card.header.ok ? 'PNG signature + IHDR' : card.header.reason,
        'PNG signature + IHDR',
        'read from the bytes, not from the Content-Type header',
      ),
    );
    if (card.header.ok) {
      assertions.push(
        assertion(
          'og:image dimensions',
          card.big,
          `${card.header.width}×${card.header.height}`,
          `≥ ${MIN_WIDTH}×${MIN_HEIGHT}`,
        ),
      );
    }
  }

  /*
   * If the declared URL did not deliver a usable card, ask the one question
   * that separates "the asset is wrong" from "the tag names the wrong host":
   * is the same path a valid card at the origin serving this demo?
   */
  let atDeployOrigin = null;
  if (!card.ok && !sameOrigin) {
    atDeployOrigin = await measureCard(`${origin}${url.pathname}`, politeness);
    assertions.push(
      assertion(
        'context · the same path at the deploy origin',
        true,
        `${atDeployOrigin.url} → ${atDeployOrigin.describe}`,
        null,
        atDeployOrigin.ok
          ? 'the card exists and is correct here; only the tag points elsewhere'
          : 'not a usable card here either',
      ),
    );
  }

  if (!card.ok) {
    if (atDeployOrigin?.ok) {
      findings.push(
        finding(
          FINDING.OG_ORIGIN,
          `${slug}: the card is valid at ${atDeployOrigin.url} (${atDeployOrigin.header.width}×` +
            `${atDeployOrigin.header.height} image/png) but og:image advertises it at ` +
            `${url.href}, which answers ${card.describe}. The tag is built absolute against ` +
            `seo.siteUrl — a domain this demo is not served from — so every shared link ` +
            `unfurls blank while every local check passes.`,
        ),
      );
    } else {
      findings.push(
        finding(
          FINDING.OG,
          `${slug}: og:image ${url.href} → ${card.describe}. Every link shared for this ` +
            `demo unfurls with no picture.`,
        ),
      );
    }
  }

  return summarise('og', 'og:image', assertions, findings, {
    declared: url.href,
    declaredOrigin: url.origin,
    deployOrigin: origin,
    status: card.status,
    contentType: card.type,
    width: card.header.ok ? card.header.width : null,
    height: card.header.ok ? card.header.height : null,
    atDeployOrigin: atDeployOrigin
      ? { url: atDeployOrigin.url, ok: atDeployOrigin.ok, describe: atDeployOrigin.describe }
      : null,
  });
}
