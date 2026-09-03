import { mkdir } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { useNormalMode, useReviewerMode } from "../support/local-state";

/**
 * Milestone 3 WP2 evidence: the API-backed map, its presentation states, and the
 * accessibility audits behind them.
 *
 * Run against an API-mode build, with the same-origin v1 routes fulfilled in the
 * browser so the states are deterministic and no staging database is involved:
 *
 * ```
 * NEXT_PUBLIC_CATALOGUE_MODE=api pnpm test:e2e --project=evidence
 * ```
 *
 * A fixture-mode build never calls those routes, so the whole file skips rather
 * than quietly capturing fixture screens and labelling them API mode.
 *
 * The three breakpoints are the ones `IMPLEMENTATION-PLAN.md` names: 360 × 800,
 * 768 × 1024, 1440 × 900. As in WP6, the tablet and desktop captures show
 * responsive integrity only; the desktop treatment itself remains unapproved and
 * nothing here is sign-off on it.
 */
const OUT_DIR = path.join(process.cwd(), "docs", "evidence", "milestone-3-wp2");

const BREAKPOINTS = [
  { name: "m", width: 360, height: 800 },
  { name: "t", width: 768, height: 1024 },
  { name: "d", width: 1440, height: 900 },
] as const;

test.skip(
  process.env.NEXT_PUBLIC_CATALOGUE_MODE !== "api",
  "Needs an API-mode build: NEXT_PUBLIC_CATALOGUE_MODE=api pnpm test:e2e --project=evidence",
);

const SOURCE_ID = "00000000-0000-4000-8000-0000000005a1";

/** Two API-shaped records, close enough together to share one Tokyo viewport. */
const API_SHOPS = [
  {
    id: "00000000-0000-4000-8000-0000000003a1",
    slug: "kingdom-note",
    name: "Kingdom Note",
    countryCode: "JP",
    localityName: "Shinjuku, Tokyo",
    position: { latitude: 35.6994, longitude: 139.7005 },
    primaryType: "vintage_used",
    specialtyLine: "Vintage pens and second-hand stock",
    operationalStatus: "open",
    markerState: "unvisited",
    sourceQuality: "sourced",
  },
  {
    id: "00000000-0000-4000-8000-0000000003a2",
    slug: "kakimori",
    name: "Kakimori",
    countryCode: "JP",
    localityName: "Kuramae, Tokyo",
    position: { latitude: 35.7053, longitude: 139.7912 },
    primaryType: "stationery_store",
    specialtyLine: null,
    operationalStatus: "open",
    markerState: "unvisited",
    sourceQuality: "sourced",
  },
] as const;

type Fulfil = Parameters<Parameters<Page["route"]>[1]>[0];

async function json(route: Fulfil, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/**
 * Serves the browser's catalogue reads.
 *
 * `truncated` is on, so the truncation notice is part of every capture: it is one
 * of the states WP2 owns and the easiest to forget.
 */
async function serveCatalogue(
  page: Page,
  options: { readonly viewport?: "ok" | "fail" | "slow" } = {},
) {
  const behaviour = options.viewport ?? "ok";

  await page.route("**/api/v1/shops/viewport**", async (route) => {
    if (behaviour === "fail") {
      await json(route, { ok: false, error: { code: "read_upstream_failed" } }, 502);
      return;
    }

    if (behaviour === "slow") {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }

    await json(route, {
      shops: API_SHOPS,
      truncated: true,
      committedBounds: { west: 139.6, south: 35.58, east: 139.85, north: 35.78 },
    });
  });

  await page.route("**/api/v1/shops/search**", async (route) => {
    await json(route, {
      query: "kaki",
      shops: [
        {
          id: API_SHOPS[1].id,
          slug: API_SHOPS[1].slug,
          name: API_SHOPS[1].name,
          countryCode: API_SHOPS[1].countryCode,
          localityName: API_SHOPS[1].localityName,
          matchedAlias: "カキモリ",
        },
      ],
    });
  });

  await page.route("**/api/v1/shops/kakimori", async (route) => {
    await json(route, {
      ...API_SHOPS[1],
      timezone: "Asia/Tokyo",
      positionPrecision: "street",
      shopTypes: ["stationery_store"],
      specialties: [],
      services: [],
      brands: [],
      links: [],
      sources: [
        {
          id: SOURCE_ID,
          label: "The shop's own site",
          kind: "official",
          retrievedOn: "2026-09-02",
          confirms: ["Address"],
        },
      ],
    });
  });
}

test.beforeAll(async () => {
  await mkdir(OUT_DIR, { recursive: true });
});

async function capture(page: Page, name: string) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), animations: "disabled" });
}

async function openMap(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("map-canvas")).toBeVisible();

  const dismiss = page.getByRole("button", { name: "Dismiss introduction" });

  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
  }
}

/** Below the desktop split the results live in a sheet, which opens at Peek. */
async function raiseSheet(page: Page): Promise<boolean> {
  const handle = page.getByRole("button", { name: /results sheet/i });

  if (!(await handle.isVisible().catch(() => false))) {
    // The desktop split has no sheet; the list is always open beside the map.
    return false;
  }

  await handle.click();
  await handle.click();
  await expect(page.getByTestId("results-sheet")).toHaveAttribute("data-state", "full");

  // The handle travels up as the sheet grows, leaving the pointer over a card.
  // A capture of a resting state should show it resting.
  await page.mouse.move(0, 0);

  return true;
}

