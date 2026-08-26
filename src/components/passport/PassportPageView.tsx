"use client";

import Link from "next/link";

import { NibAtlasMark } from "@/src/components/brand/NibAtlasMark";
import { StampArt } from "@/src/components/stamps/StampArt";
import { STAMP_INKS } from "@/src/domain/stamp-palette";
import { useReviewerMode } from "@/src/features/reviewer/ReviewerModeProvider";
import type { PassportPage } from "@/src/features/passport/passport-pages";

import styles from "./PassportPageView.module.css";

/** Slight, fixed placement jitter so a page of impressions looks stamped by
 *  hand rather than laid out on a grid. Fixed, not random: the same impression
 *  sits in the same place every time the page is drawn. */
const SLOTS = [
  { rotate: -3.2 },
  { rotate: 2.6 },
  { rotate: 1.8 },
  { rotate: -2.4 },
] as const;

export function PassportPageView({
  page,
  headingId,
}: {
  readonly page: PassportPage;
  readonly headingId: string;
}) {
  const reviewer = useReviewerMode();

  return (
    <div className={styles.page} data-page-kind={page.kind}>
      {page.runningHead || page.runningFoot ? (
        <div className={styles.furniture}>
          <span className={styles.furnitureHead}>{page.runningHead}</span>
          <span className={styles.furnitureFoot}>{page.runningFoot}</span>
        </div>
      ) : null}

      <div className={styles.body}>
        {page.kind === "identity" ? (
          <div className={styles.identity}>
            <NibAtlasMark size={56} />
            <h3 className={styles.identityTitle} id={headingId} tabIndex={-1}>
              Passport of impressions
            </h3>
            <p className={styles.identityLine}>
              A private record of shops visited and the ink each visit left behind.
            </p>
            <dl className={styles.identityFacts}>
              <div>
                <dt>Shop stamps</dt>
                <dd>{page.stampCount}</dd>
              </div>
              <div>
                <dt>Countries</dt>
                <dd>{page.countryCount}</dd>
              </div>
              <div>
                <dt>Localities</dt>
                <dd>{page.localityCount}</dd>
              </div>
            </dl>
            <p className={styles.identityNote}>
              Volume I · {STAMP_INKS.length} shared inks
              {page.paletteVersion === null
                ? ""
                : ` · palette v${page.paletteVersion}`}
            </p>
          </div>
        ) : null}

        {page.kind === "seals" ? (
          <div className={styles.seals}>
            <h3 className={styles.pageTitle} id={headingId} tabIndex={-1}>
              Geographic seals
            </h3>
            <p className={styles.pageNote}>
              Seals are not collected. They derive from verified shop visits: a
              locality seal from the first stamp there, a country seal from five
              stamps — or from completing a smaller curated set.
            </p>
            <ul className={styles.sealList}>
              {page.countries.map((country) => {
                const seal = page.countrySeals.find(
                  (candidate) => candidate.countryCode === country.countryCode,
                );

                return (
                  <li className={styles.sealRow} key={country.countryCode}>
                    <span className={styles.sealArt}>
                      {seal ? (
                        <StampArt
                          stamp={seal.stamp}
                          title={country.countryLabel}
                          subtitle={seal.earnedOn}
                          size="small"
                        />
                      ) : (
                        <span className={styles.sealPending} aria-hidden="true">
                          Not yet
                        </span>
                      )}
                    </span>
                    <span className={styles.sealText}>
                      <span className={styles.sealName}>{country.countryLabel}</span>
                      {seal ? (
                        <span className={styles.sealMeta}>
                          Earned {seal.earnedOn}
                          {country.requirementFromCuratedSet
                            ? ` · curated set of ${country.required} complete`
                            : ""}
                        </span>
                      ) : (
                        <span className={styles.sealMeta}>
                          {/*
                            The denominator has to name the metric its rule
                            actually counts. A curated set smaller than five is
                            completed by collecting those specific shops, so any
                            number of stamps elsewhere in the country does not
                            move it.
                          */}
                          {country.requirementFromCuratedSet
                            ? `${country.progressCount} of ${country.required} curated shops`
                            : `${country.progressCount} of ${country.required} stamps`}
                        </span>
                      )}
                      {/*
                        The coverage-set identifier proves an earned seal is not
                        revoked when the curated set grows, which is a review
                        concern. On the page itself it is a version string on a
                        keepsake.
                      */}
                      {reviewer && country.coverageSetVersion ? (
                        <span className={styles.sealVersion}>
                          set {country.coverageSetVersion}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {page.kind === "locality" ? (
          <div className={styles.locality}>
            <h3 className={styles.pageTitle} id={headingId} tabIndex={-1}>
              {page.localityName}
              {page.continued ? " (continued)" : ""}
            </h3>
            {page.seal ? (
              <p className={styles.localitySeal}>
                Locality seal earned {page.seal.earnedOn}
              </p>
            ) : null}
            <ul className={styles.stampGrid}>
              {page.collections.map((collection, index) => (
                <li
                  className={styles.stampSlot}
                  key={collection.id}
                  style={{ "--slot-rotate": `${SLOTS[index % SLOTS.length]?.rotate ?? 0}deg` } as React.CSSProperties}
                >
                  <Link
                    className={styles.stampLink}
                    href={`/shops/${collection.shopSlug}?from=passport`}
                  >
                    <StampArt
                      stamp={collection.stamp}
                      title={collection.shopNameSnapshot}
                      localTitle={collection.shopLocalNameSnapshot}
                      subtitle={collection.collectedOn}
                    />
                    <span className={styles.stampCaption}>
                      {collection.shopNameSnapshot}
                      <span>{collection.collectedOn}</span>
                    </span>
                  </Link>
                </li>
              ))}
              {page.collections.length === 0 ? (
                <li className={styles.stampEmpty}>No impressions on this page yet.</li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {page.kind === "blank" ? (
          <div className={styles.blank}>
            <h3 className={styles.pageTitle} id={headingId} tabIndex={-1}>
              Room for the next visit
            </h3>
            <p className={styles.pageNote}>
              The next impression you collect is pressed here.
            </p>
          </div>
        ) : null}
      </div>

      {page.number > 0 && page.kind !== "blank" ? (
        <span className={styles.pageNumber} aria-hidden="true">
          {page.number}
        </span>
      ) : null}
    </div>
  );
}
