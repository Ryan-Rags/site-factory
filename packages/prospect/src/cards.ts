import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

import type { Browser } from "playwright";
import QRCode from "qrcode";

import { shootHtml } from "./browser.js";
import type { ShotSet } from "./shots.js";

/**
 * The two printable leave-behinds.
 *
 * Both are HTML rendered in the browser we already run, then screenshotted.
 * That is why this package needs no image-composition library: the layout
 * engine that draws the demo site draws the cards too, and a card is easier to
 * adjust as markup than as canvas calls.
 */

/** 3.5in x 5in at 300dpi — a card that prints without resampling. */
export const QR_CARD_SIZE = { width: 1050, height: 1500 } as const;
/** 16:9, sized to stay legible pasted into an email or a slide. */
export const COMPARISON_CARD_SIZE = { width: 2400, height: 1350 } as const;

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function dataUrl(file: string): string | null {
  if (!existsSync(file)) return null;
  const mime = MIME[extname(file).toLowerCase()] ?? "image/png";
  return `data:${mime};base64,${readFileSync(file).toString("base64")}`;
}

/** Reasons are written lower-case for logs; the card shows them as a sentence. */
function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const FONT_STACK =
  'ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export interface QrCardInput {
  businessName: string;
  url: string;
  phone?: string | undefined;
  colors: { primary: string; accent: string };
  /** Printed small at the foot of the card, e.g. "Private preview". */
  footnote?: string;
}

/**
 * The QR leave-behind.
 *
 * The code itself is pure black on white regardless of the brand palette. A
 * brand-coloured QR looks better and scans worse, and this card exists to be
 * scanned across a counter in bad light — error correction is set to the
 * highest level for the same reason.
 */
