"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
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
import type { CountryCode, Viewport } from "@/src/domain/geo";
import { COUNTRY_LABELS } from "@/src/domain/shop-detail";
import type { ShopMapSummary } from "@/src/domain/shops";
import { applyUserShopState, decorateResults } from "@/src/domain/user-state";
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
  PROTOTYPE_RESULT_CAP,
} from "@/src/features/explore/shop-source";
import { createFixtureGeocoder } from "@/src/features/map/destination-geocoder";
import { prototypeDestinations } from "@/src/fixtures/prototype-destinations";
import { prototypeShopSummaries } from "@/src/fixtures/prototype-catalogue";
import { createMapStyleProvider } from "@/src/features/map/map-style";
import { noopTelemetry } from "@/src/features/map/telemetry";
import { ReviewerModeBadge } from "@/src/features/reviewer/ReviewerModeBadge";
import { useReviewerMode } from "@/src/features/reviewer/ReviewerModeProvider";

import styles from "./ExploreScreen.module.css";

const MapCanvas = dynamic(
  () => import("@/src/components/map/MapCanvas").then((module) => module.MapCanvas),
  { ssr: false },
);

/** Opens on the three launch countries so the prototype shows clusters immediately. */
const INITIAL_VIEWPORT: Viewport = {
  bounds: { west: 96, south: -4, east: 149, north: 46 },
  zoom: 3,
};

const PROTOTYPE_LATENCY_MS = 220;
const INTRO_STORAGE_KEY = "nib-atlas.intro-dismissed.v1";
const VIEWPORT_STORAGE_KEY = "nib-atlas.explore-viewport.v1";

/**
 * Map has two result scopes.
 *
 * `area` is the committed viewport. `saved` is every saved shop everywhere — the
 * global Saved mode Map owns. Saved is not a primary destination and not a
 * viewport filter: entering it replaces the scope of the result set entirely, so
 * a shop saved in Kobe is findable from a map sitting over Tainan.
 */
export type ExploreMode = "area" | "saved";

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

function shopViewport(shop: ShopMapSummary): Viewport {
  const padding = 0.006;

  return {
    bounds: {
      west: shop.position.longitude - padding,
      south: shop.position.latitude - padding,
      east: shop.position.longitude + padding,
      north: shop.position.latitude + padding,
    },
    zoom: 16,
  };
}

