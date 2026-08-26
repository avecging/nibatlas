"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";

import { PassportBook } from "@/src/components/passport/PassportBook";
import { ButtonLink } from "@/src/components/ui/Button";
import { countrySlug } from "@/src/domain/passport";
import type { CountryCode } from "@/src/domain/geo";
import { useCollection } from "@/src/features/collection/collection-store";
import { noopTelemetry } from "@/src/features/map/telemetry";
import {
  buildPassportPages,
  pageIndexForLocality,
} from "@/src/features/passport/passport-pages";

import styles from "./Passport.module.css";

/**
 * Passport is one book.
 *
 * The overview, a country, and a locality are all the same volume opened at a
 * different page — there is no separate list screen to keep in sync, and no
 * Recent Impressions anywhere. `docs/future/passport-library.md` records the
 * multiple-volume Library as a later idea; nothing here anticipates it.
 */
function usePassportPages() {
  const { passport, seals, countryProgress } = useCollection();

  return useMemo(
    () => buildPassportPages({ passport, seals, countryProgress }),
    [countryProgress, passport, seals],
  );
}

function PassportEmpty() {
  return (
    <div className={styles.empty}>
      <h1 className={styles.emptyTitle}>Your Passport is empty</h1>
      <p>
        Atlas Stamps are collected at the shop itself. Find a shop on the map, go
        there, and collect the stamp while you are standing in it.
      </p>
      <p className={styles.emptyNote}>
        Nothing is recorded automatically, and nothing here is visible to anyone
        else.
      </p>
      <ButtonLink href="/" variant="primary">
        Explore the map
      </ButtonLink>
    </div>
  );
}

export function PassportOverviewView() {
  const { passport } = useCollection();
  const pages = usePassportPages();

  useEffect(() => {
    noopTelemetry.record("passport_opened", { surface: "overview" });
  }, []);

  if (passport.stampCount === 0) {
    return <PassportEmpty />;
  }

  return (
    <>
      <h1 className="visually-hidden">Passport</h1>
      <PassportBook pages={pages} />
    </>
  );
}

export function PassportCountryView({ country }: { readonly country: string }) {
  const { passport } = useCollection();
  const pages = usePassportPages();

  const view = passport.countries.find(
    (candidate) => candidate.slug === country.toLowerCase(),
  );

  const firstLocality = view?.localities[0];
  const target =
    view && firstLocality
      ? pageIndexForLocality(pages, view.countryCode, firstLocality.slug)
      : null;

  if (!view) {
    return (
      <div className={styles.empty}>
        <h1 className={styles.emptyTitle}>No impressions from this country yet</h1>
        <p>Collect a stamp at a shop in this country and a page appears here.</p>
        <ButtonLink href="/passport" variant="primary">
          Open Passport
        </ButtonLink>
      </div>
    );
  }

  return (
    <>
      <h1 className="visually-hidden">Passport · {view.countryLabel}</h1>
      <PassportBook pages={pages} initialPageIndex={target} />
    </>
  );
}

export function PassportLocalityView({
  country,
  locality,
}: {
  readonly country: string;
  readonly locality: string;
}) {
  const { passport } = useCollection();
  const pages = usePassportPages();

  const countryView = passport.countries.find(
    (candidate) => candidate.slug === country.toLowerCase(),
  );
  const localityView = countryView?.localities.find(
    (candidate) => candidate.slug === locality.toLowerCase(),
  );

  if (!countryView || !localityView) {
    return (
      <div className={styles.empty}>
        <h1 className={styles.emptyTitle}>No impressions from this locality yet</h1>
        <p>Stamps appear here once you collect one at a shop in this locality.</p>
        <ButtonLink href="/passport" variant="primary">
          Open Passport
        </ButtonLink>
      </div>
    );
  }

  const target = pageIndexForLocality(
    pages,
    countryView.countryCode as CountryCode,
    localityView.slug,
  );

  return (
    <>
      <h1 className="visually-hidden">
        Passport · {localityView.name}, {countryView.countryLabel}
      </h1>
      <nav className={styles.crumbs} aria-label="Passport">
        <Link href="/passport">Passport</Link>
        <span aria-hidden="true">·</span>
        <Link href={`/passport/${countrySlug(countryView.countryCode)}`}>
          {countryView.countryLabel}
        </Link>
      </nav>
      <PassportBook pages={pages} initialPageIndex={target} />
    </>
  );
}
