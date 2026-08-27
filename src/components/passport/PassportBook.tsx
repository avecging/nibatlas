"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { NibAtlasMark } from "@/src/components/brand/NibAtlasMark";
import { useMediaQuery } from "@/src/components/hooks/useMediaQuery";
import { PassportPageView } from "@/src/components/passport/PassportPageView";
import { Icon } from "@/src/components/ui/Icon";
import type { StampCollection } from "@/src/domain/passport";
import type { EarnedSeal } from "@/src/domain/seals";
import {
  canTurn,
  firstPosition,
  lastPosition,
  normalizePosition,
  rotationAt,
  settleDuration,
  shouldCompleteTurn,
  targetPosition,
  turnLayers,
  visiblePages,
  type BookGeometry,
  type BookMode,
  type TurnDirection,
  type TurnLayers,
} from "@/src/features/passport/book-controller";
import {
  INDEX_PAGE_INDEX,
  placeForPage,
  type PassportPage,
} from "@/src/features/passport/passport-pages";
import type { PassportPlace } from "@/src/features/passport/passport-view-state";

import styles from "./PassportBook.module.css";

/** Contemporary passport proportions, roughly 1:1.4 closed. */
const LEAF_WIDTH = 340;
const LEAF_HEIGHT = 476;
const COVER_OPEN_MS = 760;
const PAGE_TURN_MS = 560;
const DRAG_INTENT_PX = 12;

interface ActiveTurn {
  readonly direction: TurnDirection;
  readonly layers: TurnLayers;
  readonly interactive: boolean;
}

interface PassportBookProps {
  readonly pages: readonly PassportPage[];
  /**
   * Page to open at on mount: a deep-linked locality, the spread the reader
   * left, or the opening spread. Resolved by the screen, which owns the device's
   * memory — the book itself no longer persists anything.
   *
   * Read once. Later changes are ignored, because the screen derives it partly
   * from the *remembered* spread, and this component is what updates that
   * memory: honouring every change would make turning a page recompute a target
   * and turn again.
   */
  readonly initialPageIndex?: number | null;
  /**
   * A page the route is asking for, as opposed to one the reader was last on.
   *
   * Watched rather than read once, because it can arrive late: the collection
   * resolves from device storage after mount, so a Passport opened at a freshly
   * collected impression renders once before that locality exists.
   */
  readonly requestedPageIndex?: number | null;
  /**
   * Whether to skip the cover.
   *
   * False only on a first-ever Book visit with nothing specific requested,
   * which is the one time the cover opening plays. A deep link is always true:
   * a reader who asked for Ginza is not made to open a cover first.
   */
  readonly startOpen: boolean;
  /** Called once, the first time this device opens the cover. */
  readonly onCoverOpened?: (() => void) | undefined;
  /** Called with the settled spread, so the screen can remember it. */
  readonly onPlaceChange?: ((place: PassportPlace | null) => void) | undefined;
  /** Enlarges an impression. Same overlay as List mode. */
  readonly onSelectStamp: (collection: StampCollection) => void;
  /** Enlarges a derived seal, in that same overlay. */
  readonly onSelectSeal: (seal: EarnedSeal) => void;
}

/**
 * The Passport as an object.
 *
 * Desktop opens on a closed, thin passport at a restrained three-quarter angle,
 * hinges the cover on its bound edge, and settles into a full two-page spread
 * with a fixed central spine. Mobile uses the approved portrait single-page
 * reader — the manual sideways mode in
 * `docs/future/passport-sideways-reading-mode.md` is deliberately not here, and
 * nothing in this component depends on orientation, auto-rotate, or motion
 * sensors.
 *
 * Pointer drags, the pager buttons, and the keyboard all call `requestTurn`.
 * `turnRef` holds the transition in flight, and every entry point refuses while
 * it is set, so repeated input cannot interleave two turns or corrupt page order.
 */