export function ExploreScreen({ mode = "area" }: { readonly mode?: ExploreMode }) {
  const collection = useCollection();
  const reviewer = useReviewerMode();
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
    () => createFixtureShopSource({ latencyMs: PROTOTYPE_LATENCY_MS }),
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
  // deep link from Saved mode and the place prompts.
  useEffect(() => {
    const shopSlug = searchParams?.get("shop");
    const destinationId = searchParams?.get("destination");

    if (shopSlug) {
      const shop = prototypeShopSummaries.find((candidate) => candidate.slug === shopSlug);

      if (shop) {
        moveCamera(shopViewport(shop), shop.name);
        dispatch({ type: "selectShop", shopId: shop.id });
        return;
      }
    }

    if (destinationId) {
      const destination = prototypeDestinations.find(
        (candidate) => candidate.id === destinationId,
      );

      if (destination) {
        moveCamera(
          { bounds: destination.bounds, zoom: destination.zoom },
          destination.name,
        );
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
          limit: PROTOTYPE_RESULT_CAP,
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

  const areaResults = useMemo(
    () =>
      decorateResults(state.results, collection.userShopState, state.committedFilters.status),
    [collection.userShopState, state.committedFilters.status, state.results],
  );

  /**
   * Saved mode reaches past the viewport entirely: the whole catalogue is
   * filtered by the saved set, so nothing depends on where the camera is.
   */
  const savedResults = useMemo(
    () =>
      applyUserShopState(
        prototypeShopSummaries.filter((shop) => collection.savedShopIds.has(shop.id)),
        collection.userShopState,
      ),
    [collection.savedShopIds, collection.userShopState],
  );

  const results = mode === "saved" ? savedResults : areaResults;

  const savedGroups = useMemo(() => {
    if (mode !== "saved") {
      return [];
    }

    const byCountry = new Map<CountryCode, ShopMapSummary[]>();

    for (const shop of savedResults) {
      byCountry.set(shop.countryCode, [...(byCountry.get(shop.countryCode) ?? []), shop]);
    }

    return [...byCountry.entries()]
      .map(([countryCode, shops]) => ({
        countryCode,
        label: COUNTRY_LABELS[countryCode],
        shops: [...shops].sort((a, b) => a.localityName.localeCompare(b.localityName)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [mode, savedResults]);

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

  /** Selecting a saved shop brings the camera to it without leaving Saved mode. */
  const handleSelectSaved = useCallback(
    (shopId: string) => {
      const shop = savedResults.find((candidate) => candidate.id === shopId);

      dispatch({ type: "selectShop", shopId });

      if (shop) {
        moveCamera(shopViewport(shop), shop.name);
      }
    },
    [moveCamera, savedResults],
  );

  const offerMode =
    mode === "saved"
      ? "hidden"
      : shouldOfferSearchArea(state)
        ? "offer"
        : state.status === "loading"
          ? "loading"
          : state.status === "error"
            ? "error"
            : "hidden";

  /*
   * Where Milestone 1 put a "Prototype sample" badge beside every result count,
   * there is now nothing. The reviewer marker moved to the map overlay instead:
   * the mobile shell header is hidden on Map, and the sheet's summary row is too
   * tight at 360 px to hold a badge and a control without clipping one of them.
   */
  const summary = (
    <span className={styles.summaryLine}>
      <span className="type-h3">
        {mode === "saved"
          ? `${results.length} saved shop${results.length === 1 ? "" : "s"}`
          : state.status === "loading" && results.length === 0
            ? "Searching…"
            : `${results.length} shop${results.length === 1 ? "" : "s"} in this area`}
      </span>
      <span className="type-body-sm">
        {selectedShop
          ? `Selected: ${selectedShop.name}`
          : mode === "saved"
            ? "All locations, not only this map view"
            : state.lastCommittedLabel
              ? `Searched: ${state.lastCommittedLabel}`
              : "Move the map, then search this area"}
      </span>
    </span>
  );

  const modeSwitch = (
    <div className={styles.modeSwitch} role="group" aria-label="Result scope">
      <Link
        className={styles.modeButton}
        href="/"
        aria-current={mode === "area" ? "true" : undefined}
      >
        <Icon name="map" size={16} />
        This area
      </Link>
      <Link
        className={styles.modeButton}
        href="/saved"
        aria-current={mode === "saved" ? "true" : undefined}
      >
        <Icon name="bookmark" size={16} />
        Saved ({collection.savedShopIds.size})
      </Link>
    </div>
  );

  const placePrompts = (
    <section className={styles.prompts} aria-labelledby="place-prompts">
      <h3 className={styles.promptsTitle} id="place-prompts">
        Places to explore
      </h3>
      <p className={styles.promptsNote}>
        {reviewer
          ? "Jump the map to a committed viewport in one of the three launch countries."
          : "Somewhere in Singapore, Japan, or Taiwan to start from."}
      </p>
      <ul className={styles.promptList}>
        {prototypeDestinations.slice(0, 8).map((destination) => (
          <li key={destination.id}>
            <Link className={styles.promptChip} href={`/?destination=${destination.id}`}>
              {destination.name}
              {destination.localName ? ` · ${destination.localName}` : ""}
            </Link>
          </li>
        ))}
      </ul>
    </section>
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

  const savedList = (
    <div className={styles.savedScope}>
      <p className={styles.savedBanner}>
        <Icon name="bookmark-filled" size={18} />
        <span>
          <strong>Saved — all locations.</strong> Every shop you have saved, wherever
          it is. Selecting one moves the map to it.
        </span>
      </p>
      {/*
        Same rule as Passport: "Nothing saved yet" is a claim about the reader, and
        local state resolves a frame after the first paint.
      */}
      {!collection.hydrated ? null : savedGroups.length === 0 ? (
        <div className={styles.savedEmpty}>
          {/*
            A real heading, not a paragraph styled like one. With a clean device
            now starting with nothing saved, this is the whole content of the
            screen, and it was leaving the page with no heading at all for a
            screen reader to land on.
          */}
          <h3 className="type-h3">Nothing saved yet</h3>
          <p>
            Save a shop from a marker, a card, or a shop page and it appears here —
            in any country.
          </p>
          <Link className={styles.savedEmptyLink} href="/">
            Back to map results
          </Link>
        </div>
      ) : (
        savedGroups.map((group) => (
          <section
            className={styles.savedGroup}
            key={group.countryCode}
            aria-labelledby={`saved-${group.countryCode}`}
          >
            <h3 className={styles.savedGroupTitle} id={`saved-${group.countryCode}`}>
              {group.label}
            </h3>
            <ShopList
              shops={group.shops}
              selectedShopId={state.selectedShopId}
              savedShopIds={collection.savedShopIds}
              truncated={false}
              listLabel={`Saved shops in ${group.label}`}
              detailFrom="saved"
              onSelect={handleSelectSaved}
              onToggleSaved={handleToggleSaved}
              onOpenDetail={(shop) =>
                noopTelemetry.record("shop_opened", { shopSlug: shop.slug, surface: "saved" })
              }
            />
          </section>
        ))
      )}
    </div>
  );

  const areaList = (
    <>
      {state.status === "error" ? (
        <p className={styles.errorNote} role="alert">
          <Icon name="alert" size={18} />
          <span>
            The viewport request failed. These results are from the previous search —
            use Retry above.
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
      {results.length === 0 && state.status !== "loading" ? placePrompts : null}
    </>
  );

  const list = mode === "saved" ? savedList : areaList;

  return (
    <div
      className={styles.layout}
      data-testid="explore"
      data-explore-mode={mode}
      data-sheet-state={state.sheetState}
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
          {modeSwitch}
          {/*
            The reviewer strip. Map is the one screen with no header at mobile
            widths, so the marker, the way out, and the basemap diagnostic sit in
            the map overlay instead. Nothing here renders in normal mode.
          */}
          {reviewer ? (
            <div className={styles.reviewerStrip} data-testid="reviewer-strip">
              <ReviewerModeBadge compact />
              <span className={styles.basemapDiagnostic} data-testid="basemap-diagnostic">
                {styleProvider.diagnosticAttribution}
              </span>
            </div>
          ) : null}
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
            {/*
              Peek shows the count and the top of the first or selected card
              only, per `UX.md`. Filters would be clipped mid-row at that
              height, which reads as broken rather than as a peek.
            */}
            {mode === "saved" || state.sheetState === "peek" ? null : (
              <div className={styles.mobileFilters}>{filterBar}</div>
            )}
            {list}
          </ResultsSheet>
        )}
      </div>

      {isDesktop ? (
        <aside className={styles.desktopPanel} aria-label="Results list">
          <div className={styles.desktopSummary}>{summary}</div>
          {mode === "saved" ? null : filterBar}
          <div className={styles.desktopScroll}>{list}</div>
        </aside>
      ) : null}
    </div>
  );
}
