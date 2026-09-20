import { expect, test, type Page } from "@playwright/test";

test("live detail and correction pages render without static output caching", async ({ request }) => {
  for (const suffix of ["", "/report"]) {
    const response = await request.get(`/shops/m3-api-demo-shop${suffix}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.text()).toContain("M3 API Demo Shop");
    const missing = await request.get(`/shops/unpublished-unknown-shop${suffix}`);
    expect(missing.status()).toBe(404);
  }
});

/**
 * Published editorial, through the real read path rather than a fixture object.
 *
 * `scripts/api-e2e-upstream.mjs` gives the demo shop — an invented record,
 * labelled `demo` and carrying its own fixture notice — the editorial an editor
 * would have typed. It is the only place the API-shaped editorial contract is
 * exercised end to end, so fixture-mode coverage cannot conceal a broken
 * decoder, projection or render path.
 */
test("published editorial reaches the shop page through the v1 contract", async ({ page }) => {
  await page.goto("/shops/m3-api-demo-shop");

  await expect(page.getByRole("heading", { name: "Worth slowing down for." })).toBeVisible();
  await expect(page.getByText(/This is specimen editorial for an invented shop/)).toBeVisible();
  // Paragraph breaks survive publication.
  await expect(page.getByText(/A second paragraph, so paragraph breaks/)).toBeVisible();

  const experiences = page.getByRole("heading", { name: "What you can do here" });
  await expect(experiences).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nib testing" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Store editions" })).toBeVisible();

  /*
   * One station row, joined from the three published editorial fields.
   *
   * Not a test of the two-generation precedence: `shop-detail-projection.ts`
   * carries no `access` or `practical` block from the wire, so an API record
   * has no sourced counterpart to prefer against. That reconciliation is
   * covered in `src/features/shops/shop-visit-facts.test.ts`.
   */
  const plan = page.getByRole("region", { name: "Plan your visit" });
  await expect(plan.getByText("Demo Station · Exit 1 · 3 minutes on foot")).toBeVisible();
  await expect(plan.getByText("Nearest station")).toHaveCount(1);

  // Unknown and false stay different: a published "no" is shown as a "no".
  await expect(plan.getByText("No appointment is needed.")).toBeVisible();

  // Brands reach the page rather than being overwritten by an empty default.
  const brands = page.getByRole("list", { name: "Brands" });
  await expect(brands.getByText("Demo Brand A")).toBeVisible();
  await expect(brands.getByRole("listitem")).toHaveCount(3);
});

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
