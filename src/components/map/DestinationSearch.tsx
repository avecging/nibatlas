"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Icon } from "@/src/components/ui/Icon";
import type { Viewport } from "@/src/domain/geo";
import type { ShopMapSummary } from "@/src/domain/shops";
import {
  MIN_SEARCH_QUERY_LENGTH,
  type DestinationGeocoder,
  type SearchResults,
} from "@/src/features/map/destination-geocoder";

import styles from "./DestinationSearch.module.css";

type Option =
  | {
      readonly kind: "destination";
      readonly id: string;
      readonly title: string;
      readonly localTitle?: string;
      readonly localTitleLang?: string;
      readonly searchLabel: string;
      readonly subtitle: string;
      readonly viewport: Viewport;
    }
  | {
      readonly kind: "shop";
      readonly id: string;
      readonly slug: string;
      readonly title: string;
      readonly subtitle: string;
      /**
       * Present only for a hit the supplier could already place. Canonical
       * search returns records without coordinates, so choosing one of those
       * asks the caller to resolve the position before the map moves.
       */
      readonly target?: { readonly shop: ShopMapSummary; readonly viewport: Viewport };
    };

interface DestinationSearchProps {
  readonly geocoder: DestinationGeocoder;
  readonly onChooseDestination: (viewport: Viewport, label: string) => void;
  readonly onChooseShop: (shop: ShopMapSummary, viewport: Viewport) => void;
  /** Chosen canonical shop whose position still has to be resolved. */
  readonly onChooseShopSlug?: (slug: string) => void;
  /** The slug currently being placed, so the panel can say it is working. */
  readonly locatingSlug?: string | null;
  readonly onSearched?: (queryLength: number) => void;
}

const EMPTY: SearchResults = { destinations: [], shops: [] };

