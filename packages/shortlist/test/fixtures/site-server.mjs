import { createServer } from 'node:http';

/**
 * Fixture websites, served from loopback.
 *
 * ## Why these are served rather than stubbed
 *
 * The unit tests cover `classifyWebsite`, the scorer and the ranker as pure
 * functions over hand-written signal objects. What they cannot cover is the
 * part between: a real browser navigating, a real DOM being read, real signals
 * coming back, and the audit running against a real response. That seam is
 * where the dry run was blind — every fixture URL was `*.example.com`, which
 * does not resolve, so all 2,422 rows classified `dead` and zero audits ran.
 *
 * These pages close that. They are hand-written HTML, not copies of anyone's
 * site: CLAUDE.md forbids committing third-party business data, and a fixture
 * that needed a saved copy of a real shop's page could not live in git.
 * Business names are obviously invented and no page carries a real address,
 * phone number or review.
 *
 * ## Why one IP per site
 *
 * `NavigationBudget` keys on hostname, and CLAUDE.md caps navigations at ten
 * per site. Four sites behind one hostname would share one budget and one
 * 1s/host throttle — an artefact of the test, not of the system. Loopback
 * 127.0.0.0/8 gives each fixture its own hostname, so the budget behaves as it
 * will in production.
 *
 * Note that everything here is served over **http**, because loopback has no
 * certificate. Every fixture therefore trips the `insecure` signal and fails
 * the audit's `https` check. That is stated rather than worked around, and the
 * assertions compare sites against each other instead of against absolutes.
 */

const page = (head, body) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;

/** Enough prose to clear both the classifier's 40 and the ranker's 150. */
const RICH_PROSE = `
  <p>Fixture Precision Works has run a fixture machine shop out of a fixture
  industrial unit since the fixture year. We take on single pieces and short
  runs, and we do not hold a minimum order quantity, which matters when you
  need one bracket rather than five hundred.</p>
  <p>The shop floor carries three-axis milling, turning between centres, and
  surface grinding. Work comes in from fabricators, maintenance teams and the
  occasional restorer who needs a part that has not been made since before the
  drawings were lost. If you bring us a broken component we will measure it and
  quote from the measurement, not from a guess.</p>
  <p>Tolerances are agreed in writing before anything is cut. Quotes are fixed
  for thirty days. Payment is on completion for established accounts, and
  staged for first orders, which is the arrangement most of our customers
  eventually settle into anyway.</p>
  <p>We are open on weekdays and answer the phone during those hours. If we do
  not pick up we are on the floor and will call back the same day. There is
  parking outside the unit and you are welcome to walk in with a part.</p>
`;

/** A live, well-maintained site. Everything the ranker looks for is present. */
const LIVE_HEALTHY = page(
  `<title>Fixture Precision Works — Machine Shop</title>
   <meta name="viewport" content="width=device-width, initial-scale=1">
   <meta name="description" content="Fixture Precision Works is a fixture machine shop taking single pieces and short runs, with tolerances agreed in writing before anything is cut.">
   <script type="application/ld+json">
   {"@context":"https://schema.org","@type":"LocalBusiness","name":"Fixture Precision Works"}
   </script>`,
  `<nav><a href="/">Home</a> <a href="/services">Services</a></nav>
   <h1>Fixture Precision Works</h1>
   <h2>Milling, turning and grinding</h2>
   ${RICH_PROSE}
   <p>Call <a href="tel:+15555550100">555-555-0100</a> or
      <a href="mailto:hello@fixture.invalid">email us</a>.</p>
   <footer>Copyright ${new Date().getFullYear()} Fixture Precision Works</footer>`,
);

/**
 * A live site nobody has touched in a decade. Deliberately above the
 * classifier's 40-word floor — it is a real site, just a bad one — and below
 * the ranker's 150-word threshold, with no viewport, no description, no
 * structured data and no way to contact anyone.
 */
const LIVE_NEGLECTED = page(
  `<title>Welcome</title>`,
  `<h1>Fixture Heritage Welding</h1>
   <p>Fixture Heritage Welding. We do welding and fabrication work of all kinds
   for customers across the fixture area. Established many years ago. Please
   visit us during opening hours to discuss your requirements with a member of
   staff who will be happy to assist you with whatever you need doing.</p>
   <p>Site best viewed at 800x600.</p>`,
);

/**
 * A parked domain. Shaped to trip the classifier's `for-sale-text` rule, which
 * is the strongest and least ambiguous of the parking rules — the phrase is one
 * somebody had to write on purpose.
 */
const PARKED = page(
  `<title>fixture-parked-domain.invalid</title>`,
  `<h1>fixture-parked-domain.invalid is for sale</h1>
   <p>This domain is for sale. Buy this domain today and make it yours.</p>
   <p>Check out these related searches.</p>
   <a href="#">Make an offer on this domain</a>`,
);

/** One site per loopback address, so each gets its own navigation budget. */
export const SITES = [
  { key: 'live-healthy', ip: '127.0.0.1', body: LIVE_HEALTHY, status: 200 },
  { key: 'live-neglected', ip: '127.0.0.2', body: LIVE_NEGLECTED, status: 200 },
  { key: 'parked', ip: '127.0.0.3', body: PARKED, status: 200 },
  { key: 'dead-404', ip: '127.0.0.4', body: '<h1>Not Found</h1>', status: 404 },
];

/**
 * Nothing ever listens here, so a navigation fails outright rather than
 * returning a status. That is the `unreachable` path, which is a different
 * classifier rule from a 404 and worth covering separately.
 */
export const REFUSED_URL = 'http://127.0.0.9:9/';

/**
 * Start every fixture site. Returns the URL map and a close function.
 *
 * Port 0 lets the OS assign, so a developer already running something on a
 * fixed port does not get a mysterious failure — and two copies of the test
 * suite can run at once.
 */
export async function startSites() {
  const servers = [];
  const urls = {};

  await Promise.all(
    SITES.map(
      (site) =>
        new Promise((resolve, reject) => {
          const server = createServer((req, res) => {
            // Serve the same document whatever the path. The audit follows
            // same-host links, and a 404 on a followed link would be a
            // finding about the fixture rather than about the site.
            res.writeHead(site.status, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(site.body);
          });
          server.on('error', reject);
          server.listen(0, site.ip, () => {
            urls[site.key] = `http://${site.ip}:${server.address().port}/`;
            servers.push(server);
            resolve();
          });
        }),
    ),
  );

  urls['refused'] = REFUSED_URL;

  return {
    urls,
    close: () => Promise.all(servers.map((s) => new Promise((r) => s.close(r)))),
  };
}
