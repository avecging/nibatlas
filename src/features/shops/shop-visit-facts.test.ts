import { describe, expect, it } from "vitest";

import type { ShopDetail } from "@/src/domain/shop-detail";
import { shopVisitFacts } from "@/src/features/shops/shop-visit-facts";
import { shopValueSpecimen } from "@/src/fixtures/shop-value-specimen";

function labels(facts: readonly { label: string }[]): readonly string[] {
  return facts.map((fact) => fact.label);
}

describe("reconciling two generations of visit fields", () => {
  it("reads the sourced legacy blocks when nothing was published editorially", () => {
    const { gettingThere, beforeYouGo } = shopVisitFacts(shopValueSpecimen);

    expect(gettingThere).toContainEqual(
      expect.objectContaining({
        label: "Nearest station",
        value: "Specimen Station, exit B2 · 4 minutes on foot",
      }),
    );
    expect(beforeYouGo).toContainEqual(
      expect.objectContaining({ label: "Payment", value: "Cash, Credit card" }),
    );
  });

  it("prints one station row, not one per field generation", () => {
    const edited: ShopDetail = {
      ...shopValueSpecimen,
      editorial: {
        nearest_station: "Ginza Station",
        station_exit: "Exit A13",
        payment_methods: "Cash and major cards",
      },
    };

    const { gettingThere, beforeYouGo } = shopVisitFacts(edited);

    expect(gettingThere.filter((fact) => fact.label === "Nearest station")).toHaveLength(1);
    expect(beforeYouGo.filter((fact) => fact.label === "Payment")).toHaveLength(1);
    expect(beforeYouGo[0]?.value).toBe("Cash and major cards");

    // The legacy sourced values are replaced, never appended beside them.
    expect(gettingThere[0]?.value).not.toContain("Specimen Station");
    expect(JSON.stringify(beforeYouGo)).not.toContain("Credit card");
  });

  it("keeps a sourced walk time an editor did not retype", () => {
    // Station, exit and walk are three facts. Replacing the station name must
    // not silently drop "4 minutes on foot", which only the source words.
    const edited: ShopDetail = {
      ...shopValueSpecimen,
      editorial: { nearest_station: "Ginza Station", station_exit: "Exit A13" },
    };

    expect(shopVisitFacts(edited).gettingThere[0]?.value).toBe(
      "Ginza Station · Exit A13 · 4 minutes on foot",
    );
  });

  it("does not let a stray space blank a sourced fact", () => {
    // `decodeEditorialContent` drops an empty string but keeps a space, so the
    // choice between the two generations has to be made on trimmed text.
    const edited: ShopDetail = {
      ...shopValueSpecimen,
      editorial: { unit_floor: "   ", accessibility_notes: " " },
    };

    const { gettingThere, beforeYouGo } = shopVisitFacts(edited);

    expect(gettingThere).toContainEqual(
      expect.objectContaining({
        label: "Unit / floor",
        value: "Third floor of the Specimen Building; use the rear lift.",
      }),
    );
    expect(beforeYouGo).toContainEqual(
      expect.objectContaining({
        label: "Accessibility",
        value: "Step-free from the lift lobby.",
      }),
    );
  });

  it("omits an unsupported field in silence", () => {
    // `exactOptionalPropertyTypes` makes an absent field and an explicit
    // `undefined` different things, and absence is the real shape here.
    const sparse: ShopDetail = { ...shopValueSpecimen };
    const writable: Partial<Record<keyof ShopDetail, unknown>> = sparse;

    delete writable.access;
    delete writable.practical;
    delete writable.addressLines;

    expect(shopVisitFacts(sparse)).toEqual({ gettingThere: [], beforeYouGo: [] });
  });

  it("keeps unknown and false as different answers about an appointment", () => {
    // The legacy flag is only rendered when it is true: a sourced `false` was
    // never written as an answer to a reader.
    expect(labels(shopVisitFacts(shopValueSpecimen).beforeYouGo)).not.toContain("Appointment");

    // Published editorial states it either way, so a "no" is shown as a "no".
    const published = shopVisitFacts({
      ...shopValueSpecimen,
      editorial: { appointment_required: false },
    });

    expect(published.beforeYouGo).toContainEqual(
      expect.objectContaining({ label: "Appointment", value: "No appointment is needed." }),
    );
  });

  it("does not invent a row from an empty published list", () => {
    const empty = shopVisitFacts({
      ...shopValueSpecimen,
      practical: { paymentMethods: { values: [] }, languages: { values: [] } },
    });

    expect(labels(empty.beforeYouGo)).not.toContain("Payment");
    expect(labels(empty.beforeYouGo)).not.toContain("Languages");
  });
});
