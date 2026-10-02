import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { stubSession } from "../support/auth";
import { DEFAULT_ABOUT } from "../../src/features/about/default-content";
import {
  aboutContent,
  type AboutState,
} from "../../src/features/about/content";
const id = "a1700000-0000-4000-8000-000000000001";
test("About rich text, private save, preview, people and explicit publication", async ({
  page,
}, testInfo) => {
  await stubSession(page, { kind: "signed-in" });
  let saved: AboutState = {
    revision: null,
    publishedRevision: null,
    publishedAt: null,
    draft: structuredClone(DEFAULT_ABOUT),
  };
  const actions: string[] = [];
  await page.route("**/api/v1/admin/about", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: saved });
    const b = route.request().postDataJSON();
    actions.push(b.action);
    if (b.action === "save")
      saved = { ...saved, revision: id, draft: aboutContent(b.document) };
    else
      saved = {
        ...saved,
        publishedRevision: saved.revision,
        publishedAt: new Date().toISOString(),
      };
    await route.fulfill({ json: saved });
  });
  await page.goto("/admin/about");
  const body = page.getByRole("textbox", { name: "Main body", exact: true });
  await expect(body).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasNotText: "Loading text editor" }),
  ).toHaveText("Private draft");
  await page.getByLabel("Page title", { exact: true }).fill("Our atlas");
  await body.fill("Places worth the journey");
  await body.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await expect(body.locator("strong")).toHaveText("Places worth the journey");
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await page.getByLabel("Link destination").fill("https://example.com/story");
  await page.getByRole("button", { name: "Apply link" }).click();
  await expect(body.locator("a")).toHaveAttribute(
    "href",
    "https://example.com/story",
  );
  await page.getByRole("button", { name: "Add team member" }).click();
  const entry = page.getByRole("group", { name: "Entry 1", exact: true });
  await entry.getByLabel("Name", { exact: true }).fill("Ada");
  const ada = page.getByRole("group", { name: "Ada", exact: true });
  await ada.getByLabel("Role or contribution").fill("Shop research");
  await ada.getByRole("button", { name: "Move to With thanks" }).click();
  await page.getByRole("button", { name: "Add thanks entry" }).click();
  await page
    .getByRole("group", { name: "Entry 2", exact: true })
    .getByLabel("Name", { exact: true })
    .fill("Bo");
  const bo = page.getByRole("group", { name: "Bo", exact: true });
  await bo.getByLabel("Role or contribution").fill("Testing");
  await bo.getByRole("button", { name: "Move up" }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.getByRole("region", { name: "Private About preview" });
  await expect(
    preview.getByRole("heading", { name: "Our atlas" }),
  ).toBeVisible();
  await expect(preview.getByRole("heading", { name: "Our team" })).toHaveCount(
    0,
  );
  await expect(
    preview.getByRole("heading", { name: "Support Nib Atlas" }),
  ).toHaveCount(0);
  expect(await preview.locator("li h3").allTextContents()).toEqual([
    "Bo",
    "Ada",
  ]);
  expect(actions).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("about-private-preview.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Back to editing" }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasNotText: "Loading text editor" }),
  ).toContainText("Draft saved privately");
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeEnabled();
  expect(saved.publishedRevision).toBeNull();
  await page.reload();
  await expect(body.locator("strong")).toHaveText("Places worth the journey");
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasNotText: "Loading text editor" }),
  ).toContainText("About published");
  expect(actions).toEqual(["save", "publish"]);
  expect(
    (
      await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("about-admin.png"),
    fullPage: true,
  });
});

test("stale save keeps edits; reloading locks controls until saved state arrives", async ({
  page,
}) => {
  await stubSession(page, { kind: "signed-in" });
  let delay = false;
  let release: (() => void) | undefined;
  await page.route("**/api/v1/admin/about", async (route) => {
    if (route.request().method() === "POST")
      return route.fulfill({
        status: 409,
        json: { error: { code: "content_changed" } },
      });
    if (delay)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    await route.fulfill({
      json: {
        revision: id,
        publishedRevision: null,
        publishedAt: null,
        draft: DEFAULT_ABOUT,
      },
    });
  });
  await page.goto("/admin/about");
  await page.getByLabel("Page title", { exact: true }).fill("Keep my typing");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Someone saved a newer version" }),
  ).toContainText("Someone saved a newer version");
  await expect(page.getByLabel("Page title", { exact: true })).toHaveValue(
    "Keep my typing",
  );
  delay = true;
  await page
    .getByRole("button", { name: "Load latest saved content (replaces edits)" })
    .click();
  await expect(page.getByLabel("Page title", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("textbox", { name: "Main body", exact: true }),
  ).toHaveAttribute("contenteditable", "false");
  await expect(
    page.getByRole("button", { name: "Save draft", exact: true }),
  ).toBeDisabled();
  await expect.poll(() => Boolean(release)).toBe(true);
  release!();
  await expect(page.getByLabel("Page title", { exact: true })).toHaveValue(
    "About Nib Atlas",
  );
  await expect(page.getByLabel("Page title", { exact: true })).toBeEnabled();
});

