/**
 * Types for `og-card.mjs`. See that file for why the module is `.mjs`.
 *
 * Hand-written rather than generated: the module is plain JavaScript with JSDoc
 * and has no build step, exactly like `src/lib/preview-origin.d.ts` beside its
 * own `.mjs`.
 */

export declare const OG_CARD_SIZE: { width: number; height: number };

export interface CardPalette {
  base: string;
  ink: string;
  inkMuted: string;
}

export interface CardInfo {
  /** The business name, as the card's headline. */
  name: string;
  /** "Locality, REGION" — may be empty. */
  place: string;
  /** One line under the name — may be empty. */
  tagline: string;
  /** The mark, already inlined as a data URI. */
  logoDataUri: string;
  palette: CardPalette;
  /** The accent colour of the tone in play. */
  accent: string;
}

export declare function ogCardHtml(info: CardInfo): string;
