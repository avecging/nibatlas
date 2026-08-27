"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PassportBook } from "@/src/components/passport/PassportBook";
import { PassportList } from "@/src/components/passport/PassportList";
import { StampDetailOverlay } from "@/src/components/passport/StampDetailOverlay";
import { PASSPORT_ANCHOR_PARAM } from "@/src/components/shops/ShopBackLink";
import { ButtonLink } from "@/src/components/ui/Button";
import { Icon } from "@/src/components/ui/Icon";
import type { CountryCode } from "@/src/domain/geo";
import {
  findPassportCountry,
  findPassportLocality,
  type StampCollection,
} from "@/src/domain/passport";
import { useAccountSession } from "@/src/features/account/AccountSessionProvider";
import { useCollection } from "@/src/features/collection/collection-store";
import { noopTelemetry } from "@/src/features/map/telemetry";
import {
  buildPassportPages,
  OPENING_PAGE_INDEX,
  pageIndexForCollection,
  pageIndexForCountry,
  pageIndexForLocality,
  pageIndexForPlace,
} from "@/src/features/passport/passport-pages";
import { usePassportView } from "@/src/features/passport/use-passport-view";

import styles from "./PassportScreen.module.css";

/**
 * The Passport, in two modes over one collection.
 *
 * `/passport`, `/passport/[country]` and `/passport/[country]/[locality]` all
 * render this screen. The route decides *what* is shown; the reader's remembered
 * choice decides *how*. That is why the three routes are no longer three views:
 * a country is the same collection, narrowed, and it has to be narrowed in
 * whichever mode the reader last used.
 *
 * What this component owns:
 *
 * - the List / Book toggle, and writing the reader's choice down;
 * - resolving a requested country or locality, including one that no longer
 *   exists;
 * - where the book opens: a deep link, the spread the reader left, or the
 *   opening spread;
 * - the enlarged stamp overlay, which is identical in both modes;
 * - List mode's scroll position across a trip to a shop and back.
 */
/**
 * How many consecutive frames a restored List offset has to hold before the
 * restoration lets go.
 *
 * One frame is not enough: the router scrolls a new route to the top *after* the
 * render commits, so an offset can be applied, read back correctly, and then be
 * undone. Waiting for it to hold catches that whenever it lands, on a fast
 * machine or a loaded one, which a fixed time budget does not.
 */
const SCROLL_RESTORE_HOLD_FRAMES = 3;

/**
 * The most frames a restoration may run for.
 *
 * A backstop for a list that genuinely cannot scroll that far — a collection that
 * shrank, say — so the loop ends instead of re-applying for ever.
 */
const SCROLL_RESTORE_MAX_FRAMES = 30;

/** What tells us the reader has taken over, so the restoration should stop. */
const USER_SCROLL_INTENT = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

export type PassportTarget =
  | { readonly kind: "all" }
  | { readonly kind: "country"; readonly country: string }
  | {
      readonly kind: "locality";
      readonly country: string;
      readonly locality: string;
    };

/**
 * The one frame before the device's own state has been read.
 *
 * Local state resolves in a mount effect, so the first paint knows neither the
 * collection nor the chosen mode. Rendering either guess would tell someone with
 * six stamps that their Passport is empty, or open the book on a reader who
 * chose the list.
 */
function PassportSettling() {
  return (
    <div className={styles.settling}>
      <p role="status">Opening your Passport…</p>
    </div>
  );
}

function PassportMissing({
  title,
}: {
  readonly title: string;
}) {
  return (
    <div className={styles.notice}>
      <h1 className={styles.noticeTitle}>{title}</h1>
      <ButtonLink href="/passport" variant="primary">
        Open Passport
      </ButtonLink>
    </div>
  );
}

