/**
 * No forms, no client JavaScript, no third-party requests.
 *
 * Each of the three is a promise this package made and each has a distinct
 * reason to be gated rather than trusted:
 *
 *   Forms      A form needs an endpoint. An endpoint means a Worker, a KV
 *              namespace, spam handling and a place for a property manager's
 *              contact details to sit. The spec says mailto only; this keeps it
 *              that way, because "add a quick contact form" is the single most
 *              likely future edit to this site.
 *   Scripts    The _headers file deliberately ships no script-src CSP. That is
 *              only defensible while there is no script to protect. The moment
 *              one appears, that file is wrong — so this fails first and says so.
 *   3rd party  A font CDN or an analytics tag would put a third party in the
 *              render path of the page that is supposed to prove competence, and
 *              would leak a visitor's IP to it.
 */
import { htmlPages, problem, report, requireDist } from './lib.mjs';

requireDist();

/** Hosts an asset or embed may be fetched from at render time. Empty: none. */
const ALLOWED_ASSET_HOSTS = [];

const pages = htmlPages();

for (const page of pages) {
  if (/<form\b/i.test(page.html)) {
    problem(`${page.route}: contains a <form> — this site is mailto-only.`);
  }
  for (const tag of ['input', 'textarea', 'select', 'button']) {
    const re = new RegExp(`<${tag}\\b`, 'i');
    if (re.test(page.html)) {
      problem(`${page.route}: contains <${tag}> — no interactive controls on a static brochure.`);
    }
  }

  if (/<script\b/i.test(page.html)) {
    problem(
      `${page.route}: contains a <script>. If this is intended, _headers must gain a real ` +
        'script-src CSP with this script\'s hash before the gate is relaxed.',
    );
  }

  for (const m of page.html.matchAll(/\son[a-z]+=["']/gi)) {
    problem(`${page.route}: inline event handler ${m[0].trim()} — no client JS.`);
  }

  // Any absolute-URL asset reference: src=, and href= on <link>. Plain <a href>
  // to another site would be fine, so only asset-bearing attributes are checked.
  const assetRefs = [
    ...page.html.matchAll(/<(?:img|source|iframe|video|audio|embed)[^>]*\ssrc=["'](https?:\/\/[^"']+)["']/gi),
    ...page.html.matchAll(/<link[^>]*\shref=["'](https?:\/\/[^"']+)["']/gi),
  ];
  for (const m of assetRefs) {
    const url = m[1];
    const host = new URL(url).host;
    // The canonical and the OG image are absolute by necessity and are
    // self-hosted; they are <link rel=canonical> / <meta>, and the canonical is
    // the only <link> with an absolute href.
    if (/rel=["']canonical["']/i.test(m[0])) continue;
    if (!ALLOWED_ASSET_HOSTS.includes(host)) {
      problem(`${page.route}: fetches ${url} from third-party host ${host}.`);
    }
  }

  if (/@font-face/i.test(page.html) && /url\((?:["']?)https?:/i.test(page.html)) {
    problem(`${page.route}: @font-face loads a remote font — system stacks only.`);
  }
}

console.log(`      ${pages.length} page(s): no forms, no scripts, no third-party requests`);
report('check-no-forms');
