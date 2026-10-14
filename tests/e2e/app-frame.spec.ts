import { expect, test, type Page } from "@playwright/test";

import {
  seedPassportView,
  seedSampleCollection,
  useNormalMode,
} from "../support/local-state";

/**
 * The application frame.
 *
 * WP5's viewport correction: Shop and Passport have to be surfaces in the same
 * application when they are opened on the same device, and the Passport's own
 * navigation has to be reachable from the initial usable viewport without a
 * content scroll.
 *
 * Three defects made that untrue, and all three are regression-tested here.
 *
 * 1. **Every full-height surface computed the available height itself.** The map
 *    subtracted `--nav-height` — a token that does not include the navigation's
 *    1 px top border — so the map document was permanently a pixel taller than
 *    the viewport, and subtracted a hard-coded `3.5rem` at desktop. The
 *    Passport's book asked for `height: 100%` from an ancestor whose height was
 *    only a *minimum*, so it silently took its own intrinsic height instead.
 * 2. **The shell's rows were auto-placed.** The map hides the header with
 *    `display: none`, which takes it out of the grid, so every remaining child
 *    moved up a row and the section navigation, not the screen, took the `1fr`.
 * 3. **A specimen with a wide minimum widened the styleguide document** to 614 px
 *    at a 360 px viewport, and a mobile browser answered by zooming the whole
 *    page out — literally a different effective viewport from every other screen.
 *
 * The 360 x 800 project is the one these run under by default; the reduced-height
 * cases are tagged `@short` and the `mobile-360x568` project runs those.
 */
const ROUTES = [
  { name: "map", path: "/" },
  { name: "shop", path: "/shops/ginza-itoya-main-store" },
  { name: "passport", path: "/passport" },
  { name: "passport country", path: "/passport/jp" },
  { name: "passport locality", path: "/passport/jp/chuo-tokyo" },
  { name: "me", path: "/me" },
  { name: "privacy", path: "/privacy" },
  { name: "styleguide", path: "/styleguide" },
] as const;

/** What the document and the viewport agree on, if anything. */
async function frame(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;

    return {
      innerWidth: window.innerWidth,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      innerHeight: window.innerHeight,
      clientHeight: root.clientHeight,
      scrollHeight: root.scrollHeight,
    };
  });
}

/** Every element that sticks out sideways past a clipping ancestor. */
async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const found: string[] = [];

    for (const node of document.querySelectorAll("body *")) {
      const box = node.getBoundingClientRect();

      if (box.width === 0 || (box.right <= limit + 0.5 && box.left >= -0.5)) {
        continue;
      }

      // An element clipped by an ancestor is drawn inside the page even though
      // its box is not: the identity plate's motif watermark and the Passport
      // cover both hang deliberately outside their own frame.
      let parent = node.parentElement;
      let clipped = false;

      while (parent) {
        if (getComputedStyle(parent).overflowX !== "visible") {
          clipped = true;
          break;
        }

        parent = parent.parentElement;
      }

      if (!clipped) {
        found.push(`${node.tagName}.${String(node.className).slice(0, 40)}`);
      }
    }

    return found;
  });
}

async function settle(page: Page, path: string) {
  await page.goto(path);

  if (path.startsWith("/passport")) {
    await expect(page.getByRole("group", { name: "Passport view" })).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { includeHidden: true }).first()).toBeAttached();
  }

  // One frame for layout to settle after hydration resolves device state.
  await page.waitForTimeout(250);
}