/** Nothing collected. No fake stamps, no locked silhouettes, no history. */
function PassportEmpty() {
  return (
    <div className={styles.notice}>
      <h1 className={styles.noticeTitle}>No stamps collected yet</h1>
      <p className={styles.noticeLine}>
        Atlas Stamps are collected at the shop itself.
      </p>
      <ButtonLink href="/" variant="primary">
        Explore the map
      </ButtonLink>
    </div>
  );
}

export function PassportScreen({ target }: { readonly target: PassportTarget }) {
  const { passport, seals, countryProgress, hydrated } = useCollection();
  const { session } = useAccountSession();
  const view = usePassportView();
  /*
   * The page a returning reader asked for, by the id of an impression on it.
   *
   * The route can name a locality but not a page inside it, and a locality with
   * more than four impressions has several. `ShopBackLink` is the only thing
   * that sets this, and it validates the whole href before it does.
   *
   * Read from the URL at mount rather than through `useSearchParams`, which
   * would take the statically prerendered `/passport` route out of static
   * rendering for a parameter that only ever arrives on a client navigation.
   * There is no hydration mismatch: nothing below renders until the device's own
   * state has resolved, and the server render is the settling state either way.
   */
  const [anchorParam] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get(PASSPORT_ANCHOR_PARAM),
  );

  const [detail, setDetail] = useState<StampCollection | null>(null);
  const closeDetail = useCallback(() => setDetail(null), []);

  const displayName =
    session.status === "signed-in" ? session.displayName : null;

  const pages = useMemo(
    () => buildPassportPages({ passport, seals, countryProgress, displayName }),
    [countryProgress, displayName, passport, seals],
  );

  useEffect(() => {
    noopTelemetry.record("passport_opened", { surface: target.kind });
  }, [target.kind]);

  const countryView =
    target.kind === "all" ? undefined : findPassportCountry(passport, target.country);
  const localityView =
    target.kind === "locality" && countryView
      ? findPassportLocality(countryView, target.locality)
      : undefined;

  /** Whether a page is inside what the route asked for. */
  const withinRoute = useCallback(
    (index: number | null) => {
      if (index === null) {
        return false;
      }

      const page = pages[index];

      if (page?.kind !== "locality") {
        return false;
      }

      return (
        (!countryView || page.countryCode === countryView.countryCode) &&
        (!localityView || page.localitySlug === localityView.slug)
      );
    },
    [countryView, localityView, pages],
  );

  /**
   * The page an explicit `?stamp=` asked for.
   *
   * Dropped when it does not agree with the route it arrived on, so a stale or
   * hand-edited id cannot send a reader who asked for Ginza to Kaohsiung — the
   * same thing that happens when the impression has since been cleared.
   */
  const anchoredPageIndex = useMemo(() => {
    const anchored = anchorParam ? pageIndexForCollection(pages, anchorParam) : null;

    return withinRoute(anchored) ? anchored : null;
  }, [anchorParam, pages, withinRoute]);

  /** The first page of whatever the route names, with no memory involved. */
  const routePageIndex = useMemo(() => {
    if (localityView && countryView) {
      return pageIndexForLocality(
        pages,
        countryView.countryCode as CountryCode,
        localityView.slug,
      );
    }

    if (countryView) {
      return pageIndexForCountry(pages, countryView.countryCode as CountryCode);
    }

    return null;
  }, [countryView, localityView, pages]);

  /**
   * What the route is asking for, watched by the book.
   *
   * Deliberately free of the remembered place. The book reports the spread it
   * settles on and the screen writes that down, so a prop derived from the
   * record would change as the reader turns pages and turn them again — or drag
   * them back inside a locality they had just read past.
   */
  const requestedPageIndex = anchoredPageIndex ?? routePageIndex;

  const rememberedPageIndex = pageIndexForPlace(pages, view.place);

  /**
   * Where the book opens, read once at mount.
   *
   * In order: the page an anchor named, then the remembered page *when it is
   * inside what the route asked for* — a reload while reading a locality's
   * second page asks for the locality, and the record is the same destination
   * only more precise — then the route's own first page, then the remembered
   * page wherever it is, then the opening spread. A remembered place that no
   * longer resolves falls through rather than erroring.
   */
  const bookPageIndex =
    anchoredPageIndex ??
    (routePageIndex !== null && withinRoute(rememberedPageIndex)
      ? rememberedPageIndex
      : null) ??
    routePageIndex ??
    rememberedPageIndex ??
    OPENING_PAGE_INDEX;

  /*
   * List-mode scroll memory, for the overview only.
   *
   * A country or locality route is short and its own destination, so restoring
   * the overview's offset onto it would be actively wrong.
   *
   * The restore happens once per *visit* to the overview list, not once per
   * mount. Switching to Book and back is one component instance, and Book's
   * short document clamps `window.scrollY` on the way out — so a latch that was
   * only ever set would leave the reader at the top, or at whatever the clamp
   * left behind. Leaving the overview list re-arms it.
   */
  const rememberScroll = view.rememberListScrollTop;
  const rememberOverviewScroll = target.kind === "all" && view.mode === "list";
  const ready = hydrated && view.hydrated;

  /**
   * The offset to restore to, mirrored so the restore effect does not depend on
   * it — it changes on every scroll, and re-running the restore then would fight
   * the reader. Declared before the restore effect so it is already in step on
   * the commit that hydration lands in.
   */
  const rememberedScrollRef = useRef(0);
  const restoredRef = useRef(false);
  const restoringRef = useRef(false);

  useEffect(() => {
    rememberedScrollRef.current = view.listScrollTop;
  }, [view.listScrollTop]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!rememberOverviewScroll) {
      // Book mode, or a country or locality route. Coming back is a new visit.
      restoredRef.current = false;
      return;
    }

    if (restoredRef.current) {
      return;
    }

    restoredRef.current = true;

    const offset = rememberedScrollRef.current;

    if (offset <= 0) {
      return;
    }

    /*
     * Applied, then watched until it holds.
     *
     * Two things undo a single attempt. The list has to be tall enough to accept
     * the offset, and on the frame a mode change commits it is not yet — the
     * browser clamps to the document it currently has. And the App Router scrolls
     * a new route to the top *after* the render commits, so an offset can be
     * applied, read back correctly, and then be undone.
     *
     * So each frame either re-applies the offset or counts it as holding, and the
     * loop ends once it has held for a few frames running. That reacts to when
     * those two things actually happen rather than guessing how long they take,
     * which is what makes it behave the same on a loaded machine as on an idle
     * one.
     *
     * Genuine input belongs to the reader, so it cancels the rest of the loop
     * rather than being overridden.
     */
    let frame = 0;
    let ticks = 0;
    let held = 0;
    restoringRef.current = true;

    const stop = () => {
      if (frame !== 0) {
        cancelAnimationFrame(frame);
        frame = 0;
      }

      restoringRef.current = false;

      for (const type of USER_SCROLL_INTENT) {
        window.removeEventListener(type, stop);
      }
    };

    const step = () => {
      ticks += 1;

      if (Math.abs(window.scrollY - offset) > 2) {
        window.scrollTo({ top: offset });
        held = 0;
      } else {
        held += 1;
      }

      if (held >= SCROLL_RESTORE_HOLD_FRAMES || ticks >= SCROLL_RESTORE_MAX_FRAMES) {
        frame = 0;
        stop();
        return;
      }

      frame = requestAnimationFrame(step);
    };

    for (const type of USER_SCROLL_INTENT) {
      window.addEventListener(type, stop, { passive: true });
    }

    frame = requestAnimationFrame(step);

    return stop;
  }, [ready, rememberOverviewScroll]);

  useEffect(() => {
    if (!ready || !rememberOverviewScroll) {
      return;
    }

    let frame = 0;
    /*
     * Recording stops the moment a navigation starts.
     *
     * The App Router scrolls the page to the top as it begins a navigation, and
     * it does so *before* the URL changes and before this component unmounts —
     * so the listener is still attached and would record 0 over the reader's
     * real position. Every navigation out of the list begins with a click on a
     * link or with Back, so those are what disarm it. Coming back to the list is
     * a new visit and re-arms it, because this effect runs again.
     */
    let leaving = false;

    const stopRecording = () => {
      leaving = true;
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;

      if (target instanceof Element && target.closest("a[href]")) {
        stopRecording();
      }
    };

    const onScroll = () => {
      // A restore in flight is this component moving the page, not the reader.
      // Recording it would write the clamped offset over the one being restored.
      if (frame !== 0 || restoringRef.current || leaving) {
        return;
      }

      // One write per frame at most: a flung scroll fires far more events than
      // storage should see.
      frame = requestAnimationFrame(() => {
        frame = 0;

        if (leaving) {
          return;
        }

        rememberScroll(window.scrollY);
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", stopRecording);
    document.addEventListener("click", onClick, true);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", stopRecording);
      document.removeEventListener("click", onClick, true);

      if (frame !== 0) {
        cancelAnimationFrame(frame);
      }
    };
  }, [ready, rememberOverviewScroll, rememberScroll]);

  if (!ready) {
    return <PassportSettling />;
  }

  if (target.kind !== "all" && !countryView) {
    return <PassportMissing title="Nothing collected in this country yet" />;
  }

  if (target.kind === "locality" && !localityView) {
    return <PassportMissing title="Nothing collected in this locality yet" />;
  }

  const backHref =
    target.kind === "all"
      ? "/passport"
      : target.kind === "country"
        ? `/passport/${target.country.toLowerCase()}`
        : `/passport/${target.country.toLowerCase()}/${target.locality.toLowerCase()}`;

  const focus =
    localityView && countryView
      ? ({ kind: "locality", country: countryView, locality: localityView } as const)
      : countryView
        ? ({ kind: "country", country: countryView } as const)
        : ({ kind: "all" } as const);

  return (
    <div className={styles.screen} data-passport-mode={view.mode}>
      <div className={styles.toolbar}>
        {/*
          List on the left, Book on the right. Two buttons rather than a
          radiogroup: each one is a control that switches the view immediately,
          and `aria-pressed` is what says which view is showing.
        */}
        <div aria-label="Passport view" className={styles.toggle} role="group">
          <button
            aria-pressed={view.mode === "list"}
            className={styles.toggleButton}
            onClick={() => view.chooseMode("list")}
            type="button"
          >
            <Icon name="list" size={16} />
            List
          </button>
          <button
            aria-pressed={view.mode === "book"}
            className={styles.toggleButton}
            onClick={() => view.chooseMode("book")}
            type="button"
          >
            <Icon name="book" size={16} />
            Book
          </button>
        </div>
      </div>

      {/*
        Nothing collected reads the same in both modes. An empty book is a real
        object with real pages, but it cannot offer the one thing this state
        needs to offer, which is the way to the map.
      */}
      {passport.stampCount === 0 ? (
        <PassportEmpty />
      ) : view.mode === "list" ? (
        <PassportList
          focus={focus}
          onSelectStamp={setDetail}
          passport={passport}
          seals={seals}
        />
      ) : (
        <PassportBook
          initialPageIndex={bookPageIndex}
          requestedPageIndex={requestedPageIndex}
          onCoverOpened={view.markCoverSeen}
          onPlaceChange={view.rememberPlace}
          onSelectStamp={setDetail}
          pages={pages}
          // A deep link opens where it was asked to. The cover ceremony is for
          // a first visit to the Passport itself, not for a reader who followed
          // a link to Ginza.
          startOpen={requestedPageIndex !== null || view.coverSeen}
        />
      )}

      <StampDetailOverlay
        collection={detail}
        onClose={closeDetail}
        returnHref={backHref}
      />
    </div>
  );
}
