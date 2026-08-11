import { readFileSync } from "node:fs";
import { extname } from "node:path";

import type { Browser } from "playwright";

import {
  type Rgb,
  hexToHsl,
  palettePasses,
  repairPalette,
  rgbToHsl,
  toHex,
} from "./color.js";
import type { BrandColors } from "./types.js";

/**
 * Extract a brand palette from the prospect's own logo or photos.
 *
 * Decoding happens in the Chromium instance Playwright already ships: the
 * image is drawn to a small canvas and the pixels are read back. That is the
 * whole reason this package needs no image library — no `sharp`, no native
 * build step, no second copy of libvips on disk — and it handles SVG, PNG,
 * JPEG, WebP and AVIF identically because the browser already knows how to
 * paint all five.
 */

const MIME: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
};

export function isSupportedImage(file: string): boolean {
  return extname(file).toLowerCase() in MIME;
}

function dataUrl(file: string): string {
  const mime = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
  return `data:${mime};base64,${readFileSync(file).toString("base64")}`;
}

/** Sample size. 64x64 is ~4k pixels — plenty for a palette, instant to cluster. */
const SAMPLE = 64;

async function samplePixels(browser: Browser, file: string): Promise<Rgb[]> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    return await page.evaluate(
      async ([src, size]) => {
        const img = new Image();
        img.decoding = "sync";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            resolve();
          };
          img.onerror = () => {
            reject(new Error("image failed to decode"));
          };
          img.src = src as string;
        });
        const n = size as number;
        const canvas = document.createElement("canvas");
        canvas.width = n;
        canvas.height = n;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        // Transparent logos are the common case; compositing onto white
        // matches how the site will actually show them.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, n, n);
        ctx.drawImage(img, 0, 0, n, n);
        const { data } = ctx.getImageData(0, 0, n, n);
        const out: { r: number; g: number; b: number }[] = [];
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3] ?? 0;
          if (alpha < 200) continue;
          out.push({ r: data[i] ?? 0, g: data[i + 1] ?? 0, b: data[i + 2] ?? 0 });
        }
        return out;
      },
      [dataUrl(file), SAMPLE] as const,
    );
  } finally {
    await context.close();
  }
}

interface Cluster {
  center: Rgb;
  weight: number;
}

