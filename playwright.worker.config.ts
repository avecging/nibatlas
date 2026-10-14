import { defineConfig } from "@playwright/test";

// Real Auth/PostgREST + the deployed OpenNext artifact. No route interception,
// service-role requests, session fixtures, or recordings containing credentials.
export default defineConfig({
  testDir: "./tests/worker",
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: "list",
  use: {
    baseURL: "https://localhost:8787",
    ignoreHTTPSErrors: true,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: "pnpm exec wrangler dev --local --ip 127.0.0.1 --port 8787 --local-protocol https",
    url: "https://localhost:8787/api/health",
    ignoreHTTPSErrors: true,
    timeout: 120_000,
  },
});
