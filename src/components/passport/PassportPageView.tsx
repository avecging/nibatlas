"use client";

import { NibAtlasMark } from "@/src/components/brand/NibAtlasMark";
import { ImpressionPlate } from "@/src/components/stamps/ImpressionPlate";
import { StampArt } from "@/src/components/stamps/StampArt";
import { Icon } from "@/src/components/ui/Icon";
import type { StampCollection } from "@/src/domain/passport";
import type { EarnedSeal } from "@/src/domain/seals";
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

/**
 * A seal on a book page, as artwork you can open.
 *
 * The same control as List mode's, sized for a page rather than for a section
 * head. A `<button>` for the interaction and — just as importantly — because the
 * book's drag handler already refuses to start a page turn on one, so tapping a
 * seal enlarges it instead of dragging the leaf.
 */
function PageSealButton({
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
      data-seal-size={size}
      onClick={onSelect}
      type="button"
    >
      <span aria-hidden="true">
        <ImpressionPlate size="page">
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

export function PassportPageView({
  page,
  headingId,
  onSelectStamp,
  onSelectSeal,
  onJumpToPage,
}: {
  readonly page: PassportPage;
  readonly headingId: string;
  /** Enlarges an impression. The same overlay List mode opens. */
  readonly onSelectStamp: (collection: StampCollection) => void;
  /** Enlarges a derived seal, in that same overlay. */
  readonly onSelectSeal: (seal: EarnedSeal) => void;
  /** Turns to a page from the contents index, without paging there by hand. */
  readonly onJumpToPage: (pageIndex: number) => void;
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
            {/*
              The name the reader chose, or the volume itself. Never anything
              derived from an address: an account is identified by its address
              and that is not a name, so `account-session.ts` keeps the two
              apart and this page shows only the display name.
            */}
            <h3 className={styles.identityTitle} id={headingId} tabIndex={-1}>
              {page.displayName ?? "Your Passport"}
            </h3>
            <p className={styles.identityLine}>Passport of impressions</p>
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
            {/*
              The palette version proves an impression regenerates identically
              later, which is a review concern rather than something a keepsake
              should carry.
            */}
            {reviewer && page.paletteVersion !== null ? (
              <p className={styles.identityNote}>palette v{page.paletteVersion}</p>
            ) : null}
          </div>
        ) : null}

        {page.kind === "index" ? (
          <div className={styles.index}>
            <h3 className={styles.pageTitle} id={headingId} tabIndex={-1}>
              Contents
            </h3>
            {page.countries.length === 0 ? (
              <p className={styles.pageNote}>Nothing collected yet.</p>
            ) : (
              <ul className={styles.indexList} data-no-drag="true">
                {page.countries.map((country) => (
                  <li className={styles.indexCountry} key={country.countryCode}>
                    <button
                      className={styles.indexCountryButton}
                      type="button"
                      onClick={() => onJumpToPage(country.pageIndex)}
                    >
                      <span className={styles.indexName}>{country.countryLabel}</span>
                      {country.sealEarned ? (
                        <span className={styles.indexSeal}>
                          <Icon name="seal" size={13} />
                          <span className="visually-hidden">Country seal earned</span>
                        </span>
                      ) : null}
                      <span className={styles.indexLeader} aria-hidden="true" />
                      <span className={styles.indexPage}>{country.pageIndex + 1}</span>
                    </button>

                    <ul className={styles.indexLocalities}>
                      {country.localities.map((locality) => (
                        <li key={locality.slug}>
                          <button
                            className={styles.indexLocalityButton}
                            type="button"
                            onClick={() => onJumpToPage(locality.pageIndex)}
                          >
                            <span className={styles.indexName}>{locality.name}</span>
                            <span className={styles.indexCount}>
                              {locality.stampCount}
                            </span>
                            <span className={styles.indexLeader} aria-hidden="true" />
                            <span className={styles.indexPage}>
                              {locality.pageIndex + 1}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
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
                        <PageSealButton
                          onSelect={() => onSelectSeal(seal)}
                          seal={seal}
                          size="country"
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
              {page.countries.length === 0 ? (
                <li className={styles.pageNote}>
                  A seal derives from the first stamp you collect.
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {page.kind === "locality" ? (
          <div className={styles.locality}>
            <h3 className={styles.pageTitle} id={headingId} tabIndex={-1}>
              {page.localityName}
              {page.continued ? " (continued)" : ""}
            </h3>
            {/*
              The locality seal, as the artwork it is. It read as a line of text
              until the founder's WP3 staging review, which is the one place in
              the Passport a seal was not shown at all.
            */}
            {page.seal ? (
              <div className={styles.localitySeal}>
                <PageSealButton
                  onSelect={() => onSelectSeal(page.seal as EarnedSeal)}
                  seal={page.seal}
                  size="locality"
                />
                <span className={styles.localitySealMeta}>
                  Locality seal
                  <span>Earned {page.seal.earnedOn}</span>
                </span>
              </div>
            ) : null}
            <ul className={styles.stampGrid}>
              {page.collections.map((collection, index) => (
                <li
                  className={styles.stampSlot}
                  key={collection.id}
                  style={{ "--slot-rotate": `${SLOTS[index % SLOTS.length]?.rotate ?? 0}deg` } as React.CSSProperties}
                >
                  {/*
                    A button, not a link: tapping an impression enlarges it. The
                    shop is one step further on, from inside the overlay, so a
                    reader can look at the stamp without leaving the Passport.
                  */}
                  <button
                    className={styles.stampButton}
                    type="button"
                    onClick={() => onSelectStamp(collection)}
                  >
                    <ImpressionPlate size="page">
                      <StampArt
                        detail="compact"
                        stamp={collection.stamp}
                        title={collection.shopNameSnapshot}
                      />
                    </ImpressionPlate>
                    <span className={styles.stampCaption}>
                      {collection.shopNameSnapshot}
                      <span>{collection.collectedOn}</span>
                    </span>
                  </button>
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
