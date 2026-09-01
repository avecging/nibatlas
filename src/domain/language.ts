/**
 * BCP 47 language tag attached to user-visible content.
 *
 * It is intentionally data, not inferred from country: multilingual countries
 * and scripts make a country-to-language switch incorrect. Runtime validation
 * belongs at fixture/import boundaries because TypeScript cannot model the full
 * BCP 47 grammar usefully.
 */
declare const LANGUAGE_TAG_BRAND: unique symbol;

export type LanguageTag = string & {
  readonly [LANGUAGE_TAG_BRAND]: "LanguageTag";
};

export function isLanguageTag(value: string): value is LanguageTag {
  try {
    return Intl.getCanonicalLocales(value).length === 1;
  } catch {
    return false;
  }
}


/** Validates untrusted or fixture data and returns a typed BCP 47 tag. */
export function languageTag(value: string): LanguageTag {
  if (!isLanguageTag(value)) {
    throw new RangeError(`Invalid BCP 47 language tag: ${value}`);
  }

  return value;
}

const RTL_SCRIPTS = new Set([
  "Adlm",
  "Arab",
  "Hebr",
  "Mand",
  "Mend",
  "Nkoo",
  "Rohg",
  "Samr",
  "Syrc",
  "Thaa",
]);

/**
 * Text direction implied by a BCP 47 tag's maximised script.
 *
 * HTML can use `dir="auto"`; SVG text needs an explicit presentation direction.
 * Invalid or unknown tags fail safely to the application's left-to-right default.
 */
export function languageDirection(languageTag: LanguageTag): "ltr" | "rtl" {
  try {
    const script = new Intl.Locale(languageTag).maximize().script;
    return script !== undefined && RTL_SCRIPTS.has(script) ? "rtl" : "ltr";
  } catch {
    return "ltr";
  }
}