test.describe("one frame for every surface", () => {
  test.beforeEach(async ({ page }) => {
    await useNormalMode(page);
    await seedSampleCollection(page);
  });

  for (const route of ROUTES) {
    test(`${route.name} is never wider than the viewport`, async ({ page }) => {
      await settle(page, route.path);

      const measured = await frame(page);

      // The document does not scroll sideways...
      expect(measured.scrollWidth).toBe(measured.clientWidth);
      // ...and the browser has not answered an overflow by zooming the page out,
      // which is what makes one screen's effective viewport differ from the next.
      expect(measured.innerWidth).toBe(measured.clientWidth);
      expect(await horizontalOverflow(page)).toEqual([]);
    });
  }

  test("the map and the Passport's book fill the frame without scrolling it", async ({
    page,
  }) => {
    await settle(page, "/");

    const map = await frame(page);
    expect(map.scrollHeight).toBe(map.clientHeight);

    await seedPassportView(page, { mode: "book", coverSeen: true });
    await settle(page, "/passport");

    const book = await frame(page);
    expect(book.scrollHeight).toBe(book.clientHeight);
  });

  test("Shop and Passport put their reading column in the same band", async ({
    page,
    viewport,
  }) => {
    test.skip(
      (viewport?.width ?? 0) >= 1024,
      "Desktop widths give the two surfaces different measures on purpose, and the desktop treatment is WP-D's.",
    );

    /*
     * Where the text actually starts and stops, not where a wrapper's border box
     * happens to be: a content route takes its gutter from the shell's `main`
     * and the Passport's List takes it from its own document, so comparing the
     * elements would compare two different things. The reader sees one number.
     */
    const band = (selector: string) =>
      page.evaluate((sel) => {
        const node = document.querySelector(sel);

        if (!node) {
          return null;
        }

        const style = getComputedStyle(node);
        const box = node.getBoundingClientRect();

        return {
          left: Math.round(box.left + Number.parseFloat(style.paddingLeft)),
          right: Math.round(box.right - Number.parseFloat(style.paddingRight)),
        };
      }, selector);

    await settle(page, "/shops/ginza-itoya-main-store");
    const shop = await band("#main-content");

    await settle(page, "/passport");
    const passport = await band('[data-passport-list="all"]');

    expect(shop).not.toBeNull();
    expect(passport).not.toBeNull();
    expect(passport).toEqual(shop);
  });

  test("the section navigation is reachable from the initial viewport everywhere", async ({
    page,
  }) => {
    for (const route of ROUTES) {
      await settle(page, route.path);

      /*
       * Whichever navigation this width actually renders.
       *
       * Below 1024 the sections sit in the bar at the foot of the frame; at and
       * above it they sit in the header and the bar is gone. Both have to be
       * reachable without a scroll, and neither may be measured against the
       * other's geometry.
       */
      const nav = await page.evaluate(() => {
        for (const label of ["Primary", "Primary sections"]) {
          const node = document.querySelector(`nav[aria-label="${label}"]`);
          const box = node?.getBoundingClientRect();

          if (box && box.height > 0) {
            return {
              label,
              top: Math.round(box.top),
              bottom: Math.round(box.bottom),
              height: Math.round(box.height),
            };
          }
        }

        return null;
      });

      const height = (await frame(page)).clientHeight;

      expect(nav, `${route.name} has section navigation`).not.toBeNull();
      // Visible without scrolling.
      expect(nav?.bottom, route.name).toBeLessThanOrEqual(height + 1);
      expect(nav?.top, route.name).toBeGreaterThanOrEqual(0);
      expect(nav?.height, route.name).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe("Passport navigation, from the first frame", () => {
  test.beforeEach(async ({ page }) => {
    await useNormalMode(page);
    await seedSampleCollection(page);
  });

  test("the List/Book control is in view before any scrolling, in List mode", async ({
    page,
  }) => {
    await settle(page, "/passport");

    const toggle = page.getByRole("group", { name: "Passport view" });

    await expect(toggle).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("and in Book mode, where the field used to push it off the top", async ({
    page,
  }) => {
    await seedPassportView(page, { mode: "book", coverSeen: true });
    await settle(page, "/passport");

    await expect(page.getByRole("group", { name: "Passport view" })).toBeInViewport();
    await expect(page.getByRole("group", { name: "Passport pages" })).toBeInViewport();
  });

  test("the pager and its Cover control are in view on a closed book", async ({
    page,
  }) => {
    await seedPassportView(page, { mode: "book" });
    await settle(page, "/passport");

    const opener = page.getByRole("button", { name: /open passport/i });

    // One control, and it is reachable without a scroll — it used to sit at
    // about 709 px down a document the frame never constrained.
    await expect(opener).toHaveCount(1);
    await expect(opener).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("every Passport control keeps a 44 px target", async ({ page }) => {
    await seedPassportView(page, { mode: "book", coverSeen: true });
    await settle(page, "/passport");

    const small = await page.evaluate(() => {
      const out: string[] = [];

      for (const node of document.querySelectorAll(
        '[class*="PassportScreen"] button, [role="group"] button',
      )) {
        const box = node.getBoundingClientRect();

        if (box.width === 0) {
          continue;
        }

        if (box.width < 44 || box.height < 44) {
          out.push(`${node.textContent?.trim() || node.getAttribute("aria-label")}: ${Math.round(box.width)}x${Math.round(box.height)}`);
        }
      }

      return out;
    });

    expect(small).toEqual([]);
  });
});

test.describe("@short reduced-height mobile", () => {
  test.beforeEach(async ({ page }) => {
    await useNormalMode(page);
    await seedSampleCollection(page);
  });

  test("@short Book mode still fits, and its controls are still reachable", async ({
    page,
  }) => {
    await seedPassportView(page, { mode: "book", coverSeen: true });
    await settle(page, "/passport");

    const measured = await frame(page);

    expect(measured.scrollHeight).toBe(measured.clientHeight);
    expect(measured.scrollWidth).toBe(measured.clientWidth);

    await expect(page.getByRole("group", { name: "Passport view" })).toBeInViewport();
    await expect(page.getByRole("group", { name: "Passport pages" })).toBeInViewport();
    await expect(page.getByRole("button", { name: /^cover$/i })).toBeInViewport();
    await expect(page.getByRole("button", { name: /^contents$/i })).toBeInViewport();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeInViewport();
  });

  test("@short a closed book still opens from the pager", async ({ page }) => {
    await seedPassportView(page, { mode: "book" });
    await settle(page, "/passport");

    const opener = page.getByRole("button", { name: /open passport/i });

    await expect(opener).toBeInViewport();
    await opener.click();

    await expect
      .poll(
        async () =>
          page.evaluate(
            () =>
              document
                .querySelector('[class*="book"][data-opened]')
                ?.getAttribute("data-opened") === "true",
          ),
        { timeout: 5000 },
      )
      .toBe(true);
  });

  test("@short the enlarged impression fits the frame and keeps its action", async ({
    page,
  }) => {
    await settle(page, "/passport");

    await page
      .getByRole("button", { name: /Ginza Itoya Main Store/ })
      .first()
      .click();

    const dialog = page.getByRole("dialog");

    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: /open shop/i })).toBeInViewport();
    await expect(dialog.getByRole("button", { name: /close stamp/i })).toBeInViewport();

    // The sheet is capped against the *dynamic* viewport, so it never runs past
    // the space a mobile browser actually leaves.
    const fits = await dialog.evaluate((node) => {
      const box = node.getBoundingClientRect();

      return box.top >= -0.5 && box.bottom <= window.innerHeight + 0.5;
    });

    expect(fits).toBe(true);
  });

  test("@short no surface overflows sideways on a short screen either", async ({
    page,
  }) => {
    for (const route of ROUTES) {
      await settle(page, route.path);

      const measured = await frame(page);

      expect(measured.scrollWidth, route.name).toBe(measured.clientWidth);
      expect(measured.innerWidth, route.name).toBe(measured.clientWidth);
    }
  });
});

/**
 * The safe area.
 *
 * The device emulation has no inset, so this checks the *declaration* rather
 * than a rendered gap: every surface that reaches the foot of the frame has to
 * pad itself by `env(safe-area-inset-bottom)`, or a notched device puts its home
 * indicator over a control.
 */
test("surfaces that reach the foot of the frame respect the safe area", async ({
  page,
}) => {
  await useNormalMode(page);
  await seedSampleCollection(page);
  await settle(page, "/passport");

  const declared = await page.evaluate(async () => {
    const sheets = [...document.styleSheets];
    const text: string[] = [];

    for (const sheet of sheets) {
      try {
        for (const rule of sheet.cssRules) {
          text.push(rule.cssText);
        }
      } catch {
        // A cross-origin sheet; the application's own are same-origin.
      }
    }

    const all = text.join("\n");

    return {
      nav: /bottomNav[^}]*safe-area-inset-bottom/s.test(all),
      field: /field[^}]*safe-area-inset-bottom/s.test(all),
      sheet: /scrim[^}]*safe-area-inset-bottom/s.test(all),
    };
  });

  expect(declared).toEqual({ nav: true, field: true, sheet: true });
});
