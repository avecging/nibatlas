import { defineConfig, devices } from "@playwright/test";

/**
 * Milestone 1 runs the interaction journeys at the three breakpoints named in
 * `IMPLEMENTATION-PLAN.md`: 360 × 800, 768 × 1024, and 1440 × 900.
 *
 * Visual-regression baselines are platform specific, so that project is opted
 * into with `VISUAL=1 pnpm test:e2e` and is not part of the default run.
 */
const visualEnabled = Boolean(process.env.VISUAL);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  // Journeys run against a production build so the results match what CI
  // deploys, and so dev-only HMR behaviour cannot affect assertions.
  webServer: {
    command: "pnpm build && pnpm start --port 3000",
    url: "http://127.0.0.1:3000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
  projects: [
    {
      name: "mobile-360",
      testDir: "./tests/e2e",
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 800 } },
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
  ],
});
