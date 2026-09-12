"use client";

import { useCallback, useId } from "react";

import { useDialogFocus } from "@/src/components/hooks/useDialogFocus";
import { passportHrefWithAnchor } from "@/src/components/shops/ShopBackLink";
import { ImpressionPlate } from "@/src/components/stamps/ImpressionPlate";
import { ImpressionSheet } from "@/src/components/stamps/ImpressionSheet";
import { StampArt } from "@/src/components/stamps/StampArt";
import { ButtonLink } from "@/src/components/ui/Button";
import type { StampCollection } from "@/src/domain/passport";
import type { EarnedSeal } from "@/src/domain/seals";

import styles from "./PassportDetailOverlay.module.css";

const TIER_LABEL = {
  shop: "Shop stamp",
  locality: "Locality seal",
  country: "Country seal",
} as const;

/**
 * What the overlay is showing.
 *
 * One overlay for every impression in the Passport, because a reader taps
 * artwork and expects it to get bigger — whichever kind of artwork it is. The
 * two kinds are not interchangeable in content, though: a shop stamp records a
 * visit and leads on to the shop, while a geographic seal is *derived* from
 * visits and leads nowhere. So the subject is a union rather than one shape with
 * optional fields, and each branch states only what its own kind records.
 */
export type PassportDetailSubject =
  | { readonly kind: "impression"; readonly collection: StampCollection }
  | { readonly kind: "seal"; readonly seal: EarnedSeal };

export function impressionSubject(
  collection: StampCollection,
): PassportDetailSubject {
  return { kind: "impression", collection };
}

export function sealSubject(seal: EarnedSeal): PassportDetailSubject {
  return { kind: "seal", seal };
}

export interface PassportDetailOverlayProps {
  readonly subject: PassportDetailSubject | null;
  readonly onClose: () => void;
  /**
   * The Passport route the reader is on.
   *
   * Carried to the shop page, with this impression's id appended, so its one
   * back control returns *here* — the locality route, and the exact page inside
   * it — and the Passport then reopens in the mode the reader chose. Browser Back
   * restores the route on its own; this is for the control, and for the page the
   * route alone cannot name.
   *
   * Unused for a seal, which has no shop to go on to.
   */
  readonly returnHref?: string | undefined;
}

/** The impression, at a size worth looking at, on the paper it was pressed onto. */
function ImpressionDetail({
  collection,
  headingId,
  returnHref,
}: {
  readonly collection: StampCollection;
  readonly headingId: string;
  readonly returnHref: string;
}) {
  return (
    <>
      <div className={styles.plate} data-no-drag="true">
        <ImpressionPlate size="detail">
          <StampArt
            stamp={collection.stamp}
            title={collection.shopNameSnapshot}
            localTitle={collection.shopLocalNameSnapshot}
            localTitleLang={collection.shopLocalNameLangSnapshot}
            subtitle={collection.collectedOn}
          />
        </ImpressionPlate>
      </div>

      <h2 className={styles.name} id={headingId}>
        {collection.shopNameSnapshot}
      </h2>
      {collection.shopLocalNameSnapshot ? (
        <p
          className={styles.localName}
          lang={collection.shopLocalNameLangSnapshot} dir="auto"
        >
          {collection.shopLocalNameSnapshot}
        </p>
      ) : null}

      <dl className={styles.facts}>
        <div>
          <dt>Locality</dt>
          <dd>{collection.localityName}</dd>
        </div>
        <div>
          <dt>Country</dt>
          <dd>{collection.countryLabel}</dd>
        </div>
        <div>
          <dt>Collected</dt>
          <dd>
            <time dateTime={collection.collectedOn}>{collection.collectedOn}</time>
          </dd>
        </div>
      </dl>

      {collection.stamp.commissioned ? <p>Illustrated by {collection.stamp.commissioned.illustratorCredit}</p> : null}
      {collection.shopSlug ? <div className={styles.actions}>
        <ButtonLink
          href={`/shops/${collection.shopSlug}?from=passport&back=${encodeURIComponent(
            // The anchor, not just the route: a stamp opened from a locality's
            // second page has to come back to that page.
            passportHrefWithAnchor(returnHref, collection.id),
          )}`}
          variant="primary"
          fullWidth
        >
          Open shop
        </ButtonLink>
      </div> : <p>This shop page is no longer available.</p>}
    </>
  );
}

