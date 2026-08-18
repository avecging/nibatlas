import type { CountryCode } from "@/src/domain/geo";

/** `lang` attribute for local-script shop names so CJK line breaking is correct. */
export function localeForCountry(countryCode: CountryCode): string {
  switch (countryCode) {
    case "JP":
      return "ja";
    case "TW":
      return "zh-Hant";
    default:
      return "en";
  }
}