export async function renderQrCard(
  browser: Browser,
  input: QrCardInput,
  outFile: string,
): Promise<string> {
  mkdirSync(join(outFile, ".."), { recursive: true });

  const qr = await QRCode.toDataURL(input.url, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 660,
    color: { dark: "#000000ff", light: "#ffffffff" },
  });

  const shortUrl = input.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
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
  .body { flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 72px 64px 48px; }
  .eyebrow { font-size: 26px; letter-spacing: .22em; text-transform: uppercase; font-weight: 800; color: ${input.colors.accent}; }
  h1 { font-size: 62px; line-height: 1.08; margin: 26px 0 0; color: #0f172a; font-weight: 800; }
  .lede { margin-top: 22px; font-size: 30px; line-height: 1.4; color: #475569; max-width: 24ch; }
  .qr { margin-top: 44px; padding: 22px; border: 3px solid ${input.colors.primary}22; border-radius: 24px; }
  .qr img { display: block; width: 560px; height: 560px; image-rendering: pixelated; }
  .url { margin-top: 30px; font-size: 30px; font-weight: 700; color: ${input.colors.primary}; word-break: break-all; }
  .phone { margin-top: 14px; font-size: 26px; color: #475569; }
  .foot { margin-top: auto; font-size: 20px; color: #94a3b8; }
  .rule { width: 120px; height: 6px; border-radius: 3px; background: ${input.colors.accent}; margin-top: 34px; }
</style>
<div class="band"></div>
<div class="body">
  <div class="eyebrow">A website for</div>
  <h1>${escapeHtml(input.businessName)}</h1>
  <div class="rule"></div>
  <p class="lede">Scan the code to see it on your phone.</p>
  <div class="qr"><img src="${qr}" alt=""></div>
  <div class="url">${escapeHtml(shortUrl)}</div>
  ${input.phone ? `<div class="phone">${escapeHtml(input.phone)}</div>` : ""}
  <div class="foot">${escapeHtml(input.footnote ?? "Private preview — not indexed, not live.")}</div>
</div>`;

  await shootHtml(browser, html, outFile, QR_CARD_SIZE);
  return outFile;
}

export interface ComparisonCardInput {
  businessName: string;
  before: ShotSet;
  after: ShotSet;
  /** Their current site's URL, when they have one. */
  currentUrl?: string | undefined;
  demoUrl: string;
  colors: { primary: string; accent: string };
  capturedOn: string;
}

/**
 * The side-by-side card: their homepage today, the demo beside it.
 *
 * When there is no current site the left panel says so in plain words. It is
 * not filled with a stock "no website" graphic or an old screenshot from
 * somewhere else — a prospect with no site is a different pitch, and the card
 * should make that obvious at a glance rather than imply we found something.
 */
export async function renderComparisonCard(
  browser: Browser,
  input: ComparisonCardInput,
  outFile: string,
): Promise<string> {
  mkdirSync(join(outFile, ".."), { recursive: true });

  const beforeImg = input.before.desktop ? dataUrl(input.before.desktop) : null;
  const afterImg = input.after.desktop ? dataUrl(input.after.desktop) : null;

  const panel = (
    label: string,
    sub: string,
    img: string | null,
    empty: string,
    accent: boolean,
  ): string => `
  <figure class="panel${accent ? " accent" : ""}">
    <figcaption>
      <span class="label">${escapeHtml(label)}</span>
      <span class="sub">${escapeHtml(sub)}</span>
    </figcaption>
    <div class="frame">
      ${
        img
          ? `<img src="${img}" alt="">`
          : `<div class="empty"><p>${escapeHtml(sentence(empty))}</p></div>`
      }
    </div>
  </figure>`;

  const html = `
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    width: ${COMPARISON_CARD_SIZE.width}px;
    height: ${COMPARISON_CARD_SIZE.height}px;
    font-family: ${FONT_STACK};
    background: #f1f5f9;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  header { padding: 40px 56px 26px; }
  header h1 { margin: 0; font-size: 46px; color: #0f172a; font-weight: 800; }
  header p { margin: 10px 0 0; font-size: 26px; color: #475569; }
  .grid { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; padding: 0 56px 40px; min-height: 0; }
  .panel { margin: 0; display: flex; flex-direction: column; min-height: 0; }
  figcaption { display: flex; align-items: baseline; gap: 16px; padding-bottom: 14px; }
  .label { font-size: 30px; font-weight: 800; color: #0f172a; }
  .accent .label { color: ${input.colors.primary}; }
  .sub { font-size: 22px; color: #64748b; }
  .frame {
    flex: 1;
    min-height: 0;
    border-radius: 16px;
    overflow: hidden;
    background: #ffffff;
    border: 4px solid #cbd5e1;
    box-shadow: 0 18px 40px rgba(15, 23, 42, .14);
  }
  .accent .frame { border-color: ${input.colors.primary}; }
  .frame img { display: block; width: 100%; object-fit: cover; object-position: top center; height: 100%; }
  .empty {
    height: 100%; display: flex; align-items: center; justify-content: center;
    background: repeating-linear-gradient(45deg, #f8fafc, #f8fafc 24px, #eef2f7 24px, #eef2f7 48px);
  }
  .empty p { max-width: 18ch; text-align: center; font-size: 34px; line-height: 1.35; color: #64748b; font-weight: 700; margin: 0; }
  footer { padding: 0 56px 34px; font-size: 22px; color: #64748b; display: flex; justify-content: space-between; }
  .demo-url { color: ${input.colors.primary}; font-weight: 700; }
</style>
<header>
  <h1>${escapeHtml(input.businessName)}</h1>
  <p>Their website today, and the one we built for them.</p>
</header>
<div class="grid">
  ${panel(
    "Today",
    input.currentUrl ? input.currentUrl.replace(/^https?:\/\//, "") : "",
    beforeImg,
    input.before.reason ?? "No current website",
    false,
  )}
  ${panel("The new site", input.demoUrl.replace(/^https?:\/\//, ""), afterImg, "The demo did not build", true)}
</div>
<footer>
  <span>Captured ${escapeHtml(input.capturedOn)} · desktop, 1440×900</span>
  <span class="demo-url">${escapeHtml(input.demoUrl.replace(/^https?:\/\//, ""))}</span>
</footer>`;

  await shootHtml(browser, html, outFile, COMPARISON_CARD_SIZE);
  return outFile;
}
