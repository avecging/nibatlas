import { expect, test } from "@playwright/test";

test.describe("mobile results sheet", () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) >= 1024,
    "The sheet is replaced by the desktop map/list split at 1024 px.",
  );

  test("moves between Peek, Half, and Full without fighting the map", async ({ page }) => {
    await page.goto("/");

    const sheet = page.getByTestId("results-sheet");
    await expect(sheet).toHaveAttribute("data-state", "peek");

    const handle = page.getByRole("button", { name: /results sheet/i });
    await handle.click();
    await expect(sheet).toHaveAttribute("data-state", "half");

    await handle.click();
    await expect(sheet).toHaveAttribute("data-state", "full");

    await handle.click();
    await expect(sheet).toHaveAttribute("data-state", "half");
  });

  test("keeps the list reachable from the keyboard", async ({ page }) => {
    await page.goto("/");

    const handle = page.getByRole("button", { name: /results sheet/i });
    await handle.focus();
    await page.keyboard.press("ArrowUp");

    await expect(page.getByTestId("results-sheet")).toHaveAttribute("data-state", "half");
  });

  /*
   * Selection now comes from the map, not from the card: a card tap opens the
   * shop. The sheet must still name the selected shop and scroll to its card.
   */
  /*
   * Selection now comes from the map, not from the card: activating a card
   * opens the shop. The sheet must still name the selected shop and scroll to
   * its card, whether the selection came from a marker or from a return to the
   * map that carried one.
   */
  test("selecting a marker keeps the sheet and map in step", async ({ page }) => {
    await page.goto("/?shop=ginza-itoya-main-store");
    await expect(page.getByRole("list", { name: /shops in the searched area/i })).toBeVisible();

    const card = page.getByRole("article", { name: "Ginza Itoya Main Store" });
    await expect(card).toHaveAttribute("data-selected", "true");
    await expect(page.getByText("Selected: Ginza Itoya Main Store")).toBeVisible();

    const marker = page
      .getByRole("button", { name: /^Ginza Itoya Main Store, Chūō, Tokyo\./ })
      .first();
    await expect(marker).toHaveAttribute("aria-pressed", "true");
  });

  test("dragging the handle resizes the sheet without panning the map", async ({ page }) => {
    await page.goto("/");

    const sheet = page.getByTestId("results-sheet");
    await expect(sheet).toHaveAttribute("data-state", "peek");

    const explore = page.getByTestId("explore");
    await expect(explore).toHaveAttribute("data-search-offer", "hidden");

    const handle = page.getByRole("button", { name: /results sheet/i });
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let step = 1; step <= 12; step += 1) {
      await page.mouse.move(startX, startY - (240 * step) / 12);
    }
    await page.mouse.up();

    await expect(sheet).toHaveAttribute("data-state", "half");
    // The gesture never reached the map, so no new search is on offer.
    await expect(explore).toHaveAttribute("data-search-offer", "hidden");
  });

  test("peek shows the count and the first card, not clipped filters", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("results-sheet")).toHaveAttribute("data-state", "peek");
    await expect(page.getByText(/shops in this area/i)).toBeVisible();
    await expect(page.getByRole("group", { name: /visit status/i })).toHaveCount(0);

    await page.getByRole("button", { name: /results sheet/i }).click();
    await expect(page.getByRole("group", { name: /visit status/i })).toBeVisible();
  });
});
