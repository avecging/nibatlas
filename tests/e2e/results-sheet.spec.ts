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

  test("selecting a card keeps the sheet and map in step", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("list", { name: /shops in the searched area/i })).toBeVisible();

    const firstCard = page.getByRole("article").first();
    const name = await firstCard.getByRole("button").first().textContent();
    await firstCard.getByRole("button").first().click();

    await expect(firstCard).toHaveAttribute("data-selected", "true");
    await expect(page.getByText(`Selected: ${name}`)).toBeVisible();
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
