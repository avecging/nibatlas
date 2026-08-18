"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { DestinationSearch } from "@/src/components/map/DestinationSearch";
import { FilterBar } from "@/src/components/map/FilterBar";
import type { CameraMoveSource, CameraTarget } from "@/src/components/map/MapCanvas";
import { ResultsSheet } from "@/src/components/map/ResultsSheet";
import { SearchThisArea } from "@/src/components/map/SearchThisArea";
import { ShopList } from "@/src/components/shops/ShopList";
import { useMediaQuery } from "@/src/components/hooks/useMediaQuery";
import { Icon } from "@/src/components/ui/Icon";
import { DemoBadge } from "@/src/components/ui/StatusBadge";
import type { Viewport } from "@/src/domain/geo";
import type { ShopMapSummary } from "@/src/domain/shops";
import { decorateResults } from "@/src/domain/user-state";
import { useCollection } from "@/src/features/collection/collection-store";
import {
  createExploreState,
  exploreReducer,
  hasUncommittedFilters,
  shouldOfferSearchArea,
  type SheetState,
} from "@/src/features/explore/explore-state";
import {
  AbortedError,
  createFixtureShopSource,
  DEMO_RESULT_CAP,
} from "@/src/features/explore/shop-source";
import { createFixtureGeocoder } from "@/src/features/map/destination-geocoder";
import { demoDestinations } from "@/src/fixtures/demo-destinations";
import { demoShopSummaries } from "@/src/fixtures/demo-catalogue";
import { createMapStyleProvider } from "@/src/features/map/map-style";
import { noopTelemetry } from "@/src/features/map/telemetry";

import styles from "./ExploreScreen.module.css";

const MapCanvas = dynamic(
  () => import("@/src/components/map/MapCanvas").then((module) => module.MapCanvas),
  { ssr: false },
);

/** Opens on the three launch countries so the demo shows clusters immediately. */
const INITIAL_VIEWPORT: Viewport = {
  bounds: { west: 96, south: -4, east: 149, north: 46 },
  zoom: 3,
};

const DEMO_LATENCY_MS = 220;
const INTRO_STORAGE_KEY = "nib-atlas.intro-dismissed.v1";
const VIEWPORT_STORAGE_KEY = "nib-atlas.explore-viewport.v1";

interface PersistedExplore {
  readonly viewport: Viewport;
  readonly label: string | null;
}

