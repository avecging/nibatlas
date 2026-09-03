"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { DestinationSearch } from "@/src/components/map/DestinationSearch";
import { MapFilters } from "@/src/components/map/MapFilters";
import type { CameraMoveSource, CameraTarget } from "@/src/components/map/MapCanvas";
import { ResultsSheet } from "@/src/components/map/ResultsSheet";
import { SearchThisArea } from "@/src/components/map/SearchThisArea";
import { ShopList } from "@/src/components/shops/ShopList";
import { useMediaQuery } from "@/src/components/hooks/useMediaQuery";
import { Icon } from "@/src/components/ui/Icon";
import { countryLabel, type CountryCode, type Viewport } from "@/src/domain/geo";
import type { ShopMapSummary } from "@/src/domain/shops";
import { applyUserShopState, filterResults } from "@/src/domain/user-state";
import { useCollection } from "@/src/features/collection/collection-store";
import {
  canCountDraftMatches,
  createExploreState,
  exploreReducer,
  hasUnappliedFilters,
  shouldOfferSearchArea,
  type SheetState,
} from "@/src/features/explore/explore-state";
import { useViewportResults } from "@/src/features/explore/use-viewport-results";
import { useCatalogue } from "@/src/features/catalogue/CatalogueProvider";
import { catalogueModeDiagnostic } from "@/src/features/catalogue/catalogue-mode";
import { prototypeDestinations } from "@/src/fixtures/prototype-destinations";
import { prototypeShopSummaries } from "@/src/fixtures/prototype-catalogue";
import { createMapStyleProvider } from "@/src/features/map/map-style";
import { shopFocusViewport } from "@/src/features/map/shop-focus";
import { noopTelemetry } from "@/src/features/map/telemetry";
import { ReviewerModeBadge } from "@/src/features/reviewer/ReviewerModeBadge";
import { useReviewerMode } from "@/src/features/reviewer/ReviewerModeProvider";

import styles from "./ExploreScreen.module.css";

const MapCanvas = dynamic(
  () => import("@/src/components/map/MapCanvas").then((module) => module.MapCanvas),
  { ssr: false },
);

/**
 * The opening frame: the region the catalogue currently covers, wide enough that
 * its clusters are visible immediately in either catalogue mode.
 */
const INITIAL_VIEWPORT: Viewport = {
  bounds: { west: 96, south: -4, east: 149, north: 46 },
  zoom: 3,
};

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

