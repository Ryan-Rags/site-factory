/**
 * @site-factory/outreach — turns audit findings into per-lead outreach material.
 *
 * Reads the audit cache rather than the rendered report, so every claim in a
 * pitch traces back to a specific check result. Leads without enough confirmed
 * findings are skipped rather than padded with invented detail.
 */

export const PACKAGE_NAME = "@site-factory/outreach";

export { MIN_FINDINGS, pitchBlocker, renderPitch, renderSkipped, servicesFrom } from "./pitch.js";
export type { PitchResult, SkipReason } from "./pitch.js";
