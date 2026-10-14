import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    // Everything under `tests/` is a Playwright suite.
    exclude: ["tests/**", "node_modules/**", ".next/**", ".open-next/**"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