/**
 * A derived geographic seal, at the same size, on the same paper.
 *
 * No shop fields and no **Open shop**. A seal falls out of verified visits
 * rather than being one: a country seal derives from five stamps or a complete
 * curated set, and a locality seal from the first stamp there, so there is no
 * single shop for it to lead to. Offering one would misreport what the seal is.
 *
 * The sheet ends on the earned date with nothing in its place. The line that
 * used to explain why there is no shop to open was removed in WP3's final review
 * and does not come back: the interface does not narrate why an inapplicable
 * action is absent.
 */
function SealDetail({
  seal,
  headingId,
}: {
  readonly seal: EarnedSeal;
  readonly headingId: string;
}) {
  const isCountry = seal.scope === "country";
  const name = isCountry ? seal.countryLabel : (seal.localityName ?? seal.countryLabel);

  return (
    <>
      <div className={styles.plate} data-no-drag="true">
        <ImpressionPlate size="detail">
          <StampArt stamp={seal.stamp} title={name} subtitle={seal.earnedOn} />
        </ImpressionPlate>
      </div>

      <h2 className={styles.name} id={headingId}>
        {name}
      </h2>

      <dl className={styles.facts}>
        {isCountry ? null : (
          <div>
            <dt>Locality</dt>
            <dd>{seal.localityName ?? "—"}</dd>
          </div>
        )}
        <div>
          <dt>Country</dt>
          <dd>{seal.countryLabel}</dd>
        </div>
        <div>
          <dt>Earned</dt>
          <dd>
            <time dateTime={seal.earnedOn}>{seal.earnedOn}</time>
          </dd>
        </div>
      </dl>
    </>
  );
}

/**
 * One overlay for everything the Passport can enlarge.
 *
 * Milestone 1 had no way to enlarge a stamp: the artwork existed only at
 * thumbnail size on a book page, which is where the founder's first review found
 * it. The founder's WP3 staging review found the same thing again for derived
 * seals — a country seal was artwork you could not open, and a locality seal was
 * a line of text. Both are now the same interaction as a shop stamp, in the same
 * overlay, because they are the same act: tap the artwork, see it properly.
 *
 * What differs is the content, and only the content. Each subject states what its
 * own kind records and nothing more — no rating, no note, no sharing, no visit
 * history.
 *
 * WP5 made the sheet itself shared material rather than a second approximation
 * of one. `ImpressionSheet` owns the surface, the header and the dismissal;
 * `ImpressionPlate` owns the paper; and the collection ceremony a shop page
 * opens is built from the same two, so an enlarged Passport impression and the
 * collected impression on a shop page are visibly the same object.
 */
export function PassportDetailOverlay({
  subject,
  onClose,
  returnHref = "/passport",
}: PassportDetailOverlayProps) {
  const headingId = useId();
  const close = useCallback(() => onClose(), [onClose]);
  const dialogRef = useDialogFocus<HTMLDivElement>(subject !== null, close);

  if (!subject) {
    return null;
  }

  const tier =
    subject.kind === "impression"
      ? TIER_LABEL[subject.collection.stamp.tier]
      : TIER_LABEL[subject.seal.stamp.tier];

  return (
    <ImpressionSheet
      closeLabel={subject.kind === "seal" ? "Close seal" : "Close stamp"}
      dialogProps={{ "data-detail-kind": subject.kind }}
      dialogRef={dialogRef}
      labelledBy={headingId}
      onClose={close}
      testId="passport-detail"
      tier={tier}
    >
      {subject.kind === "impression" ? (
        <ImpressionDetail
          collection={subject.collection}
          headingId={headingId}
          returnHref={returnHref}
        />
      ) : (
        <SealDetail headingId={headingId} seal={subject.seal} />
      )}
    </ImpressionSheet>
  );
}
