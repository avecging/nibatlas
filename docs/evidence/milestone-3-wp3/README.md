# Milestone 3 WP3 — integration hardening and staging proof

Issue #25's final integration package is demonstrated at three levels.

## Deterministic checks

- Vitest covers viewport timing, cancellation, stale responses, retained results
  and Retry; search debounce, late-result rejection and cancellation; independent
  place/shop supplier failure and cancellation; detail failure classification and
  signal propagation; and the 500-record compressed payload budget.
- `pnpm test:e2e:api` builds in `api-demo` mode against a local public-RPC double.
  The browser still uses the same-origin v1 endpoints, runtime decoders and
  server detail source. It proves marker → card → detail → Back, retained results
  plus successful Retry, and separately named place and canonical-shop groups.
- Normal `pnpm test:e2e` remains the complete fixture-mode responsive,
  accessibility, reduced-motion and regression suite.

The RPC double is a process owned by the test harness. There is no test switch in
application code and no provider-shaped data enters UI state.

## Controlled staging smoke

The staging workflow fixes `NEXT_PUBLIC_CATALOGUE_MODE=api-demo` and reads the
hosted demo database with the publishable key. After deployment, Playwright
repeats marker → card → detail → Back, requires the detail provenance sentence
to name demo fixture evidence, and exercises Nearby with a published demo-shop
coordinate in POST JSON. It asserts latitude and longitude are absent from the
URL. Tracing is disabled and the one-day artifact contains screenshots only.

Staging proof is not production import. Production must use `api`, which rejects
demo records, and catalogue import remains Milestone 6/7 work.

## Commands

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build:cloudflare
pnpm test:e2e
pnpm test:e2e:api
```

Database reset, pgTAP and the 50,000-shop performance suite run in CI. The final
PR's staging workflow supplies the hosted demo-projection proof.
