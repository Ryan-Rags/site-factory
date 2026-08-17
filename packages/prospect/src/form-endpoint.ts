import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "./paths.js";

/**
 * The shared demo form endpoint, for a generated prospect demo.
 *
 * ## Why the emitter needs this at all
 *
 * `site.config.ts`'s `resolveForms()` already promotes any build to
 * `mode: 'worker'` when `DEMO_FORM_ENDPOINT` is in the environment, so a demo
 * built with the variable set would have got a working form without this file.
 * It never was. Every one of the 50 demos in the 2026-08-16 batch shipped with
 * `forms.mode: 'disabled'` — because `project.ts` sets that mode whenever the
 * prospect has no confirmed email address, and email coverage on that batch was
 * 0 of 50 — and the run never set the variable, so nothing overrode it. Result:
 * `contact/index.html` with zero `<form>` elements, on 33 live demos being
 * pitched as a website that captures enquiries. PR #54's Brief item 2.
 *
 * Relying on the build-time override alone would leave the generated config
 * *saying* `disabled` while the built page said otherwise, which is the same
 * class of disagreement `check-form-fields.mjs` exists to prevent. So the
 * emitter states it: the config written to `prospects/<slug>/site.config.json`
 * is what the demo actually does.
 *
 * ## Why it is read here rather than hard-coded
 *
 * The endpoint is one account's Worker subdomain. It belongs in the gitignored
 * `.env.deploy` beside the deploy script that already reads it, never in a
 * committed source file.
 *
 * A real client build cannot inherit it: this is only consulted by the demo
 * pipeline, and a prospect with a confirmed email and no endpoint configured
 * still falls back to `mailto`. That is the standing rule from PR #13 and it is
 * unchanged.
 */

/** `.env.deploy`, the same file `scripts/deploy/deploy-mockups.mjs` reads. */
const ENV_DEPLOY = join(repoRoot, ".env.deploy");

/**
 * `KEY=VALUE`, `#` comments, optional surrounding quotes.
 *
 * A deliberate duplicate of `loadEnvDeploy` in `scripts/deploy/deploy-mockups.mjs`
 * — that file is a standalone `.mjs` script outside every workspace package and
 * cannot import from one. Both parsers are five lines over a file holding one
 * URL, and both leave a real environment variable winning so a one-off
 * `DEMO_FORM_ENDPOINT=… pnpm demo` still overrides the file.
 */
function fromEnvDeploy(): string {
  if (!existsSync(ENV_DEPLOY)) return "";
  for (const line of readFileSync(ENV_DEPLOY, "utf8").split(/\r?\n/)) {
    if (line.trimStart().startsWith("#")) continue;
    const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match || match[1] !== "DEMO_FORM_ENDPOINT") continue;
    return (match[2] ?? "").trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return "";
}

export interface FormEndpoint {
  /** The endpoint, or `''` when none is configured. */
  url: string;
  /** Where it came from, for the run log. Empty when `url` is. */
  source: string;
}

/**
 * Resolve the endpoint: the environment first, then `.env.deploy`.
 *
 * An unusable value is treated as absent rather than passed on. A non-https URL
 * in the config would reach the form island and fail in the browser in front of
 * a prospect; refusing it here means the demo falls back to a form the operator
 * can see is missing, which is the failure that gets noticed.
 */
export function resolveFormEndpoint(env: NodeJS.ProcessEnv = process.env): FormEndpoint {
  const fromEnv = (env["DEMO_FORM_ENDPOINT"] ?? "").trim();
  const url = fromEnv !== "" ? fromEnv : fromEnvDeploy();
  if (url === "") return { url: "", source: "" };
  if (!/^https:\/\/[^\s/]+/.test(url)) return { url: "", source: "" };
  return { url, source: fromEnv !== "" ? "DEMO_FORM_ENDPOINT" : ".env.deploy" };
}
