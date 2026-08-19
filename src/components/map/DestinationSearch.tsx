"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Icon } from "@/src/components/ui/Icon";
import type { Viewport } from "@/src/domain/geo";
import type { ShopMapSummary } from "@/src/domain/shops";
import type {
  DestinationGeocoder,
  SearchResults,
} from "@/src/features/map/destination-geocoder";

import styles from "./DestinationSearch.module.css";

type Option =
  | { readonly kind: "destination"; readonly id: string; readonly title: string; readonly subtitle: string; readonly viewport: Viewport }
  | { readonly kind: "shop"; readonly id: string; readonly title: string; readonly subtitle: string; readonly viewport: Viewport; readonly shop: ShopMapSummary };

interface DestinationSearchProps {
  readonly geocoder: DestinationGeocoder;
  readonly onChooseDestination: (viewport: Viewport, label: string) => void;
  readonly onChooseShop: (shop: ShopMapSummary, viewport: Viewport) => void;
  readonly onSearched?: (queryLength: number) => void;
}

const EMPTY: SearchResults = { destinations: [], shops: [] };

export function DestinationSearch({
  geocoder,
  onChooseDestination,
  onChooseShop,
  onSearched,
}: DestinationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();

  useEffect(() => {
    let cancelled = false;
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      return;
    }

    // Debounced so the geocoder is not called on every keystroke.
    const timer = setTimeout(() => {
      void geocoder.search(trimmed).then((next) => {
        if (cancelled) {
          return;
        }

        setResults(next);
        setOpen(true);
        setActiveIndex(-1);
        onSearched?.(trimmed.length);
      });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [geocoder, onSearched, query]);

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
  const activeResults = query.trim().length < 2 ? EMPTY : results;

  const options = useMemo<readonly Option[]>(
    () => [
      ...activeResults.destinations.map<Option>((destination) => ({
        kind: "destination",
        id: destination.id,
        title: destination.localName
          ? `${destination.name} · ${destination.localName}`
          : destination.name,
        subtitle: destination.context,
        viewport: destination.viewport,
      })),
      ...activeResults.shops.map<Option>((result) => ({
        kind: "shop",
        id: result.shop.id,
        title: result.shop.name,
        subtitle: `${result.shop.localityName} · Nib Atlas shop`,
        viewport: result.viewport,
        shop: result.shop,
      })),
    ],
    [activeResults],
  );

  function choose(option: Option) {
    setOpen(false);
    setQuery(option.kind === "destination" ? option.title : option.title);
    inputRef.current?.blur();

    if (option.kind === "destination") {
      onChooseDestination(option.viewport, option.title);
    } else {
      onChooseShop(option.shop, option.viewport);
    }
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
          aria-label="Search a destination or shop"
          placeholder="Search a city, area, or shop"
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
              setQuery("");
              setResults(EMPTY);
              setOpen(false);
              inputRef.current?.focus();
            }}
          >
            <Icon name="close" size={18} />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className={styles.panel}>
          <ul id={listboxId} role="listbox" aria-label="Search results">
            {activeResults.destinations.length > 0 ? (
              <li>
                <p className={`${styles.groupLabel} ${styles.destinationKind}`}>Destinations</p>
              </li>
            ) : null}
            {options
              .filter((option) => option.kind === "destination")
              .map((option) => (
                <li
                  key={option.id}
                  id={`${listboxId}-${option.id}`}
                  role="option"
                  className={styles.option}
                  aria-selected={activeOption?.id === option.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                >
                  <span className={styles.optionTitle}>{option.title}</span>
                  <span className={styles.optionMeta}>{option.subtitle}</span>
                </li>
              ))}

            {activeResults.shops.length > 0 ? (
              <li>
                <p className={`${styles.groupLabel} ${styles.shopKind}`}>Nib Atlas shops</p>
              </li>
            ) : null}
            {options
              .filter((option) => option.kind === "shop")
              .map((option) => (
                <li
                  key={option.id}
                  id={`${listboxId}-${option.id}`}
                  role="option"
                  className={styles.option}
                  aria-selected={activeOption?.id === option.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                >
                  <span className={styles.optionTitle}>{option.title}</span>
                  <span className={styles.optionMeta}>{option.subtitle}</span>
                </li>
              ))}

            {!hasResults ? (
              <li className={styles.empty}>No destinations or demo shops match that search.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
