import { defineConfig, devices } from "@playwright/test";

/**
 * Milestone 1 runs the interaction journeys at the three breakpoints named in
 * `IMPLEMENTATION-PLAN.md`: 360 × 800, 768 × 1024, and 1440 × 900.
 *
 * Visual-regression baselines are platform specific, so that project is opted
 * into with `VISUAL=1 pnpm test:e2e` and is not part of the default run.
 */
const visualEnabled = Boolean(process.env.VISUAL);

/**
 * Review evidence, not an assertion suite: `EVIDENCE=1 pnpm test:e2e` writes the
 * WP1 reviewer-mode comparison screenshots into `docs/evidence/`. Opted into for
 * the same reason as the visual project — it produces files rather than verdicts.
 */
const evidenceEnabled = Boolean(process.env.EVIDENCE);
const apiIntegrationEnabled = Boolean(process.env.API_INTEGRATION);
const apiIntegrationReuseBuild = Boolean(process.env.API_INTEGRATION_REUSE_BUILD);
const stagingUrl = process.env.STAGING_URL?.trim();

/**
 * Escape hatch for environments that already ship a Chromium build but not the
 * exact revision this Playwright version downloads. CI installs browsers
 * normally and leaves this unset, so the default behaviour is unchanged.
 */
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?.trim();
const launchOptions = chromiumExecutable
  ? { launchOptions: { executablePath: chromiumExecutable } }
  : {};

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: stagingUrl || "http://127.0.0.1:3000",
    trace: "on-first-retry",
    ...launchOptions,
  },
  // Journeys run against a production build so the results match what CI
  // deploys, and so dev-only HMR behaviour cannot affect assertions.
  ...(stagingUrl
    ? {}
    : apiIntegrationEnabled
      ? {
          webServer: [
            {
              command: "node scripts/api-e2e-upstream.mjs",
              url: "http://127.0.0.1:3100/health",
              reuseExistingServer: !process.env.CI,
              timeout: 30_000,
            },
            {
              command:
                `NEXT_PUBLIC_CATALOGUE_MODE=api-demo NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3100 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=api-e2e-publishable ${apiIntegrationReuseBuild ? "pnpm start --hostname 127.0.0.1 --port 3000" : "pnpm build && pnpm start --hostname 127.0.0.1 --port 3000"}`,
              url: "http://127.0.0.1:3000/api/health",
              reuseExistingServer: !process.env.CI,
              timeout: 300_000,
            },
          ],
        }
    : {
        webServer: {
          command: "pnpm build && pnpm start --hostname 127.0.0.1 --port 3000",
          url: "http://127.0.0.1:3000/api/health",
          reuseExistingServer: !process.env.CI,
          timeout: 300_000,
        },
      }),
  projects: [
    {
      name: "mobile-360",
      testDir: "./tests/e2e",
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 800 } },
    },
    /*
     * A short mobile screen.
     *
     * `IMPLEMENTATION-PLAN.md`'s three breakpoints are all generous in height,
     * and WP5's viewport defect only appeared below them: a real phone showing
     * its browser chrome has roughly 640 usable pixels, not 800, and that is
     * where the Passport's book stopped fitting its own frame. 360 x 568 is the
     * shortest screen still in use, so it is the one the reduced-height cases
     * run at. It runs only the tests that are about height, by tag.
     */
    {
      name: "mobile-360x568",
      testDir: "./tests/e2e",
      grep: /@short/,
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 568 } },
    },
    {
      name: "tablet-768",
      testDir: "./tests/e2e",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    {
      name: "desktop-1440",
      testDir: "./tests/e2e",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    ...(visualEnabled
      ? [
          {
            name: "visual",
            testDir: "./tests/visual",
            use: { ...devices["Desktop Chrome"] },
          },
        ]
      : []),
    ...(evidenceEnabled
      ? [
          {
            name: "evidence",
            testDir: "./tests/evidence",
            use: { ...devices["Desktop Chrome"] },
          },
        ]
      : []),
    ...(apiIntegrationEnabled
      ? [
          {
            name: "api-integration",
            testDir: "./tests/integration",
            fullyParallel: false,
            workers: 1,
            use: {
              ...devices["Desktop Chrome"],
              viewport: { width: 1440, height: 900 },
            },
          },
        ]
      : []),
    ...(stagingUrl
      ? [
          {
            name: "staging-maptiler",
            testDir: "./tests/staging",
            testMatch: "maptiler.spec.ts",
            retries: 0,
            use: {
              ...devices["Desktop Chrome"],
              viewport: { width: 1440, height: 900 },
              trace: "off" as const,
            },
          },
          {
            name: "staging-catalogue",
            testDir: "./tests/staging",
            testMatch: "catalogue.spec.ts",
            retries: 0,
            use: {
              ...devices["Desktop Chrome"],
              viewport: { width: 1440, height: 900 },
              trace: "off" as const,
            },
          },
        ]
      : []),
  ],
});
