import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ShopSaveButton } from "@/src/components/shops/ShopSaveButton";
import { CollectionProvider } from "@/src/features/collection/collection-store";
import { findPrototypeShop } from "@/src/fixtures/prototype-catalogue";
import { clearReviewerMode, seedReviewerMode, WithReviewerMode } from "@/src/test/reviewer";

const shop = findPrototypeShop("juspirit-banqiao")!;

/**
 * Save, after the founder's staging review of WP4.
 *
 * It is a bookmark beside the shop's name rather than a full Atlas Navy button
 * competing with Collect Stamp. What has to survive that change is the part a
 * screen-reader or a switch user depends on: a real toggle, with a name that
 * says what pressing it will do.
 */
function renderSave() {
  seedReviewerMode(false);

  render(
    <WithReviewerMode>
      <CollectionProvider>
        <ShopSaveButton shop={shop} />
      </CollectionProvider>
    </WithReviewerMode>,
  );

  return screen.getByRole("button");
}

describe("the Save bookmark", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearReviewerMode();
  });

  it("is a toggle whose accessible name changes with its state", () => {
    const button = renderSave();

    expect(button).toHaveAccessibleName("Save shop");
    expect(button).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(button);

    expect(button).toHaveAccessibleName("Remove saved shop");
    expect(button).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(button);

    expect(button).toHaveAccessibleName("Save shop");
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("carries the state without relying on colour", () => {
    const button = renderSave();

    // Outlined bookmark unsaved, filled bookmark saved: the glyph changes, not
    // only the ink. `aria-pressed` and the name are the other two cues.
    const glyph = () => button.querySelector("svg")?.getAttribute("fill");

    expect(glyph()).toBe("none");

    fireEvent.click(button);

    expect(glyph()).toBe("currentColor");
  });

  it("keeps the bookmark metaphor rather than a heart", () => {
    const button = renderSave();

    // The bookmark path from the shared icon set, not a favourite.
    expect(button.querySelector("path")?.getAttribute("d")).toContain("M6 3.8h12");
  });

  it("actually saves the shop, not just the button's own state", () => {
    const button = renderSave();

    fireEvent.click(button);

    // Read back through the store the rest of the application reads.
    render(
      <WithReviewerMode>
        <CollectionProvider>
          <ShopSaveButton shop={shop} />
        </CollectionProvider>
      </WithReviewerMode>,
    );

    for (const control of screen.getAllByRole("button")) {
      expect(control).toHaveAttribute("aria-pressed", "true");
    }
  });
});