function readPersistedViewport(): PersistedExplore | null {
  try {
    const raw = window.sessionStorage.getItem(VIEWPORT_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as PersistedExplore;

    return typeof parsed?.viewport?.zoom === "number" ? parsed : null;
  } catch {
    return null;
  }
}

export function ExploreScreen() {
  const collection = useCollection();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(
    exploreReducer,
    { viewport: INITIAL_VIEWPORT },
    createExploreState,
  );
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null);
  const [introDismissed, setIntroDismissed] = useState(true);

  const pendingCommit = useRef<{ readonly label: string | null } | null>(null);
  const cameraToken = useRef(0);

  const source = useMemo(
    () => createFixtureShopSource({ latencyMs: DEMO_LATENCY_MS }),
    [],
  );
  const geocoder = useMemo(() => createFixtureGeocoder(), []);
  const styleProvider = useMemo(
    () => createMapStyleProvider(process.env.NEXT_PUBLIC_MAPTILER_KEY),
    [],
  );

  const onCameraSettled = useCallback((viewport: Viewport, source: CameraMoveSource) => {
    if (source === "user") {
      // The user has taken over, so any camera commit we had queued — a
      // destination fly they interrupted, for example — is abandoned rather
      // than applied to wherever they end up.
      pendingCommit.current = null;

      // Gestures never refetch; they only make `Search this area` available.
      dispatch({ type: "cameraMoved", camera: viewport });
      return;
    }

    if (source === "resize") {
      dispatch({ type: "reframeCamera", camera: viewport });
      return;
    }

    const pending = pendingCommit.current;

    if (pending) {
      pendingCommit.current = null;
      dispatch({
        type: "commitSearch",
        viewport,
        ...(pending.label === null ? {} : { label: pending.label }),
      });
      return;
    }

    dispatch({ type: "adoptCamera", camera: viewport });
  }, []);

  const moveCamera = useCallback((viewport: Viewport, label: string | null) => {
    pendingCommit.current = { label };
    cameraToken.current += 1;
    setCameraTarget({ viewport, token: cameraToken.current });
  }, []);

  useEffect(() => {
    // Hydrating a dismissal flag from session storage is an external-system read
    // that can only happen after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIntroDismissed(window.sessionStorage.getItem(INTRO_STORAGE_KEY) === "true");
  }, []);

  // Restore the previous map context after shop-detail navigation, or honour a
  // deep link from Saved and Discover.
  useEffect(() => {
    const shopSlug = searchParams?.get("shop");
    const destinationId = searchParams?.get("destination");

    if (shopSlug) {
      const shop = demoShopSummaries.find((candidate) => candidate.slug === shopSlug);

      if (shop) {
        const padding = 0.006;
        moveCamera(
          {
            bounds: {
              west: shop.position.longitude - padding,
              south: shop.position.latitude - padding,
              east: shop.position.longitude + padding,
              north: shop.position.latitude + padding,
            },
            zoom: 16,
          },
          shop.name,
        );
        dispatch({ type: "selectShop", shopId: shop.id });
        return;
      }
    }

    if (destinationId) {
      const destination = demoDestinations.find(
        (candidate) => candidate.id === destinationId,
      );

      if (destination) {
        moveCamera({ bounds: destination.bounds, zoom: destination.zoom }, destination.name);
        return;
      }
    }

    const persisted = readPersistedViewport();

    if (persisted) {
      moveCamera(persisted.viewport, persisted.label);
    }
    // Deep links and restoration run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { query } = state;

  // Only a committed query fetches. Panning, zooming, and adopting the
  // renderer camera never reach this effect.
  useEffect(() => {
    const controller = new AbortController();

    void source
      .fetchViewport(
        {
          bounds: query.bounds,
          zoom: query.zoom,
          shopTypes: query.shopTypes,
          limit: DEMO_RESULT_CAP,
        },
        controller.signal,
      )
      .then((response) => {
        dispatch({
          type: "resultsLoaded",
          requestId: query.requestId,
          shops: response.shops,
          truncated: response.truncated,
        });
        noopTelemetry.record("map_view_committed", {
          zoom: Math.round(query.zoom),
          resultCount: response.shops.length,
          truncated: response.truncated,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof AbortedError || controller.signal.aborted) {
          return;
        }

        dispatch({ type: "resultsFailed", requestId: query.requestId });
      });

    return () => controller.abort();
  }, [query, source]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        VIEWPORT_STORAGE_KEY,
        JSON.stringify({
          viewport: state.committed,
          label: state.lastCommittedLabel,
        } satisfies PersistedExplore),
      );
    } catch {
      // Best effort only.
    }
  }, [state.committed, state.lastCommittedLabel]);

  const results = useMemo(
    () =>
      decorateResults(state.results, collection.userShopState, state.committedFilters.status),
    [collection.userShopState, state.committedFilters.status, state.results],
  );

  const selectedShop = useMemo(
    () => results.find((shop) => shop.id === state.selectedShopId) ?? null,
    [results, state.selectedShopId],
  );

  const handleSelect = useCallback((shopId: string | null) => {
    // Selection is shared state, not navigation: the sheet already shows at
    // least the Peek state, so no sheet change is required here.
    dispatch({ type: "selectShop", shopId });
  }, []);

  const handleToggleSaved = useCallback(
    (shopId: string) => {
      const saved = collection.toggleSaved(shopId);
      noopTelemetry.record("shop_saved", { outcome: saved ? "saved" : "unsaved" });
    },
    [collection],
  );

  const offerMode = shouldOfferSearchArea(state)
    ? "offer"
    : state.status === "loading"
      ? "loading"
      : state.status === "error"
        ? "error"
        : "hidden";

  const summary = (
    <>
      <span className={styles.summaryLine}>
        <span className="type-h3">
          {state.status === "loading" && results.length === 0
            ? "Searching…"
            : `${results.length} shop${results.length === 1 ? "" : "s"} in this area`}
        </span>
        <span className="type-body-sm">
          {selectedShop
            ? `Selected: ${selectedShop.name}`
            : state.lastCommittedLabel
              ? `Searched: ${state.lastCommittedLabel}`
              : "Move the map, then search this area"}
        </span>
      </span>
      <DemoBadge>Demo data</DemoBadge>
    </>
  );

  const filterBar = (
    <FilterBar
      filters={state.draftFilters}
      uncommitted={hasUncommittedFilters(state)}
      onStatusChange={(status) => dispatch({ type: "setStatusFilter", status })}
      onToggleType={(shopType) => dispatch({ type: "toggleShopType", shopType })}
      onClear={() => dispatch({ type: "clearFilters" })}
    />
  );

  const list = (
    <>
      {state.status === "error" ? (
        <p className={styles.errorNote} role="alert">
          <Icon name="alert" size={18} />
          <span>
            The demo viewport request failed. These results are from the previous
            search — use Retry above.
          </span>
        </p>
      ) : null}
      <ShopList
        shops={results}
        selectedShopId={state.selectedShopId}
        savedShopIds={collection.savedShopIds}
        truncated={state.truncated}
        onSelect={(shopId) => handleSelect(shopId)}
        onToggleSaved={handleToggleSaved}
        onOpenDetail={(shop) =>
          noopTelemetry.record("shop_opened", { shopSlug: shop.slug, surface: "list" })
        }
      />
    </>
  );

  return (
    <div
      className={styles.layout}
      data-testid="explore"
      data-explore-status={state.status}
      data-search-offer={offerMode}
      data-committed-label={state.lastCommittedLabel ?? ""}
    >
      <div className={styles.mapPane}>
        <div className={styles.overlayTop}>
          <DestinationSearch
            geocoder={geocoder}
            onChooseDestination={(viewport, label) => moveCamera(viewport, label)}
            onChooseShop={(shop: ShopMapSummary, viewport) => {
              moveCamera(viewport, shop.name);
              dispatch({ type: "selectShop", shopId: shop.id });
            }}
            onSearched={(queryLength) =>
              noopTelemetry.record("destination_searched", { queryLength })
            }
          />
          {introDismissed ? null : (
            <div className={styles.intro}>
              <span className={styles.introText}>
                <strong>Find fountain pen shops. Visit them. Collect stamps.</strong>
                Explore the map without an account. Results refresh only when you
                choose <em>Search this area</em>.
              </span>
              <button
                type="button"
                className={styles.introDismiss}
                aria-label="Dismiss introduction"
                onClick={() => {
                  setIntroDismissed(true);
                  window.sessionStorage.setItem(INTRO_STORAGE_KEY, "true");
                }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          )}
        </div>

        <MapCanvas
          shops={results}
          selectedShopId={state.selectedShopId}
          initialViewport={INITIAL_VIEWPORT}
          styleProvider={styleProvider}
          cameraTarget={cameraTarget}
          onSelectShop={handleSelect}
          onCameraSettled={onCameraSettled}
        />

        <div className={styles.searchAreaSlot}>
          <SearchThisArea
            mode={offerMode}
            onSearch={() => dispatch({ type: "commitSearch" })}
          />
        </div>

        {isDesktop ? null : (
          <ResultsSheet
            state={state.sheetState}
            onStateChange={(sheetState: SheetState) =>
              dispatch({ type: "setSheetState", sheetState })
            }
            summary={summary}
          >
            <div className={styles.mobileFilters}>{filterBar}</div>
            {list}
          </ResultsSheet>
        )}
      </div>

      {isDesktop ? (
        <aside className={styles.desktopPanel} aria-label="Results list">
          <div className={styles.desktopSummary}>{summary}</div>
          {filterBar}
          <div className={styles.desktopScroll}>{list}</div>
        </aside>
      ) : null}
    </div>
  );
}
