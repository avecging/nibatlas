/**
 * Fitting a name into an impression.
 *
 * An Atlas Stamp is drawn as SVG, and SVG text does not wrap. Milestone 1 dealt
 * with that by stepping the font size down for long names, which held the name
 * on one line at any cost: `NAGASAWA Stationery Center Main Store` ran under the
 * motif, and a long locality name ran to the frame. WP5's responsive brief asks
 * instead that long shop, locality and country names *wrap intentionally*.
 *
 * So this picks a size and a set of lines together: the largest size at which
 * the name fits the space it has been given in no more than `maxLines` lines.
 *
 * Width is estimated rather than measured, because the impression has to render
 * identically on the server, in a test renderer and in the browser — a
 * measurement pass would make the same stamp draw differently in each. The
 * estimate distinguishes full-width scripts from Latin, which is the difference
 * that actually matters here: `銀座 伊東屋 本店` is six advances wide, not six
 * half-advances.
 */

/**
 * Ranges that render full-width in the CJK faces `BRAND.md` names as fallbacks:
 * kana, CJK ideographs, the compatibility block, and full-width forms.
 */
const FULL_WIDTH = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/;

/** Advance width of one character, in ems, at the impression's face. */
function advance(character: string): number {
  if (FULL_WIDTH.test(character)) {
    return 1;
  }

  // Measured against Source Serif 4 at the sizes the impression uses: an
  // average Latin advance is a little over half an em, and the narrow forms
  // below pull well under it.
  if (character === " ") {
    return 0.26;
  }

  if ("ijltIJ.,;:!'’|".includes(character)) {
    return 0.31;
  }

  if ("MW".includes(character)) {
    return 0.86;
  }

  if (character >= "A" && character <= "Z") {
    return 0.66;
  }

  return 0.52;
}

export function estimateTextEms(text: string): number {
  let total = 0;

  for (const character of text) {
    total += advance(character);
  }

  return total;
}

/**
 * Greedy wrap at word boundaries, falling back to character boundaries.
 *
 * Full-width scripts do not use spaces, so a Japanese or Traditional Chinese
 * name that does not fit is broken between characters — which is how those
 * scripts break — rather than being left to overrun.
 */
function wrap(text: string, maxEms: number, maxLines: number): string[] | null {
  const lines: string[] = [];
  let current = "";

  const push = () => {
    if (current !== "") {
      lines.push(current);
      current = "";
    }
  };

  const words = text.split(" ").filter((word) => word !== "");

  for (const word of words) {
    const candidate = current === "" ? word : `${current} ${word}`;

    if (estimateTextEms(candidate) <= maxEms) {
      current = candidate;
      continue;
    }

    push();

    if (estimateTextEms(word) <= maxEms) {
      current = word;
      continue;
    }

    // One word wider than the line: break it between characters.
    for (const character of word) {
      const grown = current + character;

      if (estimateTextEms(grown) <= maxEms) {
        current = grown;
        continue;
      }

      push();
      current = character;
    }
  }

  push();

  if (lines.length === 0 || lines.length > maxLines) {
    return null;
  }

  return lines;
}

export interface FittedTitle {
  readonly fontSize: number;
  readonly lines: readonly string[];
  readonly lineHeight: number;
}

/**
 * The largest of `sizes` at which `title` fits `maxWidth` in at most `maxLines`
 * lines. The smallest size is always accepted, wrapped as far as it goes, so a
 * pathological name still draws rather than disappearing.
 */
export function fitStampTitle({
  title,
  maxWidth,
  sizes,
  maxLines = 2,
}: {
  readonly title: string;
  readonly maxWidth: number;
  readonly sizes: readonly number[];
  readonly maxLines?: number;
}): FittedTitle {
  for (const fontSize of sizes) {
    const lines = wrap(title, maxWidth / fontSize, maxLines);

    if (lines) {
      return { fontSize, lines, lineHeight: Math.round(fontSize * 1.16) };
    }
  }

  const fontSize = sizes[sizes.length - 1] ?? 20;
  const lines = wrap(title, maxWidth / fontSize, maxLines + 1) ?? [title];

  return { fontSize, lines, lineHeight: Math.round(fontSize * 1.16) };
}