test("About images stay editable after reopen; people grid and social icons match preview", async ({
  page,
}, testInfo) => {
  await stubSession(page, { kind: "signed-in" });
  const imageA = "a1800000-0000-4000-8000-000000000001",
    imageB = "a1800000-0000-4000-8000-000000000002";
  const draft = structuredClone(DEFAULT_ABOUT);
  draft.people = Array.from({ length: 6 }, (_, i) => ({
    id: `a1900000-0000-4000-8000-00000000000${i}`,
    group: "team",
    name:
      i === 0
        ? "Alexandra Catherine Long Contributor Name"
        : "Contributor " + (i + 1),
    description: "Community research and local knowledge.",
    url: "https://example.com",
    linkedin: "https://www.linkedin.com/in/test",
    instagram: "https://instagram.com/test",
  }));
  let saved: AboutState = {
    revision: id,
    publishedRevision: null,
    publishedAt: null,
    draft,
  };
  let uploads = 0;
  await page.route("**/api/v1/admin/about", async (route) => {
    if (route.request().method() === "POST") {
      const b = route.request().postDataJSON();
      saved = { ...saved, draft: aboutContent(b.document), revision: id };
    }
    await route.fulfill({ json: saved });
  });
  // Real file chooser/PNG normalization/editor interaction; HTTP transport is tested separately.
  const { png } = await import("../../src/server/media/png.fixture");
  const image = png(120, 80, { opaque: true });
  await page.route("**/api/v1/admin/about/images", async (route) => {
    uploads++;
    await route.fulfill({
      status: 201,
      json: { id: uploads === 1 ? imageA : imageB, width: 120, height: 80 },
    });
  });
  await page.route("**/api/v1/admin/about/images/*", (route) =>
    route.fulfill({ contentType: "image/png", body: image }),
  );
  await page.goto("/admin/about");
  const body = page.getByRole("textbox", { name: "Main body", exact: true });
  await body.fill("A story with pictures");
  await page.getByRole("button", { name: "Bullet list", exact: true }).click();
  await body.press("End");
  await body.press("Enter");
  await page.getByRole("button", { name: "Image", exact: true }).click();
  await expect(body).toHaveAttribute("contenteditable", "false");
  await page
    .getByLabel("Image file", { exact: true })
    .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: image });
  await page
    .getByLabel("Image description (alt text)", { exact: true })
    .fill("First story image");
  await page
    .getByLabel("Caption (optional)", { exact: true })
    .fill("First caption");
  await page.getByRole("button", { name: "Insert image", exact: true }).click();
  await expect(body.locator("img")).toHaveAttribute("alt", "First story image");
  await expect(body).toHaveAttribute("contenteditable", "true");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasNotText: "Loading text editor" }),
  ).toContainText("Draft saved privately");
  await page.reload();
  await expect(body.locator("img")).toHaveAttribute(
    "src",
    `/api/v1/admin/about/images/${imageA}`,
  );
  await body.locator("img").click();
  await page.getByRole("button", { name: "Image", exact: true }).click();
  await expect(
    page.getByLabel("Caption (optional)", { exact: true }),
  ).toHaveValue("First caption");
  await expect(body).toHaveAttribute("contenteditable", "false");
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Replacement image (optional)", { exact: true })
    .setInputFiles({
      name: "replacement.png",
      mimeType: "image/png",
      buffer: image,
    });
  await page
    .getByLabel("Caption (optional)", { exact: true })
    .fill("Replacement caption");
  await page
    .getByRole("button", { name: "Apply image changes", exact: true })
    .click();
  await expect(body.locator("img")).toHaveAttribute(
    "src",
    `/api/v1/admin/about/images/${imageB}`,
  );
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.getByRole("region", { name: "Private About preview" });
  await expect(preview.locator("figcaption")).toHaveText("Replacement caption");
  expect(
    (await preview.getByRole("link").allTextContents()).every((t) => t === ""),
  ).toBe(true);
  const people = preview.locator("ul").filter({ has: page.locator("h3") });
  const first = people.locator("li").first();
  const links = await first
    .getByRole("link")
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("aria-label")));
  expect(links.map((v) => v?.split("— ")[1])).toEqual([
    "Website",
    "LinkedIn",
    "Instagram",
  ]);
  const cols = await people.evaluate(
    (n) => getComputedStyle(n).gridTemplateColumns.split(" ").length,
  );
  const width = page.viewportSize()!.width;
  expect(cols).toBe(width >= 1100 ? 3 : width >= 640 ? 2 : 1);
  expect(
    await first
      .locator("h3")
      .evaluate(
        (n) =>
          n.getBoundingClientRect().height <=
          parseFloat(getComputedStyle(n).lineHeight) * 2 + 1,
      ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("about-grid-images.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Back to editing" }).click();
  await body.locator("img").click();
  await page.getByRole("button", { name: "Image", exact: true }).click();
  await page.getByRole("button", { name: "Remove image", exact: true }).click();
  await expect(body.locator("img")).toHaveCount(0);
  // Client-side site links must not silently discard the changed document.
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "Map", exact: true }).last().click();
  await expect(page).toHaveURL(/\/admin\/about$/);
  expect(uploads).toBe(2);
});