export function ExploreScreen({ mode = "area" }: { readonly mode?: ExploreMode }) {
  const catalogue = useCatalogue();
  const collection = useCollection();
  const reviewer = useReviewerMode();
  const router = useRouter();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(
    exploreReducer,
    { viewport: INITIAL_VIEWPORT },
    createExploreState,
  );
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null);
  const [introDismissed, setIntroDismissed] = useState(true);
  /**
   * Transient list-to-map synchronisation. It is not selection: it never
   * survives the pointer leaving, never moves the camera, and never changes what
   * the results summary calls selected.
   */
  const [highlightedShopId, setHighlightedShopId] = useState<string | null>(null);

  const pendingCommit = useRef<{ readonly label: string | null } | null>(null);
  const cameraToken = useRef(0);
  /**
   * The slug whose position is being resolved, and the token that decides which
   * answer is still wanted.
   */
  const [locatingSlug, setLocatingSlug] = useState<string | null>(null);
  const locateToken = useRef(0);

  const { geocoder, locator, shopSource } = catalogue;
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

  /**
   * Sends the map to one canonical shop, resolving its position first.
   *
   * `GET /api/v1/shops/search` returns canonical records without coordinates, so
   * a search hit is not a place until the locator has answered. A stale answer
   * is dropped by token rather than applied: a reader who has chosen a second
   * shop must not be flown to the first one arriving late. When the shop cannot
   * be placed at all the reader still gets somewhere true — its own page —
   * rather than a map that silently ignored the tap.
   */
  const focusShopBySlug = useCallback(
    (slug: string) => {
      const token = (locateToken.current += 1);

      setLocatingSlug(slug);

      void locator
        .locate(slug)
        .then((shop) => {
          if (locateToken.current !== token) {
            return;
          }

          setLocatingSlug(null);

          if (!shop) {
            router.push(`/shops/${slug}?from=map`);
            return;
          }

          moveCamera(shopFocusViewport(shop), shop.name);
          dispatch({ type: "selectShop", shopId: shop.id });
        })
        .catch(() => {
          if (locateToken.current !== token) {
            return;
          }

          setLocatingSlug(null);
          router.push(`/shops/${slug}?from=map`);
        });
    },
    [locator, moveCamera, router],
  );

  // Restore the previous map context after shop-detail navigation, or honour a
  // deep link from Saved mode and the place prompts.
  useEffect(() => {
    const controller = new AbortController();
    const shopSlug = searchParams?.get("shop");
    const destinationId = searchParams?.get("destination");

    function restorePersisted() {
      const persisted = readPersistedViewport();

      if (persisted) {
        moveCamera(persisted.viewport, persisted.label);
      }
    }

    function jumpToDestination(): boolean {
      if (!destinationId) {
        return false;
      }

      const destination = prototypeDestinations.find(
        (candidate) => candidate.id === destinationId,
      );

      if (!destination) {
        return false;
      }

      moveCamera({ bounds: destination.bounds, zoom: destination.zoom }, destination.name);

      return true;
    }

    if (shopSlug) {
      // The shop is resolved through the injected locator, so a `?shop=` return
      // from a shop page restores the same map in fixture and API modes alike.
      void locator
        .locate(shopSlug, controller.signal)
        .then((shop) => {
          if (controller.signal.aborted) {
            return;
          }

          if (shop) {
            moveCamera(shopFocusViewport(shop), shop.name);
            dispatch({ type: "selectShop", shopId: shop.id });
            return;
          }

          if (!jumpToDestination()) {
            restorePersisted();
          }
        })
        .catch(() => {
          if (!controller.signal.aborted && !jumpToDestination()) {
            restorePersisted();
          }
        });

      return () => controller.abort();
    }

    if (!jumpToDestination()) {
      restorePersisted();
    }

    return () => controller.abort();
    // Deep links and restoration run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { query } = state;

  /*
   * The only fetch on this screen, and it is behind a hook rather than inline:
   * the component is handed a source and never talks to the network itself.
   */
  useViewportResults(shopSource, query, dispatch);

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

  /** The committed result set with the reader's own state merged, unfiltered. */
  const mergedResults = useMemo(
    () => applyUserShopState(state.results, collection.userShopState),
    [collection.userShopState, state.results],
  );

  const areaResults = useMemo(
    () => filterResults(mergedResults, collection.userShopState, state.filters),
    [collection.userShopState, mergedResults, state.filters],
  );

  /**
   * What the drawer can promise. `null` means the loaded set cannot answer the
   * draft's question exactly, and the drawer says so rather than guessing.
   */
  const draftMatchCount = useMemo(
    () =>
      state.filtersOpen && canCountDraftMatches(state)
        ? filterResults(mergedResults, collection.userShopState, state.draftFilters).length
        : null,
    [collection.userShopState, mergedResults, state],
  );

  /**
   * Saved mode reaches past the viewport entirely: the whole catalogue is
   * filtered by the saved set, so nothing depends on where the camera is.
   */
  const savedResults = useMemo(
    () =>
      catalogue.prototypeCatalogueJoin
        ? applyUserShopState(
            prototypeShopSummaries.filter((shop) => collection.savedShopIds.has(shop.id)),
            collection.userShopState,
          )
        : [],
    [catalogue.prototypeCatalogueJoin, collection.savedShopIds, collection.userShopState],
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
        label: countryLabel(countryCode),
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

  const handleHighlight = useCallback((shopId: string | null) => {
    setHighlightedShopId(shopId);
  }, []);

  const handleToggleSaved = useCallback(
    (shopId: string) => {
      const saved = collection.toggleSaved(shopId);
      noopTelemetry.record("shop_saved", { outcome: saved ? "saved" : "unsaved" });
    },
    [collection],
  );

  const offerMode =
    mode === "saved" || state.status === "unavailable"
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
          : state.status === "unavailable"
            ? "Shops unavailable"
            : state.status === "loading" && results.length === 0
              ? "Searching…"
              : `${results.length} shop${results.length === 1 ? "" : "s"} in this area`}
      </span>
      <span className="type-body-sm">
        {selectedShop
          ? `Selected: ${selectedShop.name}`
          : mode === "saved"
            ? "All locations, not only this map view"
            : state.status === "unavailable"
              ? "The catalogue could not be reached"
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
          ? "Jump the map to one of the catalogue’s current destination fixtures."
          : "Choose one of the places currently in the catalogue."}
      </p>
      <ul className={styles.promptList}>
        {prototypeDestinations.slice(0, 8).map((destination) => (
          <li key={destination.id}>
            <Link className={styles.promptChip} href={`/?destination=${destination.id}`}>
              {destination.name}
              {destination.localName ? (
                <>
                  {" · "}
                  <span lang={destination.localNameLang} dir="auto">
                    {destination.localName}
                  </span>
                </>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );

  /*
   * A reader who pans and then filters should get one commit, not two. When the
   * camera has moved far enough to be offering `Search this area`, Apply carries
   * those bounds with the filters and settles the offer in the same action — and
   * the button says so rather than doing it silently.
   */
  const appliesCamera = mode === "area" && shouldOfferSearchArea(state);

  const filterBar = (
    <MapFilters
      filters={state.filters}
      draftFilters={state.draftFilters}
      open={state.filtersOpen}
      hasUnapplied={hasUnappliedFilters(state)}
      draftMatchCount={draftMatchCount}
      appliesCamera={appliesCamera}
      onOpen={() => dispatch({ type: "openFilters" })}
      onClose={() => dispatch({ type: "closeFilters" })}
      onStatusChange={(status) => dispatch({ type: "setStatusFilter", status })}
      onDraftAvailabilityChange={(availability) =>
        dispatch({ type: "setDraftAvailability", availability })
      }
      onToggleDraftType={(shopType) => dispatch({ type: "toggleDraftShopType", shopType })}
      onClearDraft={() => dispatch({ type: "clearDraftFilters" })}
      onApply={() =>
        dispatch(appliesCamera ? { type: "applyFilters", viewport: state.camera } : { type: "applyFilters" })
      }
      onClear={() => dispatch({ type: "clearFilters" })}
    />
  );

  const savedList = (
    <div className={styles.savedScope}>
      <p className={styles.savedBanner}>
        <Icon name="bookmark-filled" size={18} />
        <span>
          <strong>Saved — all locations.</strong> Every shop you have saved, wherever
          it is. Its marker lights up as you move through the list, and opening a
          card opens the shop.
        </span>
      </p>
      {/*
        Same rule as Passport: "Nothing saved yet" is a claim about the reader, and
        local state resolves a frame after the first paint.
      */}
      {!catalogue.prototypeCatalogueJoin ? (
        <div className={styles.savedEmpty} data-testid="saved-scope-unavailable">
          {/*
            Saved is a global scope: every saved shop, wherever it is. Answering
            that needs a lookup of saved records across the whole catalogue, and
            Milestone 3 excludes user-state reads — so rather than list a subset
            and call it everything, this scope stays empty here. Saving itself
            still works, and a saved shop still shows as saved on its marker,
            its card, and its own page.
          */}
          <h3 className="type-h3">Saved shops are not listed yet</h3>
          <p>
            Saving works and stays on this device, but listing every saved shop
            across the whole catalogue needs the account that carries them. Until
            then a saved shop shows as saved wherever you meet it — on its marker,
            its card, and its own page.
          </p>
          <Link className={styles.savedEmptyLink} href="/">
            Back to map results
          </Link>
        </div>
      ) : !collection.hydrated ? null : savedGroups.length === 0 ? (
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
              highlightedShopId={highlightedShopId}
              savedShopIds={collection.savedShopIds}
              visitedShopIds={collection.userShopState.visitedShopIds}
              truncated={false}
              listLabel={`Saved shops in ${group.label}`}
              detailFrom="saved"
              onHighlight={handleHighlight}
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

  /*
   * A catalogue that cannot be asked at all.
   *
   * Not an empty result and not a failed request: there is nothing to retry and
   * no previous result set to keep, so the panel says so plainly and offers the
   * one thing that helps — the surfaces that do not need the catalogue.
   */
  const unavailablePanel = (
    <div className={styles.savedEmpty} role="alert" data-testid="catalogue-unavailable">
      <h3 className="type-h3">Shops are unavailable</h3>
      <p>
        The shop catalogue could not be reached, so there is nothing to show here
        yet. Nothing you have saved on this device has been affected.
      </p>
      {reviewer ? (
        <p className={styles.promptsNote}>
          Reviewer note: {catalogueModeDiagnostic(catalogue.resolution)}.
        </p>
      ) : null}
      <Link className={styles.savedEmptyLink} href="/about">
        About Nib Atlas
      </Link>
    </div>
  );

  const areaList = state.status === "unavailable" ? (
    unavailablePanel
  ) : (
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
        highlightedShopId={highlightedShopId}
        savedShopIds={collection.savedShopIds}
        visitedShopIds={collection.userShopState.visitedShopIds}
        truncated={state.truncated}
        onHighlight={handleHighlight}
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
            locatingSlug={locatingSlug}
            onChooseDestination={(viewport, label) => moveCamera(viewport, label)}
            onChooseShop={(shop: ShopMapSummary, viewport) => {
              moveCamera(viewport, shop.name);
              dispatch({ type: "selectShop", shopId: shop.id });
            }}
            onChooseShopSlug={focusShopBySlug}
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
              {/* Which catalogue supplier is live, so a tester can tell modes apart. */}
              <span className={styles.basemapDiagnostic} data-testid="catalogue-diagnostic">
                {catalogueModeDiagnostic(catalogue.resolution)}
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
          highlightedShopId={highlightedShopId}
          initialViewport={INITIAL_VIEWPORT}
          styleProvider={styleProvider}
          cameraTarget={cameraTarget}
          onSelectShop={handleSelect}
          onCameraSettled={onCameraSettled}
        />

        <div className={styles.searchAreaSlot}>
          <SearchThisArea
            mode={offerMode}
            onSearch={() =>
              dispatch(
                // Retry re-runs the query the visible results are under. Only an
                // offer commits the camera the reader has moved to.
                offerMode === "error" ? { type: "retryQuery" } : { type: "commitSearch" },
              )
            }
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
