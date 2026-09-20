/**
 * Readable timezone choices over the platform's IANA database.
 *
 * Storage is unchanged: the saved value is always an IANA identifier such as
 * `Asia/Singapore`, which `public.validate_iana_timezone()` still checks. The
 * labels here exist only so a human can find a place by name and see what the
 * clock currently says there.
 *
 * A fixed UTC offset is not a timezone: `Etc/GMT-8` never observes a seasonal
 * change, so those entries are grouped separately and never presented as the
 * location a shop is in.
 */
export interface TimezoneChoice {
  /** The IANA identifier that is persisted. */
  id: string;
  /** Place part of the identifier, for example "Ho Chi Minh". */
  place: string;
  /** Region part of the identifier, for example "Asia". */
  region: string;
  /** Current offset label, for example "UTC+08:00". Empty when unavailable. */
  offset: string;
  /** Fixed-offset or legacy entries sort after real locations. */
  fixedOffset: boolean;
}

const READABLE = /^[A-Za-z0-9+_-]+(?:\/[A-Za-z0-9+_.-]+){0,2}$/;

export function supportedTimezones(): string[] {
  const supported = (
    Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;
  if (typeof supported !== "function") return [];
  try {
    return supported("timeZone").filter((id) => READABLE.test(id));
  } catch {
    return [];
  }
}

/** "GMT+08:00" → "UTC+08:00"; "GMT" → "UTC+00:00". */
export function currentOffset(id: string, now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: id,
      timeZoneName: "longOffset",
    }).formatToParts(now);
    const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    if (!name.startsWith("GMT")) return "";
    const rest = name.slice(3);
    return `UTC${rest || "+00:00"}`;
  } catch {
    return "";
  }
}

export function isValidTimezone(id: string): boolean {
  if (!id || !READABLE.test(id)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: id });
    return true;
  } catch {
    return false;
  }
}

function toChoice(id: string, now: Date): TimezoneChoice {
  const segments = id.split("/");
  const region = segments.length > 1 ? segments[0]! : "";
  const place = (segments.length > 1 ? segments.slice(1).join(" · ") : id).replaceAll(
    "_",
    " ",
  );
  return {
    id,
    place,
    region,
    offset: currentOffset(id, now),
    fixedOffset: region === "Etc" || id === "UTC" || id === "GMT",
  };
}

/**
 * Every supported zone, plus `keep` when the catalogue already holds a valid
 * identifier the platform does not list (a legacy alias such as
 * `Asia/Calcutta`). An existing valid value is never dropped from the choices.
 */
export function timezoneChoices(keep?: string | null, now = new Date()): TimezoneChoice[] {
  const ids = supportedTimezones();
  const seen = new Set(ids);
  if (keep && !seen.has(keep) && isValidTimezone(keep)) ids.push(keep);
  const choices = ids.map((id) => toChoice(id, now));
  choices.sort((a, b) => {
    if (a.fixedOffset !== b.fixedOffset) return a.fixedOffset ? 1 : -1;
    return (
      a.region.localeCompare(b.region) ||
      a.place.localeCompare(b.place) ||
      a.id.localeCompare(b.id)
    );
  });
  return choices;
}

export function timezoneLabel(choice: TimezoneChoice): string {
  const place = choice.region ? `${choice.place}, ${choice.region}` : choice.place;
  return choice.offset ? `${place} — ${choice.offset}` : place;
}

/**
 * Case-insensitive match over the place, region, identifier and offset, so
 * "singapore", "asia/sing", "+08" and "Kuala" all find something useful.
 */
export function matchTimezones(
  choices: TimezoneChoice[],
  query: string,
  limit = 60,
): TimezoneChoice[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return choices.slice(0, limit);
  const terms = needle.split(/\s+/);
  const scored: { choice: TimezoneChoice; score: number }[] = [];
  for (const choice of choices) {
    const haystack =
      `${choice.id} ${choice.place} ${choice.region} ${choice.offset}`.toLowerCase();
    if (!terms.every((term) => haystack.includes(term))) continue;
    const place = choice.place.toLowerCase();
    const score = place.startsWith(needle) ? 0 : place.includes(needle) ? 1 : 2;
    scored.push({ choice, score: score + (choice.fixedOffset ? 4 : 0) });
    if (scored.length > limit * 6) break;
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((s) => s.choice);
}

/**
 * A starting suggestion for a country that has one obvious zone. It is only a
 * suggestion: the field stays editable and a deliberate edit is never
 * overwritten on a later render.
 */
export function suggestTimezone(countryCode: string | null | undefined): string {
  if (!countryCode) return "";
  const suggestion = SINGLE_ZONE_COUNTRIES[countryCode.toUpperCase()];
  return suggestion && isValidTimezone(suggestion) ? suggestion : "";
}

/**
 * Deliberately limited to countries with a single civil timezone, so a
 * suggestion can never quietly put a shop in the wrong one. Countries with
 * several zones are left blank for the editor to choose.
 */
const SINGLE_ZONE_COUNTRIES: Record<string, string> = {
  SG: "Asia/Singapore",
  JP: "Asia/Tokyo",
  KR: "Asia/Seoul",
  TW: "Asia/Taipei",
  HK: "Asia/Hong_Kong",
  MO: "Asia/Macau",
  MY: "Asia/Kuala_Lumpur",
  TH: "Asia/Bangkok",
  VN: "Asia/Ho_Chi_Minh",
  PH: "Asia/Manila",
  IN: "Asia/Kolkata",
  AE: "Asia/Dubai",
  IL: "Asia/Jerusalem",
  GB: "Europe/London",
  IE: "Europe/Dublin",
  FR: "Europe/Paris",
  DE: "Europe/Berlin",
  NL: "Europe/Amsterdam",
  BE: "Europe/Brussels",
  IT: "Europe/Rome",
  AT: "Europe/Vienna",
  CH: "Europe/Zurich",
  SE: "Europe/Stockholm",
  NO: "Europe/Oslo",
  DK: "Europe/Copenhagen",
  FI: "Europe/Helsinki",
  PL: "Europe/Warsaw",
  CZ: "Europe/Prague",
};
