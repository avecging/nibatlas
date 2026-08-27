"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PassportBook } from "@/src/components/passport/PassportBook";
import { PassportList } from "@/src/components/passport/PassportList";
import { StampDetailOverlay } from "@/src/components/passport/StampDetailOverlay";
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

  /*
   * Where the book opens.
   *
   * A requested destination wins, then the spread the reader left, then the
   * opening spread. A remembered place that no longer resolves — a locality
   * whose stamps were cleared, a record from another collection — falls through
   * to the opening spread rather than to an error.
   */
  const requestedPageIndex = useMemo(() => {
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

  const bookPageIndex =
    requestedPageIndex ?? pageIndexForPlace(pages, view.place) ?? OPENING_PAGE_INDEX;

  /*
   * List-mode scroll memory, for the overview only.
   *
   * A country or locality route is short and its own destination, so restoring
   * the overview's offset onto it would be actively wrong. `restoredRef` makes
   * the restore happen once per mount: re-running it on every scroll event would
   * fight the reader.
   */
  const restoredRef = useRef(false);
  const rememberScroll = view.rememberListScrollTop;
  const rememberOverviewScroll = target.kind === "all" && view.mode === "list";
  const savedScrollTop = view.listScrollTop;
  const ready = hydrated && view.hydrated;

  useEffect(() => {
    if (!ready || !rememberOverviewScroll || restoredRef.current) {
      return;
    }

    restoredRef.current = true;

    if (savedScrollTop > 0) {
      // After paint, so the document is tall enough to accept the offset.
      requestAnimationFrame(() => window.scrollTo({ top: savedScrollTop }));
    }
  }, [ready, rememberOverviewScroll, savedScrollTop]);

  useEffect(() => {
    if (!ready || !rememberOverviewScroll) {
      return;
    }

    let frame = 0;

    const onScroll = () => {
      if (frame !== 0) {
        return;
      }

      // One write per frame at most: a flung scroll fires far more events than
      // storage should see.
      frame = requestAnimationFrame(() => {
        frame = 0;
        rememberScroll(window.scrollY);
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);

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
