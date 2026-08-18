import { setWorkerUrl } from "maplibre-gl";

/**
 * MapLibre 6 resolves its worker bundle from `import.meta.url`. Under the
 * Turbopack build that value is `file:///ROOT/...`, so MapLibre falls back to an
 * empty worker URL and the worker never starts. Every tiled source therefore
 * stays unparsed.
 *
 * Milestone 1 does not need a tiled source, but Milestone 3 does. Setting
 * `NEXT_PUBLIC_MAPLIBRE_WORKER_URL` to a served copy of
 * `maplibre-gl/dist/maplibre-gl-worker.mjs` (with `maplibre-gl-shared.mjs`
 * beside it) restores tile parsing without a bundler change.
 *
 * See `docs/adr/0002-maplibre-worker.md`.
 */
let configured = false;

export function configureMapLibreRuntime(
  workerUrl: string | undefined = process.env.NEXT_PUBLIC_MAPLIBRE_WORKER_URL,
): void {
  if (configured || !workerUrl) {
    return;
  }

  setWorkerUrl(workerUrl);
  configured = true;
}
