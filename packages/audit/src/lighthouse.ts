import lighthouse from "lighthouse";

/**
 * Lighthouse's Moto G4 mobile emulation preset. Spelled out rather than deep
 * imported from `lighthouse/core/config/constants.js`, which is not a public
 * export and would break on a minor upgrade.
 */
const MOTO_G4_SCREEN = {
  mobile: true,
  width: 360,
  height: 640,
  deviceScaleFactor: 2.625,
  disabled: false,
} as const;

/**
 * The four categories Lighthouse 12 still ships. `pwa` was removed in v12, so
 * "Lighthouse x4" means these.
 */
export const LH_CATEGORIES = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
] as const;

export type LighthouseCategory = (typeof LH_CATEGORIES)[number];

/** Category scores as percentages, or undefined where Lighthouse gave none. */
export type LighthouseScores = Record<LighthouseCategory, number | undefined>;

export interface LighthouseOutcome {
  scores: LighthouseScores | undefined;
  /** Populated when the run failed; every LH check then reads `unavailable`. */
  error: string;
  /**
   * The raw Lighthouse result, when there was one.
   *
   * Category scores alone cannot say *why* a category has none, and the two
   * reasons are opposite verdicts. A `performance` of `undefined` because the
   * LCP audit reported `NO_LCP` is known-issues #2 — a documented, open defect
   * in device emulation that no branch caused. A `performance` of `undefined`
   * for any other reason is a failure nobody has looked at. Discriminating
   * needs `audits['largest-contentful-paint'].errorMessage`, which lives here
   * and nowhere else, so callers that must tell a known blindness from a new
   * one can read it. Nothing in this package reads it; it is passed through
   * untouched and typed as `unknown` so no shape is asserted about a foreign
   * object.
   */
  lhr?: unknown;
}

interface LhrLike {
  categories?: Record<string, { score?: number | null } | undefined>;
}

/**
 * Attach to the Chromium instance already listening on `port` and audit `url`.
 * Reusing the running browser is what keeps this to a single extra page
 * navigation instead of a second cold visit.
 */
export async function runLighthouse(
  url: string,
  port: number,
): Promise<LighthouseOutcome> {
  try {
    const runnerResult = await lighthouse(url, {
      port,
      output: "json",
      logLevel: "error",
      onlyCategories: [...LH_CATEGORIES],
      formFactor: "mobile",
      screenEmulation: { ...MOTO_G4_SCREEN },
      throttlingMethod: "simulate",
    });

    const lhr = runnerResult?.lhr as LhrLike | undefined;
    if (!lhr?.categories) {
      return { scores: undefined, error: "Lighthouse returned no categories.", lhr };
    }

    const scores = {} as LighthouseScores;
    for (const key of LH_CATEGORIES) {
      const raw = lhr.categories[key]?.score;
      scores[key] =
        typeof raw === "number" ? Math.round(raw * 100) : undefined;
    }
    return { scores, error: "", lhr };
  } catch (err: unknown) {
    return {
      scores: undefined,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
