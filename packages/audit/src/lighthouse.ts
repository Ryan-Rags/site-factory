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
      return { scores: undefined, error: "Lighthouse returned no categories." };
    }

    const scores = {} as LighthouseScores;
    for (const key of LH_CATEGORIES) {
      const raw = lhr.categories[key]?.score;
      scores[key] =
        typeof raw === "number" ? Math.round(raw * 100) : undefined;
    }
    return { scores, error: "" };
  } catch (err: unknown) {
    return {
      scores: undefined,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
