"use client";

import Link from "next/link";
import { useEffect } from "react";

import { StampArt } from "@/src/components/stamps/StampArt";
import { ButtonLink } from "@/src/components/ui/Button";
import { Icon } from "@/src/components/ui/Icon";
import {
  countrySlug,
  findPassportCountry,
  findPassportLocality,
  type PassportOverview,
  type StampCollection,
} from "@/src/domain/passport";
import { useCollection } from "@/src/features/collection/collection-store";
import { noopTelemetry } from "@/src/features/map/telemetry";

import styles from "./Passport.module.css";

function DemoNote() {
  return (
    <p className={styles.demoNote}>
      Passport is private by default and requires an account in the finished
      product. Milestone 1 shows a simulated collection stored only in this browser
      session.
    </p>
  );
}

function PassportEmpty() {
  return (
    <div className={styles.empty}>
      <p className="type-h3">No impressions yet</p>
      <p>
        Atlas Stamps are collected at the shop itself. Find a shop on the map, visit
        it, and collect the stamp there.
      </p>
      <ButtonLink href="/" variant="primary">
        Explore the map
      </ButtonLink>
    </div>
  );
}

function StampCell({ collection }: { readonly collection: StampCollection }) {
  return (
    <li className={styles.stampCell}>
      <StampArt
        stamp={collection.stamp}
        shopName={collection.shopNameSnapshot}
        collectedOn={collection.collectedOn}
      />
      <Link className={styles.stampLink} href={`/shops/${collection.shopSlug}`}>
        Open shop
      </Link>
    </li>
  );
}

function PassportHeader({
  overline,
  title,
  subtitle,
}: {
  readonly overline: string;
  readonly title: string;
  readonly subtitle: string;
}) {
  return (
    <header className={styles.header}>
      <p className={styles.overline}>{overline}</p>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.subtitle}>{subtitle}</p>
    </header>
  );
}

function Stats({ passport }: { readonly passport: PassportOverview }) {
  return (
    <div className={styles.stats}>
      <p className={styles.stat}>
        <span className={styles.statValue}>{passport.stampCount}</span>
        <span className={styles.statLabel}>Stamps</span>
      </p>
      <p className={styles.stat}>
        <span className={styles.statValue}>{passport.countryCount}</span>
        <span className={styles.statLabel}>Countries</span>
      </p>
      <p className={styles.stat}>
        <span className={styles.statValue}>{passport.localityCount}</span>
        <span className={styles.statLabel}>Localities</span>
      </p>
    </div>
  );
}

export function PassportOverviewView() {
  const { passport } = useCollection();

  useEffect(() => {
    noopTelemetry.record("passport_opened", { surface: "overview" });
  }, []);

  return (
    <div className={styles.page}>
      <PassportHeader
        overline="Passport"
        title="Places you have kept"
        subtitle="Each impression records one shop, its locality, and the local date you collected it."
      />
      <DemoNote />
      <Stats passport={passport} />

      {passport.stampCount === 0 ? (
        <PassportEmpty />
      ) : (
        <>
          <section className={styles.divider} aria-labelledby="recent-impressions">
            <h2 className={styles.sectionTitle} id="recent-impressions">
              Recent impressions
            </h2>
            <ul className={styles.stampGrid}>
              {passport.recent.map((collection) => (
                <StampCell key={collection.id} collection={collection} />
              ))}
            </ul>
          </section>

          <section className={styles.divider} aria-labelledby="countries">
            <h2 className={styles.sectionTitle} id="countries">
              Countries
            </h2>
            <ul className={styles.countryList}>
              {passport.countries.map((country) => (
                <li key={country.slug}>
                  <Link className={styles.countryRow} href={`/passport/${country.slug}`}>
                    <span>
                      <span className={styles.rowTitle}>{country.countryLabel}</span>
                      <span className={styles.rowMeta}>
                        {" "}
                        · {country.localities.length} localit
                        {country.localities.length === 1 ? "y" : "ies"}
                      </span>
                    </span>
                    <span className={styles.rowMeta}>
                      {country.stampCount} stamp{country.stampCount === 1 ? "" : "s"}
                      <Icon name="chevron-right" size={16} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

export function PassportCountryView({ country }: { readonly country: string }) {
  const { passport } = useCollection();
  const view = findPassportCountry(passport, country);

  if (!view) {
    return (
      <div className={styles.page}>
        <Link className={styles.breadcrumb} href="/passport">
          <Icon name="chevron-right" size={16} />
          Passport
        </Link>
        <div className={styles.empty}>
          <p className="type-h3">No impressions from this country yet</p>
          <p>Collect a stamp at a shop in this country and it will appear here.</p>
          <ButtonLink href="/" variant="primary">
            Explore the map
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link className={styles.breadcrumb} href="/passport">
        <Icon name="chevron-right" size={16} />
        Passport
      </Link>
      <PassportHeader
        overline="Passport country"
        title={view.countryLabel}
        subtitle={`${view.stampCount} impression${view.stampCount === 1 ? "" : "s"} across ${
          view.localities.length
        } localit${view.localities.length === 1 ? "y" : "ies"}.`}
      />
      <ul className={styles.countryList}>
        {view.localities.map((locality) => (
          <li key={locality.slug}>
            <Link
              className={styles.countryRow}
              href={`/passport/${view.slug}/${locality.slug}`}
            >
              <span className={styles.rowTitle}>{locality.name}</span>
              <span className={styles.rowMeta}>
                {locality.collections.length} stamp
                {locality.collections.length === 1 ? "" : "s"}
                <Icon name="chevron-right" size={16} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
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
  const countryView = findPassportCountry(passport, country);
  const localityView = countryView ? findPassportLocality(countryView, locality) : undefined;

  if (!countryView || !localityView) {
    return (
      <div className={styles.page}>
        <Link className={styles.breadcrumb} href="/passport">
          <Icon name="chevron-right" size={16} />
          Passport
        </Link>
        <div className={styles.empty}>
          <p className="type-h3">No impressions from this locality yet</p>
          <p>Stamps appear here once you collect one at a shop in this locality.</p>
          <ButtonLink href="/" variant="primary">
            Explore the map
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link
        className={styles.breadcrumb}
        href={`/passport/${countrySlug(countryView.countryCode)}`}
      >
        <Icon name="chevron-right" size={16} />
        {countryView.countryLabel}
      </Link>
      <PassportHeader
        overline={`${countryView.countryLabel} · Locality`}
        title={localityView.name}
        subtitle="Impressions are listed by collection date, newest first."
      />
      <ul className={styles.stampGrid}>
        {localityView.collections.map((collection) => (
          <StampCell key={collection.id} collection={collection} />
        ))}
      </ul>
    </div>
  );
}
