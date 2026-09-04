import { expect, test, type Page } from "@playwright/test";

async function openMap(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("map-canvas")).toBeVisible();

  const dismiss = page.getByRole("button", { name: "Dismiss introduction" });
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();

  await expect(page.getByTestId("explore")).toHaveAttribute("data-explore-status", "idle");
}

test("API marker to card to detail to Back preserves the selected shop", async ({ page }) => {
  await openMap(page);

  const marker = page.getByRole("button", { name: /^M3 API Demo Shop, Tokyo\./ });
  await marker.click();

  const card = page.getByRole("article", { name: "M3 API Demo Shop" });
  await expect(card).toHaveAttribute("data-selected", "true");

  await card.getByRole("link", { name: "M3 API Demo Shop" }).click();
  await expect(page).toHaveURL(/\/shops\/m3-api-demo-shop\?from=map$/);
  await expect(page.getByRole("heading", { level: 1, name: "M3 API Demo Shop" })).toBeVisible();
  await expect(page.getByText(/demo fixture evidence/i)).toBeVisible();

  await page.getByRole("link", { name: "Back to map" }).click();
  await expect(page).toHaveURL(/\?shop=m3-api-demo-shop$/);
  await expect(page.getByRole("article", { name: "M3 API Demo Shop" })).toHaveAttribute(
    "data-selected",
    "true",
  );
});

test("a failed API refresh keeps old results and Retry recovers", async ({ page }) => {
  await openMap(page);
  await expect(page.getByRole("article", { name: "M3 API Demo Shop" })).toBeVisible();

  let failViewport = true;
  await page.route("**/api/v1/shops/viewport**", async (route) => {
    if (failViewport) {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: { code: "read_upstream_failed" } }),
      });
      return;
    }

    await route.continue();
  });

  await page.getByRole("combobox", { name: /search shops or places/i }).fill("Ginza");
  await page.getByRole("option").filter({ hasText: /^Ginza.*Place ·/ }).click();

  await expect(page.getByTestId("explore")).toHaveAttribute("data-explore-status", "error");
  await expect(page.getByRole("article", { name: "M3 API Demo Shop" })).toBeVisible();
  await expect(page.getByText(/results are from the previous search/i)).toBeVisible();

  failViewport = false;
  await page.getByRole("button", { name: /search failed — retry/i }).click();
  await expect(page.getByTestId("explore")).toHaveAttribute("data-explore-status", "idle");
  await expect(page.getByRole("article", { name: "M3 API Demo Shop" })).toBeVisible();
});

test("canonical shops and places remain separately named result groups", async ({ page }) => {
  await openMap(page);
  await page.getByRole("combobox", { name: /search shops or places/i }).fill("Tokyo");

  const listbox = page.getByRole("listbox", { name: /search results/i });
  await expect(listbox.getByRole("group", { name: "Places" })).toBeVisible();
  await expect(listbox.getByRole("group", { name: "Shops" })).toBeVisible();
  await expect(listbox.getByRole("option").filter({ hasText: /Place ·/ }).first()).toBeVisible();
  await expect(
    listbox.getByRole("option").filter({ hasText: /Shop in the Nib Atlas catalogue/ }),
  ).toBeVisible();
});
