import { setWorkerUrl } from "maplibre-gl";

/**
 * MapLibre 6 resolves its worker bundle from `import.meta.url`. Under the
 * Turbopack build that value is `file:///ROOT/...`, so MapLibre falls back to an
 * empty worker URL and the worker never starts. Every tiled source therefore
 * stays unparsed.
 *
 * The build copies the worker and its shared sibling from the installed
 * MapLibre package into `public/maplibre`. The environment variable remains an
 * override for deployments mounted below a path prefix.
 *
 * See `docs/adr/0002-maplibre-worker.md`.
 */
let configured = false;

export const DEFAULT_MAPLIBRE_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

export function configureMapLibreRuntime(
  workerUrl: string =
    process.env.NEXT_PUBLIC_MAPLIBRE_WORKER_URL || DEFAULT_MAPLIBRE_WORKER_URL,
): void {
  if (configured) {
    return;
  }

  setWorkerUrl(workerUrl);
  configured = true;
}
