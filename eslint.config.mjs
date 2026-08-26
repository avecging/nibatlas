import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".open-next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored MapLibre worker bundles, copied into place by
    // `scripts/copy-maplibre-worker.mjs` before dev and build. They are
    // gitignored build output, not source, and linting them makes `pnpm verify`
    // fail on any tree where a build has already run.
    "public/maplibre/*.mjs",
  ]),
]);

export default eslintConfig;
