import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { Browser } from "playwright";
import QRCode from "qrcode";

import { shootHtml } from "./browser.js";
import { QR_CARD_SIZE } from "./cards.js";

/**
 * The review-QR counter card.
 *
 * A printable 3.5×5in card that sits by the till and asks a customer to leave a
 * Google review while they are standing there, rather than three days later
 * when they have forgotten. Reviews are the single biggest lever on local
 * ranking that a shop actually controls, and the reason most shops have few is
 * not reluctance — it is that nobody asks at the one moment the customer is
 * both present and pleased.
 *
 * It reuses `renderQrCard`'s hard-won decisions rather than reinventing them:
 * 3.5×5in at 300dpi so it prints without resampling, and a QR that is pure
 * black on white at the highest error-correction level regardless of the brand
 * palette. A brand-coloured code looks better in a mockup and scans worse
 * across a counter in bad light, which is the only place this card is ever
 * used.
 *
 * The URL is never derived. `business.reviewUrl` is written explicitly in the
 * client config or this does not render — see the field's note in
 * `packages/template/src/types/site.ts`. A guessed Place ID would not fail
 * loudly; it would quietly point a shop's customers at a review form for
 * somebody else's business.
 */

const FONT_STACK =
  'ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface ReviewCardInput {
  businessName: string;
  /** `business.reviewUrl`. Required — the card refuses to render without it. */
  reviewUrl: string;
  colors: { primary: string; accent: string };
  /** Optional line under the heading, e.g. "It takes about thirty seconds." */
  lede?: string;
  /** Printed small at the foot. Defaults to a neutral thank-you. */
  footnote?: string;
}

export async function renderReviewCard(
  browser: Browser,
  input: ReviewCardInput,
  outFile: string,
): Promise<string> {
  if (!input.reviewUrl.trim()) {
    throw new Error(
      "renderReviewCard: reviewUrl is empty. Set business.reviewUrl in the client config; " +
        "this card is never rendered against a guessed review link.",
    );
  }

  mkdirSync(join(outFile, ".."), { recursive: true });

  const qr = await QRCode.toDataURL(input.reviewUrl, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 660,
    color: { dark: "#000000ff", light: "#ffffffff" },
  });

  const lede = input.lede ?? "Point your camera at the code. It takes about thirty seconds.";
  const footnote = input.footnote ?? "Thank you — it genuinely helps a small shop.";

  /*
   * Five stars are drawn as text, not as an image or an icon font: the card is
   * rendered by the same browser that draws the demo sites, and a glyph that is
   * present in every system font beats a dependency or a network request.
   */
  const html = `
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    width: ${QR_CARD_SIZE.width}px;
    height: ${QR_CARD_SIZE.height}px;
    font-family: ${FONT_STACK};
    background: #ffffff;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .band { height: 26px; background: ${input.colors.primary}; }
  /* Centred rather than top-aligned with the footnote pushed to the floor:
     the card is 5in tall and the content does not fill it, so an auto top
     margin on the footnote left a dead band under the code. Optical centring
     reads as deliberate on a counter; a bottom-anchored line reads as a bug. */
  .body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 56px 64px 48px; }
  .stars { font-size: 54px; letter-spacing: .12em; color: ${input.colors.accent}; line-height: 1; }
  .eyebrow { margin-top: 22px; font-size: 25px; letter-spacing: .22em; text-transform: uppercase; font-weight: 800; color: ${input.colors.accent}; }
  h1 { font-size: 60px; line-height: 1.06; margin: 20px 0 0; color: #0f172a; font-weight: 800; }
  .name { margin-top: 16px; font-size: 32px; font-weight: 700; color: ${input.colors.primary}; line-height: 1.2; }
  .rule { width: 120px; height: 6px; border-radius: 3px; background: ${input.colors.accent}; margin-top: 28px; }
  .lede { margin-top: 22px; font-size: 28px; line-height: 1.4; color: #475569; max-width: 26ch; }
  .qr { margin-top: 34px; padding: 20px; border: 3px solid ${input.colors.primary}22; border-radius: 24px; }
  .qr img { display: block; width: 520px; height: 520px; image-rendering: pixelated; }
  .foot { margin-top: 44px; font-size: 21px; color: #94a3b8; max-width: 30ch; line-height: 1.4; }
</style>
<div class="band"></div>
<div class="body">
  <div class="stars">★★★★★</div>
  <div class="eyebrow">Scan us on Google</div>
  <h1>Leave a review</h1>
  <div class="name">${escapeHtml(input.businessName)}</div>
  <div class="rule"></div>
  <p class="lede">${escapeHtml(lede)}</p>
  <div class="qr"><img src="${qr}" alt=""></div>
  <div class="foot">${escapeHtml(footnote)}</div>
</div>`;

  await shootHtml(browser, html, outFile, QR_CARD_SIZE);
  return outFile;
}
