"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import {
  createCatalogueAdapters,
  type CatalogueAdapterOptions,
  type CatalogueAdapters,
} from "@/src/features/catalogue/catalogue-adapters";
import {
  readCatalogueMode,
  resolveCatalogueMode,
  type CatalogueModeResolution,
} from "@/src/features/catalogue/catalogue-mode";

/**
 * The client-side catalogue seam.
 *
 * One resolution per document, read from the deployment's mode, so every screen
 * agrees on which supplier is live and no component has to know one exists.
 */
const CatalogueContext = createContext<CatalogueAdapters | null>(null);

/** Fixture latency, so the loading states are visible rather than theoretical. */
const FIXTURE_LATENCY_MS = 220;

export function CatalogueProvider({
  children,
  mode,
  adapters,
  options,
}: {
  readonly children: ReactNode;
  /** Test override for the configured value. */
  readonly mode?: string;
  /** Test override for the adapters themselves. */
  readonly adapters?: CatalogueAdapters;
  readonly options?: CatalogueAdapterOptions;
}) {
  const resolution: CatalogueModeResolution = useMemo(
    () => (mode === undefined ? readCatalogueMode() : resolveCatalogueMode(mode)),
    [mode],
  );

  /*
   * Depend on the option *values*, not the options object.
   *
   * A caller passing an inline `options` literal would otherwise rebuild the
   * adapters on every render, and a new source identity is a new viewport
   * request — the request storm this milestone exists to prevent, arriving
   * through the provider rather than the map.
   */
  const optionFetch = options?.fetch;
  const optionLatencyMs = options?.fixtureLatencyMs;

  const value = useMemo(
    () =>
      adapters ??
      createCatalogueAdapters(resolution, {
        fixtureLatencyMs: optionLatencyMs ?? FIXTURE_LATENCY_MS,
        ...(optionFetch === undefined ? {} : { fetch: optionFetch }),
      }),
    [adapters, optionFetch, optionLatencyMs, resolution],
  );

  return <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>;
}

/**
 * The adapters for the current document.
 *
 * Falls back to resolving the mode itself when no provider is above the caller,
 * so a client island rendered on its own in a test behaves the same way the
 * application does rather than throwing.
 */
export function useCatalogue(): CatalogueAdapters {
  const provided = useContext(CatalogueContext);
  const fallback = useMemo(
    () =>
      createCatalogueAdapters(readCatalogueMode(), {
        fixtureLatencyMs: FIXTURE_LATENCY_MS,
      }),
    [],
  );

  return provided ?? fallback;
}
