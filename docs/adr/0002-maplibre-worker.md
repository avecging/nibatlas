# ADR 0002 — MapLibre worker bundle under Turbopack

**Status:** Accepted and implemented
**Date:** 18 August 2026
**Owner of the follow-up:** Codex (build and deployment configuration)

## Context

MapLibre GL JS 6 resolves its web-worker bundle at runtime:

```js
const workerUrl = config.WORKER_URL || new URL("./maplibre-gl-worker.mjs", import.meta.url).href;
```

It only uses that computed value when `import.meta.url` is an `http(s)` URL.

Next.js 16 builds with Turbopack, where `import.meta.url` evaluates to
`file:///ROOT/<source path>` in the browser bundle. MapLibre therefore falls back
to an empty worker URL, constructs `new Worker("")`, and the worker dies
immediately. Verified in a production build (`next build && next start`): a
worker is created against the document URL and is gone a moment later.

Consequences observed:

- every tiled source (`geojson`, `vector`, `raster`) stays unparsed;
- `map.isStyleLoaded()` never becomes true and the `load` event is unreliable;
- `querySourceFeatures` returns nothing, so MapLibre's built-in clustering
  cannot be used.

MapLibre 3 and 4 offered `maplibregl.workerClass` and a CSP worker build for
exactly this situation. Version 6 removed both.

## Superseded Milestone 1 workaround

1. The offline demo basemap declares **no sources**. A background-only style
   renders identically with or without a worker, so the prototype is unaffected.
2. Marker clustering is computed in application code
   (`src/domain/clustering.ts`) and rendered as accessible HTML markers, rather
   than through MapLibre's source clustering. This is deterministic, unit
   tested, and independent of the worker.
3. Map readiness no longer waits for the `load` event. The resolved camera is
   reported once the renderer has a transform.
4. `NEXT_PUBLIC_MAPLIBRE_WORKER_URL` was read at map creation and passed to
   `setWorkerUrl`, but no asset was supplied by the build.

This workaround proved camera, marker, clustering, and card synchronization, but
the blank paper field did not provide meaningful geographic context. It is no
longer the accepted deployment configuration.

## Decision

Serve the MapLibre worker as a same-origin static asset. The build copies both
`maplibre-gl/dist/maplibre-gl-worker.mjs` and its imported sibling
`maplibre-gl-shared.mjs` into `public/maplibre/`, then `setWorkerUrl` points to
`/maplibre/maplibre-gl-worker.mjs` by default.

The copy runs before `dev`, `build`, every Cloudflare build/preview, and both
deployment scripts. It resolves files from the installed package so the worker
always matches the lockfile version. Generated assets are ignored by Git.

`NEXT_PUBLIC_MAPLIBRE_WORKER_URL` remains an optional override for a deployment
mounted below a path prefix. Staging and production must provide a restricted
`NEXT_PUBLIC_MAPTILER_KEY` at build time; without it, automated tests continue
to use the deterministic paper style.

## Consequences

- Turbopack and the existing Cloudflare/OpenNext build remain unchanged.
- Vector and raster sources can use the worker in development and deployment.
- Worker and shared module are same-origin and can use `worker-src 'self'`.
- Build and E2E checks verify that both generated modules exist and are served.
- Supplier style payloads remain behind `MapStyleProvider` and do not enter
  application domain state.
