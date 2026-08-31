"use client";

import Link from "next/link";
import { useId } from "react";

import { localeForCountry } from "@/src/components/shops/locale";
import { ImpressionPlate } from "@/src/components/stamps/ImpressionPlate";
import { StampArt } from "@/src/components/stamps/StampArt";
import { Icon } from "@/src/components/ui/Icon";
import type {
  PassportCountry,
  PassportLocality,
  PassportOverview,
  StampCollection,
} from "@/src/domain/passport";
import type { EarnedSeal } from "@/src/domain/seals";

import styles from "./PassportList.module.css";

/**
 * List mode: the Passport as a record rather than as an object.
 *
 * This is where finding things happens, and it is the accessible baseline. It
 * uses no 3D transforms, no drag gestures and no page geometry, so it stays
 * fully usable when those are unavailable — which is why normal mode defaults to
 * it.
 *
 * Grouping follows `buildPassport`: countries and localities alphabetically,
 * which is what Me's Places visited shows, and impressions newest first within a
 * locality. Deterministic in both directions, so two readers with the same
 * collection see the same order. Book mode orders its *pages* by recency
 * instead, because a passport fills up in the order it was stamped.
 *
 * There are no completion denominators here. `PRODUCT.md` licenses `x / y` only
 * against an explicitly versioned curated set, and "shops in this locality" is
 * not one.
 */
export interface PassportListProps {
  readonly passport: PassportOverview;
  readonly seals: readonly EarnedSeal[];
  /** Enlarges a derived seal, in the same overlay a stamp uses. */
  readonly onSelectSeal: (seal: EarnedSeal) => void;
  /** Narrows the list to one country or one locality for the deep-link routes. */
  readonly focus?:
    | { readonly kind: "all" }
    | { readonly kind: "country"; readonly country: PassportCountry }
    | {
        readonly kind: "locality";
        readonly country: PassportCountry;
        readonly locality: PassportLocality;
      };
  readonly onSelectStamp: (collection: StampCollection) => void;
}

function countrySealFor(
  seals: readonly EarnedSeal[],
  countryCode: string,
): EarnedSeal | undefined {
  return seals.find(
    (seal) => seal.scope === "country" && seal.countryCode === countryCode,
  );
}

function localitySealFor(
  seals: readonly EarnedSeal[],
  countryCode: string,
  localitySlug: string,
): EarnedSeal | undefined {
  return seals.find(
    (seal) =>
      seal.scope === "locality" &&
      seal.countryCode === countryCode &&
      seal.localitySlug === localitySlug,
  );
}

function stampsLabel(count: number): string {
  return `${count} ${count === 1 ? "stamp" : "stamps"}`;
}

/**
 * An earned seal, as artwork you can open.
 *
 * A button rather than a decoration: the founder's staging review found country
 * seals rendered as artwork nobody could touch and locality seals reduced to a
 * line of text. The impression already carries its own accessible description,
 * so the button borrows it rather than repeating it — with the kind of seal said
 * once, because "Japan" alone does not say what has been earned.
 */
function SealButton({
  seal,
  onSelect,
  size,
}: {
  readonly seal: EarnedSeal;
  readonly onSelect: () => void;
  readonly size: "country" | "locality";
}) {
  const name =
    seal.scope === "country" ? seal.countryLabel : (seal.localityName ?? seal.countryLabel);

  return (
    <button
      className={styles.sealButton}
      data-seal-scope={seal.scope}
      data-seal-size={size}
      onClick={onSelect}
      type="button"
    >
      <span className={styles.sealArt} aria-hidden="true">
        <ImpressionPlate size={size === "country" ? "card" : "thumb"}>
          <StampArt detail="compact" stamp={seal.stamp} title={name} />
        </ImpressionPlate>
      </span>
      <span className="visually-hidden">
        {seal.scope === "country" ? "Country seal" : "Locality seal"}, {name}, earned{" "}
        {seal.earnedOn}
      </span>
    </button>
  );
}

function localitiesLabel(count: number): string {
  return `${count} ${count === 1 ? "locality" : "localities"}`;
}

/** One collected impression. A button, because it enlarges rather than navigates. */
function StampRow({
  collection,
  onSelect,
}: {
  readonly collection: StampCollection;
  readonly onSelect: () => void;
}) {
  return (
    <li className={styles.stampRow}>
      <button className={styles.stampButton} type="button" onClick={onSelect}>
        <span className={styles.stampThumb} aria-hidden="true">
          <ImpressionPlate size="thumb">
            <StampArt
              detail="compact"
              stamp={collection.stamp}
              title={collection.shopNameSnapshot}
            />
          </ImpressionPlate>
        </span>
        <span className={styles.stampText}>
          <span className={styles.stampName}>{collection.shopNameSnapshot}</span>
          {collection.shopLocalNameSnapshot ? (
            <span
              className={styles.stampLocalName}
              lang={localeForCountry(collection.countryCode)}
            >
              {collection.shopLocalNameSnapshot}
            </span>
          ) : null}
          <span className={styles.stampMeta}>
            {collection.localityName}
            <span aria-hidden="true"> · </span>
            <time dateTime={collection.collectedOn}>{collection.collectedOn}</time>
          </span>
        </span>
        <Icon name="chevron-right" size={18} />
      </button>
    </li>
  );
}

