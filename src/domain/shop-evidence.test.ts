import { describe, expect, it } from "vitest";

import type { ShopDetail, ShopSourceRef } from "@/src/domain/shop-detail";
import {
  ACCESS_EVIDENCE_TOKENS,
  exclusiveEvidenceToken,
  experienceEvidenceToken,
  hasSourcedValueLayer,
  PRACTICAL_EVIDENCE_TOKENS,
  serviceEvidenceToken,
  shopEvidenceIssues,
} from "@/src/domain/shop-evidence";
import { findPrototypeShop } from "@/src/fixtures/prototype-catalogue";
import { shopValueSpecimen } from "@/src/fixtures/shop-value-specimen";

const SOURCE = shopValueSpecimen.sources[0]!.id;

/**
 * The specimen with claims replaced, or removed by passing `undefined`.
 *
 * `exactOptionalPropertyTypes` treats an explicit `undefined` as distinct from an
 * absent key, and a spread cannot express "drop this key". The cast is confined
 * to this helper; every assertion below still reads a real `ShopDetail`.
 */
type ShopOverrides = {
  readonly [K in keyof ShopDetail]?: ShopDetail[K] | undefined;
};

function withClaims(patch: ShopOverrides): ShopDetail {
  return { ...shopValueSpecimen, ...patch } as ShopDetail;
}

/** A record carrying exactly the sources a test wants to reason about. */
function withSources(
  sources: readonly ShopSourceRef[],
  patch: ShopOverrides,
): ShopDetail {
  return withClaims({ ...patch, sources });
}

const bare = {
  services: undefined,
  experiences: undefined,
  exclusives: undefined,
  access: undefined,
  practical: undefined,
} as const;

describe("shopEvidenceIssues — a fully supported record", () => {
  it("accepts the specimen, whose source confirms every claim it makes", () => {
    // Services, experiences, an exclusive, four access fields and three
    // practical fields, each named in the source's own `confirms` list.
    expect(shopEvidenceIssues(shopValueSpecimen)).toEqual([]);
  });

  it("has nothing to check on a record with no pen-specific claims", () => {
    expect(shopEvidenceIssues(withClaims(bare))).toEqual([]);
  });
});

describe("shopEvidenceIssues — a source that is not attached", () => {
  it("rejects a claim naming a source the record does not carry", () => {
    const shop = withClaims({
      ...bare,
      services: [{ label: "Nib grinding", confirmedBy: "A source nobody attached" }],
    });

    expect(shopEvidenceIssues(shop)).toEqual([
      {
        path: "services[0]",
        token: "Service: Nib grinding",
        confirmedBy: "A source nobody attached",
        failure: "unknown-source",
      },
    ]);
  });
});

