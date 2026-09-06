import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ShopSaveButton } from "@/src/components/shops/ShopSaveButton";
import {
  COLLECTION_STORAGE_KEYS,
  CollectionProvider,
} from "@/src/features/collection/collection-store";
import { SavedShopsProvider } from "@/src/features/saved/SavedShopsProvider";
import { findPrototypeShop } from "@/src/fixtures/prototype-catalogue";
import { installAuthFetch, WithAccount } from "@/src/test/auth";
import { clearReviewerMode, seedReviewerMode } from "@/src/test/reviewer";

const prototypeShop = findPrototypeShop("juspirit-banqiao")!;
const shop = {
  ...prototypeShop,
  // Signed-in catalogue responses use canonical database UUIDs. Prototype-only
  // identifiers exercise local mode and must not weaken the account API contract.
  id: "7ab629ba-80da-4f88-a5cf-26bfeff20f7c",
};
const savedShop = {
  id: shop.id,
  slug: shop.slug,
  name: shop.name,
  ...(shop.localName === undefined ? {} : { localName: shop.localName }),
  ...(shop.localNameLang === undefined
    ? {}
    : { localNameLang: shop.localNameLang }),
  countryCode: shop.countryCode,
  localityName: shop.localityName,
  position: shop.position,
  primaryType: shop.primaryType,
  specialtyLine: shop.specialtyLine,
  operationalStatus: shop.operationalStatus,
  markerState: "saved" as const,
  sourceQuality: shop.sourceQuality,
  savedAt: "2026-09-06T04:30:00+00:00",
};

function renderSave() {
  seedReviewerMode(false);

  render(
    <WithAccount>
      <CollectionProvider>
        <SavedShopsProvider>
          <ShopSaveButton shop={shop} />
        </SavedShopsProvider>
      </CollectionProvider>
    </WithAccount>,
  );

  return screen.getByRole("button", { name: "Save shop" });
}

describe("the Save bookmark", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearReviewerMode();
  });

  it("opens the existing sign-in interruption for a new anonymous save", async () => {
    installAuthFetch({ session: { kind: "signed-out" } });
    const button = renderSave();

    expect(button).toHaveAttribute("aria-pressed", "false");
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    const dialog = await screen.findByRole("dialog", {
      name: /sign in to nib atlas/i,
    });

    expect(dialog).toHaveTextContent(`Save ${shop.name}`);
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("optimistically saves, then keeps the server-reconciled state", async () => {
    const { requests } = installAuthFetch({
      session: { kind: "signed-in" },
      savedShops: { body: { savedShopIds: [], shops: [] } },
      savedMutation: {
        body: { ok: true, shopId: shop.id, saved: true, shop: savedShop },
      },
    });
    const button = renderSave();

    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    expect(button).toHaveAccessibleName("Saving shop");
    expect(button).toHaveAttribute("aria-pressed", "true");

    await waitFor(() => {
      expect(button).toHaveAccessibleName("Remove saved shop");
      expect(button).toBeEnabled();
    });
    expect(
      requests.some(
        (request) =>
          request.url.endsWith(`/api/v1/saved-shops/${shop.id}`) &&
          request.method === "PUT",
      ),
    ).toBe(true);
  });

  it("reconciles a deferred Save exactly once after the session resolves", async () => {
    const { requests } = installAuthFetch({
      session: { kind: "signed-in" },
      savedShops: { body: { savedShopIds: [], shops: [] } },
      pendingSave: {
        status: 200,
        body: { ok: true, shopId: shop.id, saved: true, shop: savedShop },
      },
    });
    renderSave();

    await expect(
      screen.findByRole("button", { name: "Remove saved shop" }),
    ).resolves.toBeVisible();
    expect(
      requests.filter(
        (request) =>
          request.url.endsWith("/api/v1/saved-shops/pending") &&
          request.method === "POST",
      ),
    ).toHaveLength(1);
  });

  it("refreshes an expired session once and retries the deferred Save", async () => {
    const { requests } = installAuthFetch({
      session: { kind: "signed-in" },
      savedShops: { body: { savedShopIds: [], shops: [] } },
      pendingSaves: [
        {
          status: 401,
          body: { ok: false, error: { code: "authentication_required" } },
        },
        {
          status: 200,
          body: { ok: true, shopId: shop.id, saved: true, shop: savedShop },
        },
      ],
    });
    renderSave();

    await expect(
      screen.findByRole("button", { name: "Remove saved shop" }),
    ).resolves.toBeVisible();
    expect(
      requests.filter((request) =>
        request.url.endsWith("/api/v1/saved-shops/pending"),
      ),
    ).toHaveLength(2);
    expect(
      requests.filter((request) =>
        request.url.includes("/api/v1/auth/session"),
      ),
    ).toHaveLength(2);
  });


  it("imports safe device saves and retains only transient failures for retry", async () => {
    const failedId = "00000000-0000-4000-8000-000000000399";
    window.localStorage.setItem(
      COLLECTION_STORAGE_KEYS.normal,
      JSON.stringify({
        savedShopIds: [prototypeShop.id, "obsolete-record", failedId],
        collections: [],
        seals: [],
      }),
    );
    const { requests } = installAuthFetch({
      session: { kind: "signed-in" },
      savedShops: { body: { savedShopIds: [], shops: [] } },
      savedImport: {
        body: {
          ok: true,
          reconciled: [{ localId: prototypeShop.id, shop: savedShop }],
          skipped: [{ localId: "obsolete-record", reason: "invalid-id" }],
          failed: [{ localId: failedId, reason: "unavailable" }],
        },
      },
    });

    renderSave();

    const notice = await screen.findByRole("status", {
      name: "Saved shop import",
    });

    expect(notice).toHaveTextContent("1 device save is now kept with your account.");
    expect(notice).toHaveTextContent("1 unmatched record was removed from this device.");
    expect(notice).toHaveTextContent("1 save remains on this device for retry.");
    expect(screen.getByRole("button", { name: "Remove saved shop" })).toBeVisible();

    await waitFor(() => {
      const stored = JSON.parse(
        window.localStorage.getItem(COLLECTION_STORAGE_KEYS.normal) ?? "{}",
      ) as { savedShopIds?: string[] };

      expect(stored.savedShopIds).toEqual([failedId]);
    });

    const importRequest = requests.find((request) =>
      request.url.endsWith("/api/v1/saved-shops/import"),
    );
    expect(importRequest?.body).toEqual({
      candidates: [
        { localId: failedId },
        { localId: "obsolete-record" },
        { localId: prototypeShop.id, slug: prototypeShop.slug },
      ],
    });
  });

  it("carries state in the glyph, pressed state and accessible name", async () => {
    installAuthFetch({
      session: { kind: "signed-in" },
      savedShops: {
        body: { savedShopIds: [shop.id], shops: [savedShop] },
      },
    });
    renderSave();

    const button = await screen.findByRole("button", {
      name: "Remove saved shop",
    });

    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button.querySelector("svg")?.getAttribute("fill")).toBe("currentColor");
  });

  it("keeps the bookmark metaphor rather than a heart", () => {
    installAuthFetch({ session: { kind: "signed-out" } });
    const button = renderSave();

    expect(button.querySelector("path")?.getAttribute("d")).toContain("M6 3.8h12");
  });
});