function LocalitySection({
  country,
  locality,
  seals,
  onSelectStamp,
  onSelectSeal,
  headingLevel,
}: {
  readonly country: PassportCountry;
  readonly locality: PassportLocality;
  readonly seals: readonly EarnedSeal[];
  readonly onSelectStamp: (collection: StampCollection) => void;
  readonly onSelectSeal: (seal: EarnedSeal) => void;
  readonly headingLevel: 2 | 3;
}) {
  const headingId = useId();
  const seal = localitySealFor(seals, country.countryCode, locality.slug);
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <section aria-labelledby={headingId} className={styles.locality}>
      <div className={styles.localityHead}>
        <div className={styles.localityText}>
          <Heading className={styles.localityName} id={headingId}>
            <Link
              className={styles.localityLink}
              href={`/passport/${country.slug}/${locality.slug}`}
            >
              {locality.name}
            </Link>
          </Heading>
          <p className={styles.localityMeta}>
            {stampsLabel(locality.collections.length)}
          </p>
        </div>

        {/* The seal itself, where the old text note used to be. Nothing at all
            where a seal has not been earned — no locked silhouette. */}
        {seal ? (
          <SealButton
            onSelect={() => onSelectSeal(seal)}
            seal={seal}
            size="locality"
          />
        ) : null}
      </div>

      <ul className={styles.stampList}>
        {locality.collections.map((collection) => (
          <StampRow
            collection={collection}
            key={collection.id}
            onSelect={() => onSelectStamp(collection)}
          />
        ))}
      </ul>
    </section>
  );
}

function CountrySection({
  country,
  seals,
  onSelectStamp,
  onSelectSeal,
  linkName,
}: {
  readonly country: PassportCountry;
  readonly seals: readonly EarnedSeal[];
  readonly onSelectStamp: (collection: StampCollection) => void;
  readonly onSelectSeal: (seal: EarnedSeal) => void;
  /** False on the country route, where the heading is already the destination. */
  readonly linkName: boolean;
}) {
  const headingId = useId();
  const seal = countrySealFor(seals, country.countryCode);

  return (
    <section aria-labelledby={headingId} className={styles.country}>
      <div className={styles.countryHead}>
        <div className={styles.countryText}>
          <h2 className={styles.countryName} id={headingId}>
            {linkName ? (
              <Link className={styles.countryLink} href={`/passport/${country.slug}`}>
                {country.countryLabel}
              </Link>
            ) : (
              country.countryLabel
            )}
          </h2>
          <p className={styles.countryMeta}>
            {stampsLabel(country.stampCount)}
            <span aria-hidden="true"> · </span>
            {localitiesLabel(country.localities.length)}
          </p>
        </div>

        {/*
          The seal is artwork, not a status chip. WP1's filled vermilion "Country
          seal earned" badge read as an alert to dismiss; the impression itself
          says the same thing and is the thing worth keeping — and it now opens,
          because artwork a reader cannot enlarge is what the staging review
          found wrong with it.
        */}
        {seal ? (
          <SealButton
            onSelect={() => onSelectSeal(seal)}
            seal={seal}
            size="country"
          />
        ) : null}
      </div>

      {country.localities.map((locality) => (
        <LocalitySection
          country={country}
          headingLevel={3}
          key={locality.slug}
          locality={locality}
          onSelectSeal={onSelectSeal}
          onSelectStamp={onSelectStamp}
          seals={seals}
        />
      ))}
    </section>
  );
}

export function PassportList({
  passport,
  seals,
  focus = { kind: "all" },
  onSelectStamp,
  onSelectSeal,
}: PassportListProps) {
  if (focus.kind === "locality") {
    return (
      <div className={styles.list} data-passport-list="locality">
        <nav aria-label="Passport" className={styles.crumbs}>
          <Link href="/passport">Passport</Link>
          <Icon name="chevron-right" size={14} />
          <Link href={`/passport/${focus.country.slug}`}>
            {focus.country.countryLabel}
          </Link>
        </nav>
        <h1 className={styles.title}>{focus.locality.name}</h1>
        <LocalitySection
          country={focus.country}
          headingLevel={2}
          locality={focus.locality}
          onSelectSeal={onSelectSeal}
          onSelectStamp={onSelectStamp}
          seals={seals}
        />
      </div>
    );
  }

  if (focus.kind === "country") {
    return (
      <div className={styles.list} data-passport-list="country">
        <nav aria-label="Passport" className={styles.crumbs}>
          <Link href="/passport">Passport</Link>
        </nav>
        <h1 className={styles.title}>{focus.country.countryLabel}</h1>
        <CountrySection
          country={focus.country}
          linkName={false}
          onSelectSeal={onSelectSeal}
          onSelectStamp={onSelectStamp}
          seals={seals}
        />
      </div>
    );
  }

  return (
    <div className={styles.list} data-passport-list="all">
      <h1 className={styles.title}>Passport</h1>

      {/*
        A description list, so the label and its number are associated without a
        visible sentence doing the work. The value is painted above the label by
        `column-reverse`; the document order stays `dt` then `dd`.
      */}
      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt className={styles.statLabel}>Shop stamps</dt>
          <dd className={styles.statValue}>{passport.stampCount}</dd>
        </div>
        <div className={styles.stat}>
          <dt className={styles.statLabel}>Countries visited</dt>
          <dd className={styles.statValue}>{passport.countryCount}</dd>
        </div>
        <div className={styles.stat}>
          <dt className={styles.statLabel}>Localities visited</dt>
          <dd className={styles.statValue}>{passport.localityCount}</dd>
        </div>
      </dl>

      {passport.countries.map((country) => (
        <CountrySection
          country={country}
          key={country.countryCode}
          linkName
          onSelectSeal={onSelectSeal}
          onSelectStamp={onSelectStamp}
          seals={seals}
        />
      ))}
    </div>
  );
}