export function DestinationSearch({
  geocoder,
  onChooseDestination,
  onChooseShop,
  onChooseShopSlug,
  locatingSlug = null,
  onSearched,
}: DestinationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  /**
   * The query whose results were already applied by choosing them. Compared
   * rather than consumed, so an unrelated re-render cannot let the search fire
   * again and reopen the panel over the map the user has just moved.
   */
  const appliedQuery = useRef<string | null>(null);
  const onSearchedRef = useRef(onSearched);
  const listboxId = useId();

  useEffect(() => {
    onSearchedRef.current = onSearched;
  });

  useEffect(() => {
    let cancelled = false;
    const trimmed = query.trim();

    if (trimmed.length < MIN_SEARCH_QUERY_LENGTH) {
      return;
    }

    // Choosing a result writes its label into the field. That is not a new
    // search, and re-running one would reopen the panel over the map the moment
    // the user had finished with it.
    if (appliedQuery.current === trimmed) {
      return;
    }

    const controller = new AbortController();

    /*
     * Debounced so the supplier is not called on every keystroke, and aborted
     * on the next one so an in-flight search for `Gin` cannot land over the
     * results for `Ginza`. `cancelled` guards the state write as well, because
     * a supplier that does not honour the signal must still not be able to
     * repaint a panel the reader has moved past.
     */
    const timer = setTimeout(() => {
      void geocoder
        .search(trimmed, controller.signal)
        .then((next) => {
          if (cancelled) {
            return;
          }

          setResults(next);
          setFailed(false);
          // Opened even with no matches, so "nothing found" is stated rather
          // than silently doing nothing. Dismissing it is a tap outside.
          setOpen(true);
          setActiveIndex(-1);
          onSearchedRef.current?.(trimmed.length);
        })
        .catch(() => {
          if (cancelled) {
            return;
          }

          // A failed search says so. Silently showing the previous query's
          // results would be worse than an empty panel.
          setResults(EMPTY);
          setFailed(true);
          setOpen(true);
          setActiveIndex(-1);
        });
    }, 180);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [geocoder, query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  // A query shorter than the minimum shows nothing without clearing state in an
  // effect.
  const activeResults =
    query.trim().length < MIN_SEARCH_QUERY_LENGTH ? EMPTY : results;

  const options = useMemo<readonly Option[]>(
    () => [
      ...activeResults.destinations.map<Option>((destination) => ({
        kind: "destination",
        id: destination.id,
        title: destination.name,
        ...(destination.localName === undefined
          ? {}
          : {
              localTitle: destination.localName,
              ...(destination.localNameLang === undefined
                ? {}
                : { localTitleLang: destination.localNameLang }),
            }),
        searchLabel: destination.localName
          ? `${destination.name} · ${destination.localName}`
          : destination.name,
        subtitle: destination.context,
        viewport: destination.viewport,
      })),
      ...activeResults.shops.map<Option>((hit) => ({
        kind: "shop",
        id: hit.id,
        slug: hit.slug,
        title: hit.name,
        subtitle: hit.matchedAlias
          ? `${hit.localityName} · Shop in the Nib Atlas catalogue · matched “${hit.matchedAlias}”`
          : `${hit.localityName} · Shop in the Nib Atlas catalogue`,
        ...(hit.target === undefined ? {} : { target: hit.target }),
      })),
    ],
    [activeResults],
  );

  function choose(option: Option) {
    const label = option.kind === "destination" ? option.searchLabel : option.title;

    appliedQuery.current = label.trim();
    setOpen(false);
    setQuery(label);
    inputRef.current?.blur();

    if (option.kind === "destination") {
      onChooseDestination(option.viewport, option.title);
      return;
    }

    if (option.target) {
      onChooseShop(option.target.shop, option.target.viewport);
      return;
    }

    // A canonical hit with no coordinates. The caller resolves it, so the panel
    // never guesses a position to move the map to.
    onChooseShopSlug?.(option.slug);
  }

  const hasResults = options.length > 0;
  const activeOption = activeIndex >= 0 ? options[activeIndex] : undefined;

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <div className={styles.field}>
        <Icon name="search" size={20} />
        <input
          ref={inputRef}
          className={styles.input}
          type="search"
          role="combobox"
          aria-expanded={open && hasResults}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-label="Search shops or places"
          placeholder="Search shops or places"
          value={query}
          {...(activeOption ? { "aria-activedescendant": `${listboxId}-${activeOption.id}` } : {})}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (hasResults) {
              setOpen(true);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && hasResults) {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => (index + 1) % options.length);
            } else if (event.key === "ArrowUp" && hasResults) {
              event.preventDefault();
              setActiveIndex((index) => (index <= 0 ? options.length - 1 : index - 1));
            } else if (event.key === "Enter") {
              const option = activeIndex >= 0 ? options[activeIndex] : options[0];
              if (open && option) {
                event.preventDefault();
                choose(option);
              }
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {query ? (
          <button
            type="button"
            className={styles.clear}
            aria-label="Clear search"
            onClick={() => {
              appliedQuery.current = null;
              setQuery("");
              setResults(EMPTY);
              setFailed(false);
              setOpen(false);
              inputRef.current?.focus();
            }}
          >
            <Icon name="close" size={18} />
          </button>
        ) : null}
      </div>

      {/*
        Placing a chosen shop happens after the panel has closed, so the status
        lives outside it. A canonical search hit carries no coordinates, and the
        reader deserves to know the tap was received while the position is
        resolved.
      */}
      {locatingSlug === null ? null : (
        <p className={styles.locating} role="status">
          Locating that shop on the map…
        </p>
      )}

      {open ? (
        <div className={styles.panel}>
          {/*
            A listbox may contain options and groups, and nothing else.
            Milestone 1 built the panel out of `li` elements inside a
            `role="listbox"` `ul`, which axe rejects twice over: a list item
            whose parent is no longer a list, and a listbox whose children are
            not all options. Group headings were `li` too, so the two labels
            were announced as if they were choosable results.

            So the panel is groups of options, and each group is named by
            `aria-label`. The visible heading stays — places and shops must be
            distinguishable at a glance — but it is `aria-hidden`, because the
            group already carries that name and hearing it twice is noise.
          */}
          <div id={listboxId} role="listbox" aria-label="Search results">
            {activeResults.destinations.length > 0 ? (
              <div role="group" aria-label="Places">
                <p
                  className={`${styles.groupLabel} ${styles.destinationKind}`}
                  aria-hidden="true"
                >
                  Places
                </p>
                {options
                  .filter((option) => option.kind === "destination")
                  .map((option) => (
                    <div
                      key={option.id}
                      id={`${listboxId}-${option.id}`}
                      role="option"
                      className={`${styles.option} ${styles.optionPlace}`}
                      aria-selected={activeOption?.id === option.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(option)}
                    >
                      <span className={styles.optionIcon} aria-hidden="true">
                        <Icon name="map" size={18} />
                      </span>
                      <span className={styles.optionTitle}>
                        {option.title}
                        {option.localTitle ? (
                          <>
                            {" · "}
                            <span lang={option.localTitleLang} dir="auto">
                              {option.localTitle}
                            </span>
                          </>
                        ) : null}
                      </span>
                      <span className={styles.optionMeta}>Place · {option.subtitle}</span>
                    </div>
                  ))}
              </div>
            ) : null}

            {activeResults.shops.length > 0 ? (
              <div role="group" aria-label="Shops">
                <p
                  className={`${styles.groupLabel} ${styles.shopKind}`}
                  aria-hidden="true"
                >
                  Shops
                </p>
                {options
                  .filter((option) => option.kind === "shop")
                  .map((option) => (
                    <div
                      key={option.id}
                      id={`${listboxId}-${option.id}`}
                      role="option"
                      className={`${styles.option} ${styles.optionShop}`}
                      aria-selected={activeOption?.id === option.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(option)}
                    >
                      <span className={styles.optionIcon} aria-hidden="true">
                        <Icon name="seal" size={18} />
                      </span>
                      <span className={styles.optionTitle}>{option.title}</span>
                      <span className={styles.optionMeta}>{option.subtitle}</span>
                    </div>
                  ))}
              </div>
            ) : null}
          </div>

          {/*
            Outside the listbox: a sentence is neither an option nor a group, and
            putting it inside would make the listbox's children invalid again.
          */}
          {!hasResults ? (
            <p className={styles.empty}>
              {failed
                ? "Search is unavailable right now. Try again in a moment."
                : "No places or catalogue shops match that search."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
