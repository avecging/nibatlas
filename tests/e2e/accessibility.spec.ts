import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ROUTES = [
  { path: "/", name: "map" },
  { path: "/saved", name: "saved mode" },
  { path: "/passport", name: "passport" },
  { path: "/passport/jp/chuo-tokyo", name: "passport locality" },
  { path: "/me", name: "me" },
  { path: "/privacy", name: "privacy" },
  { path: "/shops/ginza-itoya-main-store", name: "shop detail" },
  { path: "/shops/skb-kaohsiung", name: "shop detail with omitted fields" },
  { path: "/styleguide", name: "styleguide" },
];

async function analyze(page: Page) {
  return new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // The MapLibre canvas is third-party rendering; the equivalent list is the
    // accessible representation of the same results.
    .exclude(".maplibregl-ctrl-attrib")
    .analyze();
}

for (const route of ROUTES) {
  test(`${route.name} has no detectable accessibility violations`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.getByRole("heading", { includeHidden: true }).first()).toBeAttached();

    const results = await analyze(page);

    expect(
      results.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`),
    ).toEqual([]);
  });
}

test("the collection dialogs are accessible", async ({ page }) => {
  await page.goto("/shops/juspirit-banqiao");
  await page.getByRole("button", { name: /collect stamp \(simulated\)/i }).click();
  await expect(page.getByRole("dialog", { name: /before you collect/i })).toBeVisible();

  expect((await analyze(page)).violations).toEqual([]);

  await page.getByRole("button", { name: /simulate: i am at this shop/i }).click();
  await expect(page.getByRole("dialog", { name: /impression collected/i })).toBeVisible();

  expect((await analyze(page)).violations).toEqual([]);
});

test("the collection preflight traps focus and gives it back", async ({ page }) => {
  await page.goto("/shops/nagasawa-penstyle-den");

  const trigger = page.getByRole("button", { name: /collect stamp \(simulated\)/i });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: /before you collect/i });
  await expect(dialog).toBeFocused();

  // Tabbing repeatedly can never leave the dialog.
  for (let press = 0; press < 6; press += 1) {
    await page.keyboard.press("Tab");
    await expect(dialog).toContainText("Before you collect");
    expect(
      await page.evaluate(() => {
        const active = document.activeElement;
        return active?.closest('[role="dialog"]') !== null;
      }),
    ).toBe(true);
  }

  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(
      () => document.activeElement?.closest('[role="dialog"]') !== null,
    ),
  ).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("the stamp ceremony returns focus to the shop page", async ({ page }) => {
  await page.goto("/shops/ty-lee-pen-shop");

  const trigger = page.getByRole("button", { name: /collect stamp \(simulated\)/i });
  await trigger.click();
  await page.getByRole("button", { name: /simulate: i am at this shop/i }).click();

  const ceremony = page.getByRole("dialog", { name: /impression collected/i });
  await expect(ceremony).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(ceremony).toHaveCount(0);
  await expect(page.getByRole("button", { name: /view atlas stamp/i })).toBeFocused();
});

test("the Passport book is reachable and operable from the keyboard", async ({ page }) => {
  await page.goto("/passport");

  const openButton = page.getByRole("button", { name: /open passport/i });
  await openButton.focus();
  await expect(openButton).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("button", { name: /previous page/i })).toBeVisible();
  expect((await analyze(page)).violations).toEqual([]);
});

test("every control meets the minimum touch target size", async ({ page }) => {
  await page.goto("/shops/ginza-itoya-main-store");

  const undersized = await page.evaluate(() => {
    const failures: string[] = [];

    for (const element of document.querySelectorAll("button, a[href]")) {
      const rect = element.getBoundingClientRect();

      // Links that sit inside a paragraph are inline prose links, which WCAG
      // exempts from the target-size minimum. Standalone controls are not.
      if (rect.width === 0 || element.closest("p") !== null) {
        continue;
      }

      if (rect.height < 44) {
        failures.push(`${element.tagName}: ${element.textContent?.trim().slice(0, 40)}`);
      }
    }

    return failures;
  });

  expect(undersized).toEqual([]);
});
