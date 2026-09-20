import { countryLabel, isCountryCode, type CountryCode } from "@/src/domain/geo";

export interface CountryChoice {
  code: CountryCode;
  name: string;
}

/**
 * CLDR names some codes that are not a country an editor can put a shop in:
 * `ZZ` is "Unknown Region", `QO` is "Outlying Oceania", `EU`/`EZ`/`UN` are
 * organisations and `XA`/`XB` are pseudo-locales for testing. Offering any of
 * them would invite a record whose country is a placeholder.
 */
const NOT_A_COUNTRY = new Set(["ZZ", "QO", "EU", "EZ", "UN", "XA", "XB"]);

let cache: CountryChoice[] | null = null;

/**
 * The countries this runtime can name, for the approved friendly selector.
 *
 * `src/domain/geo.ts` deliberately refuses to enumerate countries in the
 * contract: storage accepts any two uppercase ASCII letters so a new country
 * never needs a code release. That stays true. This list is presentation only —
 * it makes the common case findable by name, and a code the runtime cannot name
 * is still accepted and still shown, rather than being rejected or quietly
 * dropped.
 */
export function countryChoices(): CountryChoice[] {
  if (cache) return cache;
  const named = namer();
  const out: CountryChoice[] = [];
  if (named) {
    for (let first = 65; first <= 90; first++)
      for (let second = 65; second <= 90; second++) {
        const code = String.fromCharCode(first, second) as CountryCode;
        let name: string | undefined;
        try {
          name = named.of(code);
        } catch {
          name = undefined;
        }
        // `fallback: "none"` returns undefined for a code CLDR does not know,
        // so anything that comes back is a region this runtime can actually name.
        if (name && name !== code && !NOT_A_COUNTRY.has(code)) out.push({ code, name });
      }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  cache = out;
  return out;
}

function namer(): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
  } catch {
    return null;
  }
}

/**
 * The display name for a saved code, falling back to the code itself.
 *
 * A code outside the selector's list reads as the code rather than as whatever
 * CLDR calls it: showing a shop's country as "Unknown Region" would state
 * something the record does not say.
 */
export function countryName(code: string): string {
  if (!isCountryCode(code)) return code;
  if (!countryChoices().some((choice) => choice.code === code)) return code;
  return countryLabel(code);
}

/**
 * Case-insensitive search over the country name and its code, so "japan",
 * "JP" and "united" all find something.
 */
export function matchCountries(query: string, limit = 60): CountryChoice[] {
  const choices = countryChoices();
  const needle = query.trim().toLowerCase();
  if (!needle) return choices.slice(0, limit);
  const scored: { choice: CountryChoice; score: number }[] = [];
  for (const choice of choices) {
    const name = choice.name.toLowerCase();
    const code = choice.code.toLowerCase();
    if (code === needle) scored.push({ choice, score: 0 });
    else if (name.startsWith(needle)) scored.push({ choice, score: 1 });
    else if (name.includes(needle)) scored.push({ choice, score: 2 });
    else if (code.startsWith(needle)) scored.push({ choice, score: 3 });
  }
  scored.sort((a, b) => a.score - b.score || a.choice.name.localeCompare(b.choice.name));
  return scored.slice(0, limit).map((s) => s.choice);
}