/**
 * Commits a fresh query without a map gesture.
 *
 * Choosing a place from the search panel is a committed search, and it works the
 * same way at every breakpoint — unlike a drag, which at mobile widths would
 * land on the results sheet rather than the map.
 */
async function commitPlace(page: Page, query: string, option: RegExp) {
  await page.getByRole("combobox", { name: /search shops or places/i }).fill(query);
  await page.getByRole("option", { name: option }).first().click();
}

async function audit(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations, `${name} has accessibility violations`).toEqual([]);
}

for (const breakpoint of BREAKPOINTS) {
  test(`api-mode map results at ${breakpoint.width}x${breakpoint.height}`, async ({ page }) => {
    await page.setViewportSize(breakpoint);
    await useNormalMode(page);
    await serveCatalogue(page);
    await openMap(page);
    await raiseSheet(page);

    // The API-backed result set, with the truncation notice the payload asks for.
    await expect(page.getByRole("article", { name: "Kakimori" })).toBeVisible();
    await expect(page.getByText(/Showing the first 2 shops in this area/)).toBeVisible();
    await capture(page, `${breakpoint.name}-01-api-results`);
    await audit(page, `api-mode map at ${breakpoint.width}`);
  });

  test(`api-mode search groups at ${breakpoint.width}x${breakpoint.height}`, async ({ page }) => {
    await page.setViewportSize(breakpoint);
    await useNormalMode(page);
    await serveCatalogue(page);
    await openMap(page);

    await page.getByRole("combobox", { name: /search shops or places/i }).fill("kaki");

    // Canonical shops and places are separately labelled groups, never one list.
    await expect(page.getByRole("listbox", { name: /search results/i })).toBeVisible();
    await expect(
      page.getByRole("option").filter({ hasText: /Shop in the Nib Atlas catalogue/ }),
    ).not.toHaveCount(0);
    await capture(page, `${breakpoint.name}-02-api-search-groups`);
    await audit(page, `api-mode search panel at ${breakpoint.width}`);
  });

  test(`api-mode failed refresh keeps results at ${breakpoint.width}x${breakpoint.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(breakpoint);
    await useNormalMode(page);
    await serveCatalogue(page);
    await openMap(page);

    /*
     * The place is chosen before the sheet is raised. At mobile widths a Full
     * sheet covers the map overlay the search panel sits in, so an option click
     * would be intercepted by the sheet — the same reason WP6's captures raise
     * the sheet last.
     */
    await expect(page.getByTestId("explore")).toHaveAttribute(
      "data-explore-status",
      "idle",
    );

    // The next refresh fails. The results in hand stay usable, the failure is
    // stated, and Retry is offered for the query they are under.
    await page.unroute("**/api/v1/shops/viewport**");
    await serveCatalogue(page, { viewport: "fail" });
    await commitPlace(page, "Ginza", /^Ginza/);

    await expect(page.getByTestId("explore")).toHaveAttribute(
      "data-explore-status",
      "error",
    );

    /*
     * Retry lives in the map overlay, so it is captured with the sheet still at
     * Peek: a Full sheet covers the pane it sits in. The list side of the same
     * state — the retained results and the note explaining them — is the second
     * capture.
     */
    await expect(page.getByRole("button", { name: /search failed — retry/i })).toBeVisible();
    await capture(page, `${breakpoint.name}-03-api-failed-refresh`);
    await audit(page, `api-mode failed refresh at ${breakpoint.width}`);

    const raised = await raiseSheet(page);

    await expect(page.getByRole("article", { name: "Kakimori" })).toBeVisible();
    await expect(page.getByText(/These results are from the previous search/)).toBeVisible();

    // Only where the sheet hid the list. At desktop widths the capture above
    // already shows both halves, and a duplicate file is not evidence.
    if (raised) {
      await capture(page, `${breakpoint.name}-03b-api-failed-refresh-list`);
    }
  });

  test(`a failed detail read is unavailable at ${breakpoint.width}x${breakpoint.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(breakpoint);
    await useNormalMode(page);
    await serveCatalogue(page);

    /*
     * The shop page renders on the server, which reads the catalogue directly, so
     * browser routing cannot fulfil it. Without a staging database this is the
     * unavailable-detail state — which is the state WP2 adds and the one that must
     * never degrade into a 404 or into a fixture record.
     */
    await page.goto("/shops/kakimori");
    await expect(page.getByTestId("shop-detail-unavailable")).toBeVisible();
    await capture(page, `${breakpoint.name}-04-detail-unavailable`);
    await audit(page, `unavailable shop detail at ${breakpoint.width}`);
  });

  test(`api-mode saved scope at ${breakpoint.width}x${breakpoint.height}`, async ({ page }) => {
    await page.setViewportSize(breakpoint);
    await useReviewerMode(page);
    await serveCatalogue(page);

    await page.goto("/saved");
    await expect(page.getByTestId("saved-scope-unavailable")).toBeVisible();
    await capture(page, `${breakpoint.name}-05-saved-scope`);
    await audit(page, `api-mode saved scope at ${breakpoint.width}`);
  });
}
