import type { IconName } from "@/src/components/ui/Icon";
import type { ShopDetail } from "@/src/domain/shop-detail";

/**
 * One practical row in *Plan your visit*, resolved from a single source.
 *
 * Two generations of fields describe the same visit. The Milestone 1 domain
 * carries per-field sourced `access`/`practical` blocks; Package B3's published
 * editorial carries free text for the same facts. Rendering both produced two
 * station rows and two payment rows on a record that had been edited in the
 * admin, which is the duplication the shop UI brief asks to reconcile.
 *
 * So each row is decided once, here. Published editorial wins where it exists —
 * it is what the founder last wrote for this shop — and the sourced legacy field
 * is the fallback, never an addition. Nothing is invented and nothing is merged:
 * a row with no value on either side is not a row.
 */
export interface VisitFact {
  readonly key: string;
  readonly icon: IconName;
  readonly label: string;
  readonly value: string;
}

export interface ShopVisitFacts {
  /** Finding the place: station, floor, address. */
  readonly gettingThere: readonly VisitFact[];
  /** Deciding whether the trip works: contact, payment, language, access. */
  readonly beforeYouGo: readonly VisitFact[];
}

function fact(
  key: string,
  icon: IconName,
  label: string,
  value: string | undefined,
): VisitFact | null {
  const text = value?.trim();

  return text ? { key, icon, label, value: text } : null;
}

/** Joined exactly as each source words it; nothing here computes a distance. */
function joined(parts: readonly (string | undefined)[]): string | undefined {
  const present = parts.map((part) => part?.trim()).filter(Boolean);

  return present.length > 0 ? present.join(" · ") : undefined;
}

export function shopVisitFacts(shop: ShopDetail): ShopVisitFacts {
  const editorial = shop.editorial;
  const access = shop.access;
  const practical = shop.practical;

  const station =
    joined([
      editorial?.nearest_station,
      editorial?.station_exit,
      editorial?.walking_guidance,
    ]) ?? joined([access?.nearestStation?.value, access?.walkFromStation?.value]);

  /*
   * Appointment: unknown and false are different answers.
   *
   * Published editorial states the answer either way, so a record that says "no
   * appointment needed" says so. The legacy sourced flag is only rendered when
   * it is true — a `false` there was never written as an answer to a reader, and
   * the founder's review asked for no row where nothing was claimed.
   */
  const appointment =
    editorial?.appointment_required !== undefined
      ? editorial.appointment_required
        ? "An appointment is required."
        : "No appointment is needed."
      : practical?.appointmentRequired?.value
        ? "An appointment is required."
        : undefined;

  const gettingThere = [
    fact("station", "train", "Nearest station", station),
    fact(
      "floor",
      "locate",
      "Unit / floor",
      editorial?.unit_floor ?? access?.floorNote?.value,
    ),
    fact("entrance", "locate", "Finding the door", editorial?.entrance_notes),
    fact(
      "address",
      "locate",
      "Address",
      shop.addressLines && shop.addressLines.length > 0
        ? shop.addressLines.join(", ")
        : undefined,
    ),
    fact("local-address", "locate", "Address in local script", editorial?.local_address),
    fact("postal-code", "locate", "Postal code", shop.postalCode),
  ];

  const beforeYouGo = [
    fact("phone", "locate", "Phone", shop.phone),
    fact("appointment", "clock", "Appointment", appointment),
    fact(
      "payment",
      "card",
      "Payment",
      editorial?.payment_methods ?? practical?.paymentMethods?.values.join(", "),
    ),
    fact(
      "languages",
      "globe",
      "Languages",
      editorial?.languages ?? practical?.languages?.values.join(", "),
    ),
    fact("holidays", "clock", "Holidays", editorial?.holiday_note),
    fact(
      "accessibility",
      "accessibility",
      "Accessibility",
      editorial?.accessibility_notes ?? access?.accessibilityNote?.value,
    ),
  ];

  return {
    gettingThere: gettingThere.filter((row): row is VisitFact => row !== null),
    beforeYouGo: beforeYouGo.filter((row): row is VisitFact => row !== null),
  };
}