/** k-means, fixed seed and fixed iteration count so a run repeats exactly. */
function kmeans(pixels: Rgb[], k: number, iterations = 12): Cluster[] {
  if (pixels.length === 0) return [];
  // Deterministic seeding: evenly spaced picks through the (unshuffled) sample.
  const centers: Rgb[] = [];
  for (let i = 0; i < k; i += 1) {
    const pick = pixels[Math.floor((i * pixels.length) / k)];
    if (pick) centers.push({ ...pick });
  }

  const assignment = new Array<number>(pixels.length).fill(0);
  for (let iter = 0; iter < iterations; iter += 1) {
    for (let p = 0; p < pixels.length; p += 1) {
      const px = pixels[p];
      if (!px) continue;
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centers.length; c += 1) {
        const cc = centers[c];
        if (!cc) continue;
        const d = (px.r - cc.r) ** 2 + (px.g - cc.g) ** 2 + (px.b - cc.b) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      assignment[p] = best;
    }
    const sums = centers.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    for (let p = 0; p < pixels.length; p += 1) {
      const px = pixels[p];
      const bucket = sums[assignment[p] ?? 0];
      if (!px || !bucket) continue;
      bucket.r += px.r;
      bucket.g += px.g;
      bucket.b += px.b;
      bucket.n += 1;
    }
    for (let c = 0; c < centers.length; c += 1) {
      const bucket = sums[c];
      if (!bucket || bucket.n === 0) continue;
      centers[c] = { r: bucket.r / bucket.n, g: bucket.g / bucket.n, b: bucket.b / bucket.n };
    }
  }

  const counts = new Array<number>(centers.length).fill(0);
  for (const a of assignment) counts[a] = (counts[a] ?? 0) + 1;
  return centers
    .map((center, i) => ({ center, weight: (counts[i] ?? 0) / pixels.length }))
    .filter((c) => c.weight > 0)
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Drop the pixels that are not brand colour: paper white, ink black, and the
 * greys in between. A logo is mostly background, and the biggest cluster in an
 * unfiltered sample is almost always white — which is not a brand colour, it
 * is the absence of one.
 */
function isCandidate(rgb: Rgb): boolean {
  const { s, l } = rgbToHsl(rgb);
  return l > 0.08 && l < 0.93 && s > 0.15;
}

function hueDistance(a: string, b: string): number {
  const d = Math.abs(hexToHsl(a).h - hexToHsl(b).h) % 360;
  return d > 180 ? 360 - d : d;
}

export interface ExtractedPalette {
  colors: BrandColors;
  /** Which file the colours came from. */
  sourceFile: string;
  /** Plain-words account of what happened, recorded on the field. */
  note: string;
  /** True when a second brand colour could not be found and one was derived. */
  accentDerived: boolean;
  /** True when a colour was darkened to clear WCAG AA. */
  adjusted: boolean;
}

/**
 * Extract two brand colours from one image.
 *
 * Returns null when the image yields nothing usable — an all-grey logo, a
 * photo of a grey shop floor, a file the browser could not decode — and the
 * caller falls back to the per-niche palette. Returning a grey "brand colour"
 * would be worse than admitting we could not find one.
 */
export async function extractPalette(
  browser: Browser,
  file: string,
): Promise<ExtractedPalette | null> {
  let pixels: Rgb[];
  try {
    pixels = await samplePixels(browser, file);
  } catch {
    return null;
  }

  const candidates = pixels.filter(isCandidate);
  if (candidates.length < pixels.length * 0.02 || candidates.length < 20) return null;

  const clusters = kmeans(candidates, 4);
  const first = clusters[0];
  if (!first) return null;

  const primaryRaw = toHex(first.center);
  // The accent should be a *different* colour, not a lighter shade of the
  // primary. Anything within 25 degrees of hue is the same brand colour.
  const accentCluster = clusters
    .slice(1)
    .find((c) => c.weight >= 0.05 && hueDistance(primaryRaw, toHex(c.center)) >= 25);

  const accentDerived = accentCluster === undefined;
  const accentRaw = accentCluster
    ? toHex(accentCluster.center)
    : (() => {
        // No second brand colour in the artwork. Derive a warm complement so
        // the CTA is distinguishable from the primary — recorded as derived,
        // because it is our choice and not their brand.
        const hsl = hexToHsl(primaryRaw);
        return toHex(
          (() => {
            const shifted = { ...hsl, h: hsl.h + 150 };
            const { r, g, b } = hslToRgbLocal(shifted);
            return { r, g, b };
          })(),
        );
      })();

  const repaired = repairPalette(primaryRaw, accentRaw);
  if (!repaired.pairings.every((p) => p.ok)) return null;

  const parts = [
    `primary from the dominant non-neutral colour in ${file.split(/[\\/]/).pop() ?? file}`,
    accentDerived
      ? "accent derived from it (the artwork carried only one brand colour)"
      : "accent from the second distinct colour in the same artwork",
  ];
  if (repaired.adjusted) parts.push("darkened to clear WCAG AA at body-text size");

  return {
    colors: { primary: repaired.primary, accent: repaired.accent },
    sourceFile: file,
    note: parts.join("; "),
    accentDerived,
    adjusted: repaired.adjusted,
  };
}

/** Local copy to avoid an import cycle in the derived-accent branch above. */
function hslToRgbLocal(hsl: { h: number; s: number; l: number }): Rgb {
  const { h, s, l } = hsl;
  const hn = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t0: number): number => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: ch(hn + 1 / 3) * 255, g: ch(hn) * 255, b: ch(hn - 1 / 3) * 255 };
}

export { palettePasses };
