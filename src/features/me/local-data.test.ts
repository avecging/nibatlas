import { describe, expect, it } from "vitest";

import type { EarnedSeal } from "@/src/domain/seals";
import {
  LOCAL_DATA_SCHEMA,
  buildLocalDataExport,
  localDataFilename,
  serializeLocalDataExport,
} from "@/src/features/me/local-data";
import { prototypeSeedCollections } from "@/src/fixtures/prototype-passport";

const EXPORTED_AT = new Date("2026-08-27T09:15:00.000Z");

describe("buildLocalDataExport", () => {
  it("copies the device's own state without summarising it", () => {
    const payload = buildLocalDataExport({
      scope: "normal",
      savedShopIds: ["ty-lee-pen-shop", "aesthetic-bay"],
      collections: prototypeSeedCollections,
      seals: [],
      exportedAt: EXPORTED_AT,
    });

    expect(payload.schema).toBe(LOCAL_DATA_SCHEMA);
    expect(payload.exportedAt).toBe("2026-08-27T09:15:00.000Z");
    expect(payload.store).toBe("normal");
    expect(payload.collections).toEqual(prototypeSeedCollections);
  });

  it("sorts the saved ids, so two exports of one state are identical", () => {
    const payload = buildLocalDataExport({
      scope: "normal",
      savedShopIds: new Set(["ty-lee-pen-shop", "aesthetic-bay"]),
      collections: [],
      seals: [],
      exportedAt: EXPORTED_AT,
    });

    expect(payload.savedShopIds).toEqual(["aesthetic-bay", "ty-lee-pen-shop"]);
  });

  /*
   * The honesty property. A reviewer's file holds simulated impressions, and it
   * has to keep saying so — both on every collection and in the store it names —
   * or a file read six months from now looks like a record of real visits.
   */
  it("carries the simulated marker and names the store it came from", () => {
    const payload = buildLocalDataExport({
      scope: "reviewer",
      savedShopIds: [],
      collections: prototypeSeedCollections,
      seals: [],
      exportedAt: EXPORTED_AT,
    });

    expect(payload.store).toBe("reviewer");
    expect(payload.collections.every((collection) => collection.simulated)).toBe(true);
    expect(serializeLocalDataExport(payload)).toContain('"simulated": true');
  });

  it("keeps earned seals, which are not derivable from the collections alone", () => {
    const seal: EarnedSeal = {
      id: "seal-sg-country",
      scope: "country",
      countryCode: "SG",
      countryLabel: "Singapore",
      earnedOn: "2026-06-03",
      derivedFromShopId: "fook-hing-trading",
      coverageSetVersion: "sg-2026-08",
      stamp: prototypeSeedCollections[0]!.stamp,
    };

    const payload = buildLocalDataExport({
      scope: "normal",
      savedShopIds: [],
      collections: [],
      seals: [seal],
      exportedAt: EXPORTED_AT,
    });

    expect(payload.seals).toEqual([seal]);
  });
});

describe("serializeLocalDataExport", () => {
  it("writes readable JSON that ends in a newline", () => {
    const text = serializeLocalDataExport(
      buildLocalDataExport({
        scope: "normal",
        savedShopIds: [],
        collections: [],
        seals: [],
        exportedAt: EXPORTED_AT,
      }),
    );

    expect(text.endsWith("\n")).toBe(true);
    expect(JSON.parse(text)).toMatchObject({ schema: LOCAL_DATA_SCHEMA });
  });
});

describe("localDataFilename", () => {
  it("names the file for the day it was taken", () => {
    expect(localDataFilename(new Date("2026-08-27T09:15:00.000Z"))).toMatch(
      /^nib-atlas-data-\d{4}-\d{2}-\d{2}\.json$/u,
    );
  });
});