export function PassportBook({
  pages,
  initialPageIndex = null,
  requestedPageIndex = null,
  startOpen,
  onCoverOpened,
  onPlaceChange,
  onSelectStamp,
  onSelectSeal,
}: PassportBookProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const mode: BookMode = isDesktop ? "spread" : "single";
  const geometry: BookGeometry = useMemo(
    () => ({ mode, pageCount: pages.length }),
    [mode, pages.length],
  );

  const headingPrefix = useId();
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<HTMLDivElement | null>(null);
  const leafRef = useRef<HTMLDivElement | null>(null);
  const turnRef = useRef<ActiveTurn | null>(null);
  const dragRef = useRef<{
    readonly startX: number;
    readonly startTime: number;
    progress: number;
    established: boolean;
  } | null>(null);
  const timers = useRef<number[]>([]);
  const pendingFocus = useRef<number | null>(null);

  const [pageIndex, setPageIndex] = useState(() => initialPageIndex ?? 0);
  const [opened, setOpened] = useState(startOpen);
  const [coverAnimating, setCoverAnimating] = useState(false);
  const [turn, setTurn] = useState<ActiveTurn | null>(null);
  const [scale, setScale] = useState(1);

  const position = normalizePosition(geometry, pageIndex);
  const settled = visiblePages(geometry, position);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);

    return id;
  }, []);

  useEffect(
    () => () => {
      for (const id of timers.current) {
        window.clearTimeout(id);
      }
    },
    [],
  );

  /*
   * A requested page can arrive late. The collection store hydrates from device
   * storage after mount, so a Passport opened at a freshly collected impression
   * renders once with a collection where that locality may not exist yet, and
   * only then learns the real target. Without this the reader would be left on
   * whatever page the first render chose.
   */
  const requestedPage = useRef<number | null>(requestedPageIndex);

  useEffect(() => {
    if (requestedPageIndex === null || requestedPageIndex === requestedPage.current) {
      return;
    }

    requestedPage.current = requestedPageIndex;
    pendingFocus.current = normalizePosition(geometry, requestedPageIndex);
    // Synchronising to a prop that resolves asynchronously upstream.
    setOpened(true);
    setPageIndex(requestedPageIndex);
  }, [geometry, requestedPageIndex]);

  /*
   * Report the settled spread upwards.
   *
   * Reported as content — a country, a locality, and an impression on the exact
   * page — rather than as a page number, so a collection that grows by one
   * impression does not silently move every remembered position along by a page.
   *
   * The right-hand page names the spread, because that is the page the reader
   * turned to. When it has nothing to name — the blank page a book always ends
   * on — the left page does, so a reader on the final spread is remembered as
   * being on its last real page rather than as being nowhere.
   */
  const settledPlace = opened
    ? (placeForPage(pages[position]) ??
      (mode === "spread" ? placeForPage(pages[position - 1]) : null))
    : null;
  const placeKey = settledPlace === null ? "" : JSON.stringify(settledPlace);

  useEffect(() => {
    if (!opened || placeKey === "") {
      return;
    }

    onPlaceChange?.(JSON.parse(placeKey) as PassportPlace);
  }, [onPlaceChange, opened, placeKey]);


  // Fit the book to the field. The object should read as an object, so it keeps
  // generous negative space rather than filling the panel.
  useLayoutEffect(() => {
    const field = fieldRef.current;

    if (!field) {
      return;
    }

    const measure = () => {
      const width = field.clientWidth;
      const height = field.clientHeight;

      if (width === 0 || height === 0) {
        return;
      }

      const bookWidth =
        mode === "spread" && opened ? LEAF_WIDTH * 2 : LEAF_WIDTH;
      const horizontalPad = mode === "spread" ? 96 : 32;
      const verticalPad = 132;

      // What actually fits, with room left over for the object to read as an
      // object rather than as a panel.
      const fits = Math.min(
        mode === "spread" ? 1.15 : 1.5,
        (width - horizontalPad) / bookWidth,
        (height - verticalPad) / LEAF_HEIGHT,
      );

      // Closed, the passport is sized as an object on a desk:
      // `docs/passport-interaction-spec.md` asks for roughly 38-52% of the
      // shorter content dimension. Open, the spread may take the room it needs
      // to stay readable.
      const closedFraction = mode === "spread" ? 0.46 : 0.62;
      const closedFit =
        (closedFraction * Math.min(width, height)) / LEAF_HEIGHT;

      setScale(Math.max(0.34, opened ? fits : Math.min(fits, closedFit)));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(field);

    return () => observer.disconnect();
  }, [mode, opened]);

  const focusPage = useCallback(
    (index: number) => {
      const id = `${headingPrefix}-page-${index}`;
      const heading = document.getElementById(id);

      heading?.focus({ preventScroll: true });
    },
    [headingPrefix],
  );

  // Focus lands on the new page heading once the leaf has settled, so a keyboard
  // or button turn moves the reading position rather than leaving focus behind.
  useEffect(() => {
    const target = pendingFocus.current;

    if (target === null) {
      return;
    }

    pendingFocus.current = null;
    focusPage(target);
  }, [focusPage, pageIndex]);

  const applyLeafTransform = useCallback((layers: TurnLayers, progress: number) => {
    const leaf = leafRef.current;

    if (!leaf) {
      return;
    }

    const rotation = rotationAt(layers, progress);
    // A shallow bend: the sheet is stiffest at the spine and loosest at its free
    // edge, so the bend peaks mid-turn and vanishes at both ends.
    const bend = Math.sin(Math.min(1, Math.max(0, progress)) * Math.PI) * 5;

    leaf.style.setProperty("--leaf-rotate", `${rotation}deg`);
    leaf.style.setProperty("--leaf-bend", `${layers.leafSide === "right" ? -bend : bend}deg`);
    leaf.style.setProperty("--leaf-progress", String(Math.min(1, Math.max(0, progress))));
  }, []);

  const commitTurn = useCallback(
    (direction: TurnDirection) => {
      const next = targetPosition(geometry, position, direction);

      turnRef.current = null;
      setTurn(null);
      pendingFocus.current = next;
      setPageIndex(next);
    },
    [geometry, position],
  );

  /**
   * Opening the cover.
   *
   * A second activation while the cover is mid-swing completes it rather than
   * queueing another opening, so repeated taps cannot stack transitions.
   */
  const openCover = useCallback(() => {
    if (opened) {
      return;
    }

    // Recorded on the first activation rather than when the swing finishes, so
    // a reader who navigates away mid-animation is not shown the cover again.
    onCoverOpened?.();

    if (coverAnimating) {
      setCoverAnimating(false);
      setOpened(true);
      pendingFocus.current = normalizePosition(geometry, pageIndex);
      return;
    }

    if (reducedMotion) {
      setOpened(true);
      pendingFocus.current = normalizePosition(geometry, pageIndex);
      return;
    }

    setCoverAnimating(true);
    schedule(() => {
      setCoverAnimating(false);
      setOpened(true);
      pendingFocus.current = normalizePosition(geometry, pageIndex);
    }, COVER_OPEN_MS);
  }, [
    coverAnimating,
    geometry,
    onCoverOpened,
    opened,
    pageIndex,
    reducedMotion,
    schedule,
  ]);

  /**
   * The single transition controller. Buttons, keyboard, and the end of a drag
   * all arrive here, and it is the only place a turn can start.
   */
  const requestTurn = useCallback(
    (direction: TurnDirection) => {
      if (turnRef.current || coverAnimating) {
        return;
      }

      if (!opened) {
        if (direction === 1) {
          openCover();
        }
        return;
      }

      const layers = turnLayers(geometry, position, direction);

      if (!layers) {
        return;
      }

      if (reducedMotion) {
        // No perspective rotation, no curl: the content changes immediately and
        // the page cross-fades in under 150 ms.
        const next = targetPosition(geometry, position, direction);
        pendingFocus.current = next;
        setPageIndex(next);
        return;
      }

      const active: ActiveTurn = { direction, layers, interactive: false };
      turnRef.current = active;
      setTurn(active);

      requestAnimationFrame(() => {
        const leaf = leafRef.current;

        if (!leaf) {
          commitTurn(direction);
          return;
        }

        applyLeafTransform(layers, 0);
        leaf.style.transition = `transform ${PAGE_TURN_MS}ms var(--ease-paper)`;

        requestAnimationFrame(() => applyLeafTransform(layers, 1));
        schedule(() => commitTurn(direction), PAGE_TURN_MS);
      });
    },
    [
      applyLeafTransform,
      commitTurn,
      coverAnimating,
      geometry,
      openCover,
      opened,
      position,
      reducedMotion,
      schedule,
    ],
  );

  const closeToCover = useCallback(() => {
    if (turnRef.current || coverAnimating) {
      return;
    }

    setOpened(false);
  }, [coverAnimating]);

  const jumpTo = useCallback(
    (index: number) => {
      if (turnRef.current || coverAnimating) {
        return;
      }

      // Contents is reachable from the cover, and using it is entering the book
      // just as much as opening the cover is — so it spends the first-run moment
      // rather than leaving the cover to reappear on the next visit.
      if (!opened) {
        onCoverOpened?.();
      }

      const next = normalizePosition(geometry, index);
      pendingFocus.current = next;
      setOpened(true);
      setPageIndex(next);
    },
    [coverAnimating, geometry, onCoverOpened, opened],
  );

  /* ---------------------------------------------------------------------- */
  /* Pointer drag                                                           */
  /* ---------------------------------------------------------------------- */

  const dragWidth = mode === "spread" ? LEAF_WIDTH * scale : LEAF_WIDTH * scale * 0.85;

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || turnRef.current || coverAnimating) {
      return;
    }

    if (!opened) {
      return;
    }

    // Never hijack a gesture that began on a link, a control, or scrollable
    // stamp content.
    if ((event.target as HTMLElement).closest("a, button, [data-no-drag]")) {
      return;
    }

    dragRef.current = {
      startX: event.clientX,
      startTime: event.timeStamp,
      progress: 0,
      established: false,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;

    if (!drag) {
      return;
    }

    const dx = event.clientX - drag.startX;

    if (!drag.established) {
      if (Math.abs(dx) < DRAG_INTENT_PX) {
        return;
      }

      const direction: TurnDirection = dx < 0 ? 1 : -1;

      if (!canTurn(geometry, position, direction)) {
        dragRef.current = null;
        return;
      }

      const layers = turnLayers(geometry, position, direction);

      if (!layers) {
        dragRef.current = null;
        return;
      }

      drag.established = true;
      const active: ActiveTurn = { direction, layers, interactive: true };
      turnRef.current = active;
      setTurn(active);
      // Pointer capture starts only once the intent to turn is established.
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    const active = turnRef.current;

    if (!active) {
      return;
    }

    const travelled = active.direction === 1 ? -dx : dx;
    drag.progress = Math.min(1, Math.max(0, (travelled - DRAG_INTENT_PX) / dragWidth));

    const leaf = leafRef.current;

    if (leaf) {
      leaf.style.transition = "none";
      applyLeafTransform(active.layers, drag.progress);
    }
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const active = turnRef.current;
    dragRef.current = null;

    if (!drag || !active || !drag.established) {
      return;
    }

    const elapsed = Math.max(16, event.timeStamp - drag.startTime);
    const velocity = (drag.progress / elapsed) * 1000;
    const complete = shouldCompleteTurn(drag.progress, velocity);
    const duration = settleDuration(drag.progress, complete);
    const leaf = leafRef.current;

    if (!leaf) {
      if (complete) {
        commitTurn(active.direction);
      } else {
        turnRef.current = null;
        setTurn(null);
      }
      return;
    }

    leaf.style.transition = `transform ${duration}ms var(--ease-paper)`;
    requestAnimationFrame(() => applyLeafTransform(active.layers, complete ? 1 : 0));

    schedule(() => {
      if (complete) {
        commitTurn(active.direction);
      } else {
        // A cancelled drag returns to its source state; nothing about the page
        // order changed.
        turnRef.current = null;
        setTurn(null);
      }
    }, duration);
  };

  /* ---------------------------------------------------------------------- */
  /* Rendering                                                              */
  /* ---------------------------------------------------------------------- */

  const renderPage = (index: number | null) => {
    if (index === null) {
      return null;
    }

    const page = pages[index];

    if (!page) {
      return null;
    }

    return (
      <PassportPageView
        key={page.id}
        page={page}
        headingId={`${headingPrefix}-page-${index}`}
        onSelectStamp={onSelectStamp}
        onSelectSeal={onSelectSeal}
        onJumpToPage={jumpTo}
      />
    );
  };

  const layers = turn?.layers ?? null;
  const leftPage = layers ? layers.staticLeft : settled.left;
  const rightPage = layers ? layers.staticRight : settled.right;

  const first = firstPosition(mode);
  const last = lastPosition(geometry);
  const currentPage = pages[position];
  const pageLabel =
    mode === "spread"
      ? `Pages ${position} and ${position + 1} of ${pages.length}`
      : `Page ${position + 1} of ${pages.length}`;

  return (
    <div className={styles.field} ref={fieldRef} data-opened={opened ? "true" : "false"}>
      <div
        className={styles.stage}
        style={{ "--book-scale": scale } as React.CSSProperties}
      >
        <div
          ref={bookRef}
          className={styles.book}
          data-mode={mode}
          data-opened={opened ? "true" : "false"}
          data-cover-animating={coverAnimating ? "true" : "false"}
          data-reduced-motion={reducedMotion ? "true" : "false"}
          style={
            {
              "--leaf-width": `${LEAF_WIDTH}px`,
              "--leaf-height": `${LEAF_HEIGHT}px`,
            } as React.CSSProperties
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* The page block: thin, with a visible fore-edge and stacked leaves. */}
          <div className={styles.block} aria-hidden="true" />

          {/*
            `inert` as well as `aria-hidden` while the book is closed.
            The opening spread now carries real controls — every impression on it
            is a button — and an `aria-hidden` subtree that is still focusable is
            a genuine trap: Tab would move focus onto a stamp the reader cannot
            see and no screen reader will announce.
          */}
          <div
            className={styles.spread}
            aria-hidden={opened ? undefined : true}
            inert={opened ? undefined : true}
          >
            <div className={styles.leafSlot} data-side="left">
              {mode === "spread" ? renderPage(leftPage) : null}
            </div>
            <div className={styles.gutter} aria-hidden="true" />
            <div className={styles.leafSlot} data-side="right">
              {renderPage(rightPage)}
            </div>
          </div>

          {layers ? (
            <div
              ref={leafRef}
              className={styles.turner}
              data-side={layers.leafSide}
              aria-hidden="true"
              // A leaf in flight is a picture of a page, for the same reason.
              inert
            >
              <div className={styles.turnerBend}>
                <div className={styles.turnerFace} data-face="front">
                  {renderPage(layers.leafFront)}
                  <span className={styles.leafShade} />
                </div>
                <div className={styles.turnerFace} data-face="back">
                  {renderPage(layers.leafBack)}
                  <span className={styles.leafShade} />
                </div>
              </div>
            </div>
          ) : null}

          {/*
            The cover. Its transform origin is the bound left edge, which is the
            spine, so opening rotates it around that edge in an arc: it never
            scales through zero, mirrors, dissolves, or spins about its centre.

            Structured the way a contemporary passport is: the issuing line at
            the top, the mark in the middle, PASSPORT below it, and the volume at
            the foot. WP3 removed the two decorative foil rules — "passports do
            not have borders" — and put textured stock and a debossed emboss in
            their place. No handwriting anywhere; the face is the same strong
            serif the rest of the Passport uses.
          */}
          <div className={styles.cover} aria-hidden="true">
            <div className={styles.coverFace} data-face="front">
              <span className={styles.coverStock} />
              <span className={styles.coverIssuer}>Nib Atlas</span>
              <span className={styles.coverInner}>
                <NibAtlasMark size={92} tone="single" className={styles.coverMark} />
                <span className={styles.coverTitle}>Passport</span>
              </span>
              <span className={styles.coverFoot}>Volume I</span>
            </div>
            <div className={styles.coverFace} data-face="inside" />
            <span className={styles.coverEdge} aria-hidden="true" />
          </div>
        </div>
      </div>

      {/*
        Two groups — where to jump, and how to turn — in one control strip. They
        wrap onto two rows at narrow widths rather than pushing the pager wider
        than a 360 px screen.
      */}
      <div
        aria-label="Passport pages"
        className={styles.pager}
        role="group"
      >
        <div className={styles.pagerGroup}>
          {/*
            One control, two states.
            
            It used to be two: a floating **Open Passport** button over the field
            and a **Cover** button in the pager, and at 360 px the floating one
            sat partly behind the pill. They are the same idea — the way between
            the cover and the pages — so they are now the same control in the same
            place. The accessible name stays *Open Passport* while the visible
            label is the shorter *Open*, which is the same word: enough room in
            the strip, and no ambiguity for a screen reader.
          */}
          <button
            aria-label={opened ? undefined : "Open Passport"}
            className={styles.pagerCover}
            type="button"
            onClick={opened ? closeToCover : openCover}
            disabled={coverAnimating}
          >
            <Icon name="passport" size={16} />
            {opened ? "Cover" : "Open"}
          </button>
          {/*
            The contents spread is one turn behind the opening spread, which is
            where a passport keeps its front matter. A labelled control means a
            reader looking for a country does not have to know that.
          */}
          <button
            className={styles.pagerCover}
            type="button"
            onClick={() => jumpTo(INDEX_PAGE_INDEX)}
            disabled={coverAnimating}
          >
            <Icon name="list" size={16} />
            Contents
          </button>
        </div>
        <span className={styles.pagerDivider} aria-hidden="true" />
        <div className={styles.pagerGroup}>
          <button
            className={styles.pagerButton}
            type="button"
            aria-label="Previous page"
            onClick={() => requestTurn(-1)}
            disabled={!opened || position <= first}
          >
            <Icon name="chevron-left" size={16} />
          </button>
          <span className={styles.pagerLabel} data-testid="passport-pager">
            {opened ? pageLabel : "Cover"}
          </span>
          <button
            className={styles.pagerButton}
            type="button"
            aria-label="Next page"
            onClick={() => requestTurn(1)}
            disabled={opened && position >= last}
          >
            <Icon name="chevron-right" size={16} />
          </button>
        </div>
      </div>

      {/*
        The keyboard route is the one thing here that is not visible in the
        interface, so it is the only thing the line says.
      */}
      {opened ? (
        <p className={styles.hint}>
          {reducedMotion
            ? "Arrow keys turn pages."
            : "Drag a page, or use the arrow keys."}
        </p>
      ) : null}

      {/* Politely announced so a turn is reported without interrupting. */}
      <p className={styles.announce} aria-live="polite">
        {opened && currentPage
          ? `${pageLabel}. ${currentPage.runningHead || "Passport"}.`
          : "Passport closed."}
      </p>

      <KeyboardBridge
        onPrevious={() => requestTurn(-1)}
        onNext={() => requestTurn(1)}
        onFirst={() => jumpTo(first)}
        onLast={() => jumpTo(last)}
        fieldRef={fieldRef}
      />
    </div>
  );
}

/**
 * Arrow-key navigation for the whole Passport region.
 *
 * Bound on the field rather than on a single element so the keys work wherever
 * focus sits inside the book — a page heading, a stamp link, or a pager button.
 */
function KeyboardBridge({
  onPrevious,
  onNext,
  onFirst,
  onLast,
  fieldRef,
}: {
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onFirst: () => void;
  readonly onLast: () => void;
  readonly fieldRef: React.RefObject<HTMLDivElement | null>;
}) {
  useEffect(() => {
    const field = fieldRef.current;

    if (!field) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          onPrevious();
          break;
        case "ArrowRight":
          event.preventDefault();
          onNext();
          break;
        case "Home":
          event.preventDefault();
          onFirst();
          break;
        case "End":
          event.preventDefault();
          onLast();
          break;
        default:
          break;
      }
    };

    field.addEventListener("keydown", onKeyDown);

    return () => field.removeEventListener("keydown", onKeyDown);
  }, [fieldRef, onFirst, onLast, onNext, onPrevious]);

  return null;
}