describe("shopEvidenceIssues — an attached but unrelated source", () => {
  /**
   * The defect the P2 review found, as a test.
   *
   * TY Lee's own website is a real, attached, `official` source — and it confirms
   * only the shop's local-script name. Naming it must not publish a nib service.
   */
  it("rejects a service citing a source whose evidence does not cover it", () => {
    const tyLee = findPrototypeShop("ty-lee-pen-shop")!;
    const official = tyLee.sources.find((source) => source.kind === "official")!;

    expect(official.confirms).toEqual(["Local-script name"]);

    const shop = withSources(tyLee.sources, {
      ...bare,
      services: [
        {
          label: "Nib alignment & tuning",
          accessMode: "walk_in",
          confirmedBy: official.id,
        },
      ],
    });

    expect(shopEvidenceIssues(shop)).toEqual([
      {
        path: "services[0]",
        token: "Service: Nib alignment & tuning",
        confirmedBy: official.id,
        failure: "claim-not-confirmed",
      },
    ]);
  });

  it("rejects an experience and an exclusive on the same footing", () => {
    const source: ShopSourceRef = {
      id: "00000000-0000-4000-8000-000000000901",
      label: "Only confirms the address",
      retrievedOn: "2026-08-27",
      kind: "official",
      confirms: ["Address"],
    };

    const shop = withSources([source], {
      ...bare,
      experiences: [{ label: "Test bench", confirmedBy: source.id }],
      exclusives: [{ label: "House ink", confirmedBy: source.id }],
    });

    expect(shopEvidenceIssues(shop).map((issue) => [issue.path, issue.failure])).toEqual([
      ["experiences[0]", "claim-not-confirmed"],
      ["exclusives[0]", "claim-not-confirmed"],
    ]);
  });

  it("does not let one claim's evidence cover a differently named claim", () => {
    // The source confirms the alignment service and nothing else, so the second
    // service is unsupported even though the first one is fine.
    const source: ShopSourceRef = {
      id: "00000000-0000-4000-8000-000000000902",
      label: "Confirms one service",
      retrievedOn: "2026-08-27",
      kind: "official",
      confirms: [serviceEvidenceToken("Nib alignment & tuning")],
    };

    const shop = withSources([source], {
      ...bare,
      services: [
        { label: "Nib alignment & tuning", confirmedBy: source.id },
        { label: "Custom grind", confirmedBy: source.id },
      ],
    });

    expect(shopEvidenceIssues(shop)).toEqual([
      {
        path: "services[1]",
        token: "Service: Custom grind",
        confirmedBy: source.id,
        failure: "claim-not-confirmed",
      },
    ]);
  });

  it("never reads a similarly worded confirmation as support", () => {
    // "Languages of the website" is not "Languages spoken". No substring or
    // prefix matching, so this stays a rejection.
    const source: ShopSourceRef = {
      id: "00000000-0000-4000-8000-000000000903",
      label: "Confirms the website's languages",
      retrievedOn: "2026-08-27",
      kind: "official",
      confirms: ["Languages of the website"],
    };

    const shop = withSources([source], {
      ...bare,
      practical: { languages: { values: ["English"], confirmedBy: source.id } },
    });

    expect(shopEvidenceIssues(shop).map((issue) => issue.path)).toEqual([
      "practical.languages",
    ]);
  });
});

describe("shopEvidenceIssues — access and practical are checked per field", () => {
  /**
   * One supported field must not validate another.
   *
   * The source publishes a station. It says nothing about the floor, the payment
   * methods, the languages, or whether an appointment is needed, and each of
   * those is rejected on its own.
   */
  const stationOnly: ShopSourceRef = {
    id: "00000000-0000-4000-8000-000000000904",
    label: "Station notice, confirms the station only",
    retrievedOn: "2026-08-27",
    kind: "official",
    confirms: [ACCESS_EVIDENCE_TOKENS.nearestStation],
  };

  it("accepts the confirmed field and rejects every other populated one", () => {
    const shop = withSources([stationOnly], {
      ...bare,
      access: {
        nearestStation: { value: "Specimen Station", confirmedBy: stationOnly.id },
        walkFromStation: { value: "4 minutes on foot", confirmedBy: stationOnly.id },
        floorNote: { value: "Third floor", confirmedBy: stationOnly.id },
        accessibilityNote: { value: "Step-free", confirmedBy: stationOnly.id },
      },
      practical: {
        paymentMethods: { values: ["Cash"], confirmedBy: stationOnly.id },
        languages: { values: ["Japanese"], confirmedBy: stationOnly.id },
        appointmentRequired: { value: true, confirmedBy: stationOnly.id },
      },
    });

    // `access.nearestStation` is absent from the failures: it is the one field
    // this source actually supports.
    expect(shopEvidenceIssues(shop).map((issue) => issue.path)).toEqual([
      "access.walkFromStation",
      "access.floorNote",
      "access.accessibilityNote",
      "practical.paymentMethods",
      "practical.languages",
      "practical.appointmentRequired",
    ]);
  });

  it("checks each field against its own token", () => {
    const shop = withSources([stationOnly], {
      ...bare,
      access: { floorNote: { value: "Third floor", confirmedBy: stationOnly.id } },
    });

    expect(shopEvidenceIssues(shop)).toEqual([
      {
        path: "access.floorNote",
        token: ACCESS_EVIDENCE_TOKENS.floorNote,
        confirmedBy: stationOnly.id,
        failure: "claim-not-confirmed",
      },
    ]);
  });

  it("lets different fields of one block rest on different sources", () => {
    const station: ShopSourceRef = {
      id: "00000000-0000-4000-8000-000000000905",
      label: "Confirms the station",
      retrievedOn: "2026-08-27",
      kind: "official",
      confirms: [ACCESS_EVIDENCE_TOKENS.nearestStation],
    };
    const payment: ShopSourceRef = {
      id: "00000000-0000-4000-8000-000000000906",
      label: "Confirms the payment methods",
      retrievedOn: "2026-08-27",
      kind: "brand_dealer_list",
      confirms: [PRACTICAL_EVIDENCE_TOKENS.paymentMethods],
    };

    const shop = withSources([station, payment], {
      ...bare,
      access: { nearestStation: { value: "Specimen Station", confirmedBy: station.id } },
      practical: { paymentMethods: { values: ["Cash"], confirmedBy: payment.id } },
    });

    expect(shopEvidenceIssues(shop)).toEqual([]);
  });

  it("ignores an absent field rather than demanding evidence for it", () => {
    const shop = withSources([stationOnly], {
      ...bare,
      access: { nearestStation: { value: "Specimen Station", confirmedBy: stationOnly.id } },
    });

    expect(shopEvidenceIssues(shop)).toEqual([]);
  });

  it("still checks a field whose value is falsy", () => {
    // `appointmentRequired: false` is a claim about the shop, not an absence, so
    // it needs evidence like any other.
    const shop = withSources([stationOnly], {
      ...bare,
      practical: { appointmentRequired: { value: false, confirmedBy: stationOnly.id } },
    });

    expect(shopEvidenceIssues(shop).map((issue) => issue.path)).toEqual([
      "practical.appointmentRequired",
    ]);
  });
});

