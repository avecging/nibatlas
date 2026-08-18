import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ROUTES = [
  { path: "/", name: "map" },
  { path: "/discover", name: "discover" },
  { path: "/saved", name: "saved" },
  { path: "/passport", name: "passport" },
  { path: "/passport/jp/chuo-tokyo", name: "passport locality" },
  { path: "/shops/demo-ginza-fountain-pen-salon", name: "shop detail" },
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
    await expect(page.getByRole("heading").first()).toBeVisible();

    const results = await analyze(page);

    expect(
      results.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`),
    ).toEqual([]);
  });
}

test("the collection dialogs are accessible", async ({ page }) => {
  await page.goto("/shops/demo-kobe-portside-nib-bench");
  await page.getByRole("button", { name: /collect stamp \(simulated\)/i }).click();
  await expect(page.getByRole("dialog", { name: /before you collect/i })).toBeVisible();

  expect((await analyze(page)).violations).toEqual([]);

  await page.getByRole("button", { name: /simulate: i am at this shop/i }).click();
  await expect(page.getByRole("dialog", { name: /impression collected/i })).toBeVisible();

  expect((await analyze(page)).violations).toEqual([]);
});

test("every control meets the minimum touch target size", async ({ page }) => {
  await page.goto("/shops/demo-ginza-fountain-pen-salon");

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
