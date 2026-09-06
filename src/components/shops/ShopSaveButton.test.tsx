import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ShopSaveButton } from "@/src/components/shops/ShopSaveButton";
import { CollectionProvider } from "@/src/features/collection/collection-store";
import { SavedShopsProvider } from "@/src/features/saved/SavedShopsProvider";
import { findPrototypeShop } from "@/src/fixtures/prototype-catalogue";
import { installAuthFetch, WithAccount } from "@/src/test/auth";
import { clearReviewerMode, seedReviewerMode } from "@/src/test/reviewer";

const shop = findPrototypeShop("juspirit-banqiao")!;
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
  ...(shop.fixtureNotice === undefined
    ? {}
    : { fixtureNotice: shop.fixtureNotice }),
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