describe("evidence tokens", () => {
  it("are readable English, because reviewer mode prints them verbatim", () => {
    expect(serviceEvidenceToken("Custom grind")).toBe("Service: Custom grind");
    expect(experienceEvidenceToken("Test bench")).toBe("Experience: Test bench");
    expect(exclusiveEvidenceToken("House ink")).toBe("Only here: House ink");
  });

  it("compare case- and whitespace-insensitively, and nothing looser", () => {
    const source: ShopSourceRef = {
      id: "00000000-0000-4000-8000-000000000907",
      label: "Hand-edited casing",
      retrievedOn: "2026-08-27",
      kind: "official",
      confirms: ["  service:   custom GRIND "],
    };

    const shop = withSources([source], {
      ...bare,
      services: [{ label: "Custom grind", confirmedBy: source.id }],
    });

    expect(shopEvidenceIssues(shop)).toEqual([]);

    // A prefix is not support: "Custom grind, wet" is a different claim.
    const wider = withSources([source], {
      ...bare,
      services: [{ label: "Custom grind, wet", confirmedBy: source.id }],
    });

    expect(shopEvidenceIssues(wider).map((issue) => issue.failure)).toEqual([
      "claim-not-confirmed",
    ]);
  });
});

describe("hasSourcedValueLayer", () => {
  it("is true when the record answers what you can do there", () => {
    expect(hasSourcedValueLayer(shopValueSpecimen)).toBe(true);
  });

  it("is true on an exclusive alone — that is a reason to travel by itself", () => {
    const shop = withClaims({
      ...bare,
      exclusives: [{ label: "House ink", confirmedBy: SOURCE }],
    });

    expect(hasSourcedValueLayer(shop)).toBe(true);
  });

  it("is false when only ordinary directory fields are known", () => {
    // An address, hours and a brand list do not answer the question the section
    // exists to answer, so this is the gap state.
    expect(hasSourcedValueLayer(withClaims({ ...bare, brands: ["Sailor"] }))).toBe(false);
  });

  it("does not count an empty list as an answer", () => {
    const shop = withClaims({ services: [], experiences: [], exclusives: [] });

    expect(hasSourcedValueLayer(shop)).toBe(false);
  });
});
