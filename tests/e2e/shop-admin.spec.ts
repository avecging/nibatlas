import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { stubSession } from "../support/auth";
import {
  document,
  type ShopRecord,
} from "../../src/features/admin/shop-contract";
const id = "61000000-0000-4000-8000-000000000001",
  source = "61000000-0000-4000-8000-000000000002",
  locality = "61000000-0000-4000-8000-000000000003",
  type = "61000000-0000-4000-8000-000000000004";
function fixture(): ShopRecord {
  return {
    id,
    revision: "a".repeat(32),
    publicationStatus: "draft",
    hasChanges: false,
    publicationErrors: [],
    document: document({
      shop: {
        name: "M6 Demo shop",
        slug: "m6-demo-shop",
        source_quality: "demo",
        operational_status: "unknown",
        position_precision: "street",
        country_code: "SG",
        locality_id: locality,
        timezone: "Asia/Singapore",
        latitude: 1.3,
        longitude: 103.8,
        postal_code: "012345",
        last_verified_at: "2026-09-01T00:00:00Z",
        phone: "+65 0000 0000",
      },
      sources: [
        {
          id: source,
          label: "Explicit demo source",
          source_type: "demo_fixture",
          checked_at: "2026-09-01T00:00:00Z",
          reliability: "unknown",
          status: "active",
          claims: ["Name"],
          evidence_note: "Private internal note",
        },
      ],
      types: [{ shop_type_id: type, is_primary: true, source_id: source }],
      aliases: [],
      links: [],
      services: [],
      specialties: [],
      brands: [],
    }),
  };
}
async function setup(page: Page) {
  await stubSession(page, { kind: "signed-in" });
  let record = fixture();
  let oldDocument = structuredClone(record.document);
  const actions: string[] = [];
  let conflict = false;
  await page.route("**/api/v1/admin/shops**", async (route) => {
    const url = new URL(route.request().url());
    let body: unknown,
      status = 200;
    if (url.pathname.endsWith("/options"))
      body = {
        localities: [
          { id: locality, label: "Singapore (SG)", countryCode: "SG" },
        ],
        types: [{ id: type, label: "Fountain Pen Specialist" }],
        services: [],
        specialties: [],
        brands: [],
      };
    else if (route.request().method() === "POST") {
      const request = route.request().postDataJSON();
      actions.push(request.action);
      if (conflict) {
        status = 409;
        body = { error: { code: "revision_conflict" } };
      } else {
        if (request.action === "create") {
          record = {
            ...fixture(),
            id: request.id,
            document: document({
              ...fixture().document,
              shop: { ...fixture().document.shop, ...request.document },
            }),
          };
        }
        if (request.action === "save") {
          record.document = request.document;
          record.hasChanges = true;
        }
        if (request.action === "publish") {
          record.publicationStatus = "published";
          record.hasChanges = false;
          oldDocument = structuredClone(record.document);
        }
        if (request.action === "discard") {
          record.document = oldDocument;
          record.hasChanges = false;
        }
        if (request.action === "archive") record.publicationStatus = "archived";
        if (
          [
            "temporarily_closed",
            "permanently_closed",
            "open",
            "unknown",
          ].includes(request.action)
        )
          record.document.shop.operational_status = request.action;
        record.revision =
          record.revision === "b".repeat(32) ? "c".repeat(32) : "b".repeat(32);
        body = record;
      }
    } else if (url.pathname.endsWith("/shops"))
      body = {
        entries: [
          {
            id: record.id,
            name: record.document.shop.name,
            slug: record.document.shop.slug,
            publicationStatus: record.publicationStatus,
            operationalStatus: record.document.shop.operational_status,
            hasChanges: record.hasChanges,
          },
        ],
        nextCursor: null,
      };
    else body = record;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
      headers: { "Cache-Control": "private, no-store" },
    });
  });
  return {
    actions,
    conflict: () => {
      conflict = true;
    },
  };
}
test("founder edits, previews, publishes, closes and archives @short", async ({
  page,
}, info) => {
  const state = await setup(page);
  await page.goto(`/admin/shops/${id}`);
  await expect(page.getByLabel("Shop name")).toHaveValue("M6 Demo shop");
  await page.getByLabel("Shop name").fill("M6 Revised demo shop");
  await expect(
    page.getByRole("button", { name: "Preview saved version", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Save changes privately" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Changes saved privately",
  );
  await page
    .getByRole("button", { name: "Preview saved version", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "M6 Revised demo shop" }),
  ).toBeVisible();
  await expect(page.getByText("Private internal note")).toHaveCount(0);
  await expect(page.getByText("012345", { exact: true })).toHaveCount(0);
  await expect(page.getByText("+65 0000 0000", { exact: true })).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath(`admin-preview-${info.project.name}.png`),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Publish saved version", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm publish", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Shop published.");
  for (const action of ["temporarily closed", "open", "permanently closed"]) {
    await page
      .getByRole("button", { name: `Mark ${action}`, exact: true })
      .click();
    await page
      .getByRole("button", { name: `Confirm ${action}`, exact: true })
      .click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Operational status updated",
    );
  }
  await page.getByRole("button", { name: "Archive shop", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm archive", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Shop archived");
  await expect(page.getByLabel("Shop name")).toBeDisabled();
  expect(state.actions).toEqual([
    "save",
    "publish",
    "temporarily_closed",
    "open",
    "permanently_closed",
    "archive",
  ]);
});
test("draft editor is accessible and preserves unknown information @short", async ({
  page,
}, info) => {
  await setup(page);
  await page.goto(`/admin/shops/${id}`);
  await expect(page.getByLabel("Shop name")).toBeVisible();
  await expect(page.getByLabel("Appointment required")).toHaveValue("");
  for (const label of ["Sources (1)", "Shop types (1)", "Opening hours"])
    await page.getByText(label, { exact: true }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  const sizes = await page.evaluate(() => ({
    width: globalThis.document.documentElement.clientWidth,
    scroll: globalThis.document.documentElement.scrollWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width);
  for (const control of await page
    .locator(
      "main button:visible,main input:visible,main select:visible,main summary:visible",
    )
    .all()) {
    const b = await control.boundingBox();
    expect(b?.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByLabel("Shop name").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("URL name")).toBeFocused();
  await page.screenshot({
    path: info.outputPath(`admin-editor-${info.project.name}.png`),
    fullPage: true,
  });
});
test("create flow and revision conflict preserve the unsaved work", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/admin/shops");
  await page.getByText("Create a draft shop", { exact: true }).click();
  await page.getByLabel("Shop name").fill("Another demo");
  await page.getByLabel("URL name").fill("another-demo");
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await expect(page.getByLabel("Shop name")).toHaveValue("Another demo");
  state.conflict();
  await page.getByLabel("Shop name").fill("Uncommitted demo");
  await page.getByRole("button", { name: "Save changes privately" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "changed in another session",
  );
  await expect(page.getByLabel("Shop name")).toHaveValue("Uncommitted demo");
});
test("denied and signed-out visitors see no editor data", async ({ page }) => {
  await stubSession(page, { kind: "signed-in" });
  await page.route("**/api/v1/admin/shops**", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "forbidden" } }),
    }),
  );
  await page.goto(`/admin/shops/${id}`);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "does not have catalogue access",
  );
  await expect(page.getByLabel("Shop name")).toHaveCount(0);
  await stubSession(page, { kind: "signed-out" });
  await page.reload();
  await expect(
    page.getByText(
      "Sign in with your founder or editor account, then return here.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Shop name")).toHaveCount(0);
});
