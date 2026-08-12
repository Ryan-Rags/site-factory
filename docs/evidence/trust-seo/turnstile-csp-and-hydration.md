# Turnstile: CSP measurement proven, and a pre-existing hydration race found

Two separate things came out of exercising the Turnstile path, and they must not
be confused with each other.

---

## 1. The CSP handles Turnstile correctly — proven, then re-proven

No client config sets `forms.turnstileSiteKey`, so the Turnstile path had never
been built by anything. A CSP measured only on builds where Turnstile is absent
says nothing about whether it permits Turnstile, so the path was built
deliberately using Cloudflare's published "always passes" **test** site key
(`1x00000000000000000000AA` — not a secret, not account-bound).

**Finding, and a real defect in the first version of `gen-headers.mjs`:** with a
site key set, the generator measured the `<script src>` host correctly but
emitted `frame-src 'none'`, because Turnstile injects its widget iframe at
*runtime* and static measurement of `<iframe>` elements never sees it. That
policy would have loaded the script and then blocked the widget it exists to
draw.

Fixed: a host trusted to execute script is also trusted to frame. Not a widening
of trust — a third-party script already runs with the page's full authority, and
every widget of this kind frames back to its own origin.

Measured output with the key set:

```
script-src  'self' <3 hashes> https://challenges.cloudflare.com
connect-src 'self' https://demo-form.example-sub.workers.dev
frame-src   https://challenges.cloudflare.com
```

and with no key set, on the same fixture, `frame-src 'none'` and no external
script host. Both halves measured, neither assumed.

**Runtime, under the generated policy**, `challenges.cloudflare.com/turnstile/v0/api.js`
loads, `window.turnstile` is present, its sub-resources and its `blob:` resource
load, and **zero `securitypolicyviolation` events fire**.

Reproduce:

```
SITE_CLIENT=<slug> npx astro build      # with forms.turnstileSiteKey set
node scripts/gen-headers.mjs <slug>
grep -o "script-src[^;]*\|frame-src[^;]*" dist/<slug>/_headers
```

---

## 2. A pre-existing, intermittent Turnstile × React hydration race

**Not a CSP problem, and not caused by anything in this stream.** Recorded here
because it was found here, and because it means Turnstile is not currently safe
to enable for a client.

`contact.astro` loads `api.js` at page level with `defer`. The `.cf-turnstile`
container it renders into lives inside `ContactForm.tsx`, which Astro mounts as
a **`client:visible`** island. So Turnstile mutates a DOM node that React is
about to hydrate, and the two race.

When React loses the race it throws hydration errors — `#418` ×4 and `#423`
("switched to client rendering") — and the client re-render **wipes the widget**.
The observable end state is a `.cf-turnstile` div with no iframe and, critically,
**no `input[name="cf-turnstile-response"]`** — so the form would submit with no
Turnstile token at all, and a Worker that verifies the token would reject every
submission from that visitor.

### Why it is definitely not the CSP

Same build, five trials each, headers the only variable:

```
WITH generated CSP:  ok(e0) ok(e0) ok(e0) ok(e0) ok(e0)
WITHOUT any headers: ok(e0) BAD(e5) ok(e0) ok(e0) ok(e0)
```

The failure occurs **without** the CSP and did not recur with it. An earlier
single-sample comparison pointed the other way and was simply the race landing
differently; five trials each settled it. It also reproduces on unmodified
`main` (`e9654c5`) with a site key added to `zz-fixture-phone-optional` — no
code from this branch involved.

Note that it produces **no `securitypolicyviolation` event**, which is why
`check-csp-runtime.mjs` also listens for `pageerror`: a violation listener alone
would have reported this page clean.

### What was done about it

The test site key was **removed** from `zz-fixture-go-live`. Keeping it would
have imported an intermittent third-party race into a gate that runs on every
`build:all`, and a gate that goes red one run in ten teaches people to re-run it
rather than read it. The Turnstile CSP path is therefore proven by the recorded
measurement above and the command that reproduces it, rather than by a standing
gate — a deliberate trade, stated rather than hidden.

### For whoever owns the form

The fix is not in this stream's paths (`ContactForm.tsx`, `contact.astro`).
Sketch, for whoever picks it up: render the widget explicitly after hydration
(`turnstile.render()` from a `useEffect`, with `api.js` loaded
`?render=explicit`) instead of letting `api.js` auto-scan for a container React
owns. That removes the race rather than narrowing it.
