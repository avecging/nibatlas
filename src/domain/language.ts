/**
 * BCP 47 language tag attached to user-visible content.
 *
 * It is intentionally data, not inferred from country: multilingual countries
 * and scripts make a country-to-language switch incorrect. Runtime validation
 * belongs at fixture/import boundaries because TypeScript cannot model the full
 * BCP 47 grammar usefully.
 */
export type LanguageTag = string;

export function isLanguageTag(value: string): value is LanguageTag {
  try {
    return Intl.getCanonicalLocales(value).length === 1;
  } catch {
    return false;
  }
}
