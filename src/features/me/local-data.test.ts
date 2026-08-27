import { describe, expect, it, vi } from "vitest";

import type { EarnedSeal } from "@/src/domain/seals";
import {
  LOCAL_DATA_SCHEMA,
  buildLocalDataExport,
  exportLocalData,
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

describe("exportLocalData", () => {
  const seeded = {
    scope: "normal",
    savedShopIds: ["ty-lee-pen-shop"],
    collections: prototypeSeedCollections,
    seals: [],
    exportedAt: EXPORTED_AT,
  } as const;

  /*
   * The window this guard exists for: the collection store reads `localStorage`
   * in an effect, so between the first paint and that effect a returning
   * reader's store is the empty baseline. An export taken then would hand them
   * an empty file that looks exactly like a successful export of nothing.
   */
  it("refuses to export before the device's state has been read", () => {
    const created = vi.spyOn(URL, "createObjectURL");

    expect(exportLocalData({ ...seeded, hydrated: false })).toBe("not-ready");
    expect(created).not.toHaveBeenCalled();

    created.mockRestore();
  });

  it("exports the real collection once it has", async () => {
    let handed: Blob | null = null;
    const created = vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      // Captured through the Blob so the assertion is about what the reader
      // actually receives, not about what was passed to the builder.
      handed = blob as Blob;
      return "blob:nib-atlas";
    });
    const revoked = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clicked = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    expect(exportLocalData({ ...seeded, hydrated: true })).toBe("ok");
    expect(created).toHaveBeenCalledOnce();

    const payload = JSON.parse(await (handed as unknown as Blob).text());

    expect(payload.collections).toHaveLength(prototypeSeedCollections.length);
    expect(payload.savedShopIds).toEqual(["ty-lee-pen-shop"]);

    created.mockRestore();
    revoked.mockRestore();
    clicked.mockRestore();
  });

  it("reports a browser that refuses the object URL", () => {
    const created = vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(exportLocalData({ ...seeded, hydrated: true })).toBe("blocked");

    created.mockRestore();
  });
});
