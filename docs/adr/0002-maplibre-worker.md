# ADR 0002 — MapLibre worker bundle under Turbopack

**Status:** Accepted for Milestone 1; blocking decision required before Milestone 3
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

## Decision for Milestone 1

1. The offline demo basemap declares **no sources**. A background-only style
   renders identically with or without a worker, so the prototype is unaffected.
2. Marker clustering is computed in application code
   (`src/domain/clustering.ts`) and rendered as accessible HTML markers, rather
   than through MapLibre's source clustering. This is deterministic, unit
   tested, and independent of the worker.
3. Map readiness no longer waits for the `load` event. The resolved camera is
   reported once the renderer has a transform.
4. `NEXT_PUBLIC_MAPLIBRE_WORKER_URL` is read at map creation and passed to
   `setWorkerUrl`, so a served worker copy fixes the problem with no code change.

## Decision required before Milestone 3

Milestone 3 connects real MapTiler vector tiles, which cannot parse without a
worker. One of the following is needed, and each touches files owned outside the
frontend:

- **Serve the worker as a static asset.** Copy
  `maplibre-gl/dist/maplibre-gl-worker.mjs` and `maplibre-gl-shared.mjs` into
  `public/vendor/maplibre/` from a `prebuild` script and set
  `NEXT_PUBLIC_MAPLIBRE_WORKER_URL=/vendor/maplibre/maplibre-gl-worker.mjs`.
  Requires a root package script.
- **Build with webpack** (`next build --webpack`), where
  `new URL(..., import.meta.url)` resolves to an emitted asset. Requires root
  package scripts and a Cloudflare/OpenNext compatibility check.
- **Pin MapLibre 4.x** and use its `workerClass` escape hatch. Requires a
  dependency change and loses two major versions of fixes.

Recommendation: the static-asset copy. It is the smallest change, keeps
Turbopack, and is verifiable with the existing Cloudflare preview build.
