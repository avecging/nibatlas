import type { ReactNode } from "react";

import { ShopCorrection } from "@/src/components/shops/ShopCorrection";
import { ShopEditorial } from "@/src/components/shops/ShopEditorial";
import { ShopIdentityHero } from "@/src/components/shops/ShopIdentityHero";
import { ShopMediaGallery } from "@/src/components/shops/ShopMediaGallery";
import { ShopMediaProvider } from "@/src/components/shops/ShopMediaProvider";
import { ShopNearby } from "@/src/components/shops/ShopNearby";
import {
  ShopPositionDiagnostic,
  ShopProvenance,
} from "@/src/components/shops/ShopReviewerDetails";
import {
  ShopExclusives,
  ShopValueGap,
  ShopWhatYouCanDo,
} from "@/src/components/shops/ShopValueSections";
import { Icon } from "@/src/components/ui/Icon";
import { OperationalStatusBadge } from "@/src/components/ui/StatusBadge";
import type { NearbyShop } from "@/src/domain/nearby-shops";
import {
  type OpeningHoursDay,
  type ShopDetail,
} from "@/src/domain/shop-detail";
import { shopVisitFacts, type VisitFact } from "@/src/features/shops/shop-visit-facts";

import styles from "./ShopDetailView.module.css";

const DAY_LABELS: Record<OpeningHoursDay, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

/**
 * Whether this build talks to a catalogue that can serve photographs at all.
 *
 * Accepted decision 5's one photography caption survives here, and only here: a
 * fixture build has no media route to ask, so "coming soon" is the truthful
 * answer. An API-backed shop with no published photographs says nothing —
 * "coming soon" there would be a promise the record does not make.
 */
const MEDIA_CAPABLE_BUILD =
  process.env.NEXT_PUBLIC_CATALOGUE_MODE === "api" ||
  process.env.NEXT_PUBLIC_CATALOGUE_MODE === "api-demo";

function TagList({
  items,
  label,
}: {
  readonly items: readonly string[];
  readonly label: string;
}) {
  return (
    <ul className={styles.tagList} aria-label={label}>
      {items.map((item) => (
        <li key={item} className={styles.tag}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  readonly icon: Parameters<typeof Icon>[0]["name"];
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <p className={styles.fact}>
      <Icon name={icon} size={18} />
      <span>
        <span className={styles.factLabel}>{label}</span>
        {children}
      </span>
    </p>
  );
}

function FactList({ facts }: { readonly facts: readonly VisitFact[] }) {
  if (facts.length === 0) {
    return null;
  }

  return (
    <div className={styles.factList}>
      {facts.map((row) => (
        <Fact key={row.key} icon={row.icon} label={row.label}>
          {row.value}
        </Fact>
      ))}
    </div>
  );
}

interface ShopDetailViewProps {
  readonly shop: ShopDetail;
  /** Other catalogue shops in reach, already derived and ordered. */
  readonly nearby: readonly NearbyShop[];
  /** Client island: the Save bookmark, rendered beside the shop's name. */
  readonly save: ReactNode;
  /** Client island: native directions, collection, ceremony. */
  readonly actions: ReactNode;
  /** Client island showing live saved/visited state. */
  readonly statusBadges: ReactNode;
  /** Client island resolving where "Back" returns to. */
  readonly back: ReactNode;
}

/**
 * Shop detail.
 *
 * The page answers "is this place worth a fountain-pen enthusiast's trip?" —
 * never "how highly is it rated?" There are no ratings, review prose, engagement
 * counts, stock claims, product catalogue, or e-commerce actions anywhere on it.
 *
 * The founder's September shop UI direction sets the order, and it is the order
 * someone deciding on a trip actually reads in:
 *
 * 1. where they came from, and the shop's identity — mark, name, place, type;
 * 2. the photographs, as a contained gallery rather than a stack;
 * 3. Directions and the existing collection action, near the top;
 * 4. the story on the left and *Plan your visit* on the right, side by side at
 *    desktop width and one column everywhere else;
 * 5. a quiet provenance line and the correction route.
 *
 * The two-column body is why step 4 reads "side by side" rather than "a grid":
 * WP4's grid was withdrawn because a sparse record became a handful of small
 * boxes with an implied empty cell. Here the right-hand rail exists only where
 * *Plan your visit* has something to say beyond the hours caution, so a thin
 * record is still a short single column rather than a broken layout.
 *
 * Every section renders only when its source-supported data exists, and an empty
 * subsection heading never renders. Ordinary unsupported fields are omitted in
 * silence; the exceptions are opening hours and the value layer itself, where
 * not knowing changes whether the trip happens at all.
 */
export function ShopDetailView({
  shop,
  nearby,
  save,
  actions,
  statusBadges,
  back,
}: ShopDetailViewProps) {
  const specialties = shop.specialties ?? [];
  const brands = shop.brands ?? [];
  const links = shop.links ?? [];
  const hours = shop.openingHours ?? [];
  const hasWhyVisit = Boolean(shop.shortDescription) || specialties.length > 0;

  /*
   * Which subsections of "Plan your visit" have anything to say, decided once
   * from the reconciled fact rows rather than from either field generation.
   * The founder's review asks for two specific absences: no heading over an
   * empty subsection, and no reserved space where a section would have been.
   */
  const facts = shopVisitFacts(shop);
  const hasGettingThere = facts.gettingThere.length > 0 || nearby.length > 0;

  /*
   * Whether the page is worth splitting in two.
   *
   * WP4's grid was withdrawn because a sparse record became small boxes beside
   * an implied empty cell, and a rail with nothing to sit beside it is that
   * failure again. So both halves have to earn it: the story column needs
   * something of the shop's own — published editorial, a sourced value layer,
   * or brands — and the rail needs more than the hours caution every record
   * carries. Anything less stays one measured reading column.
   */
  const hasStory =
    Object.keys(shop.editorial ?? {}).length > 0 ||
    (shop.services?.length ?? 0) > 0 ||
    (shop.experiences?.length ?? 0) > 0 ||
    (shop.exclusives?.length ?? 0) > 0 ||
    brands.length > 0;
  const hasRail =
    facts.gettingThere.length + facts.beforeYouGo.length + links.length > 0 ||
    hours.length > 0;
  const columns = hasStory && hasRail ? "two" : "one";

  return (
    <ShopMediaProvider key={shop.id} shopId={shop.id}>
      <div className={styles.page} data-columns={columns}>
        {back}

        {/* 1 — who this shop is. */}
        <ShopIdentityHero
          shop={shop}
          save={save}
          badges={
            <>
              {statusBadges}
              <OperationalStatusBadge status={shop.operationalStatus} />
            </>
          }
        />

        {hasWhyVisit ? (
          <div className={styles.intro}>
            {shop.shortDescription ? (
              <p className={styles.lede}>{shop.shortDescription}</p>
            ) : null}
            {specialties.length > 0 ? (
              <TagList items={specialties} label="Specialties" />
            ) : null}
          </div>
        ) : shop.specialtyLine ? (
          <p className={styles.lede}>{shop.specialtyLine}</p>
        ) : null}

        {/* 2 — the photographs, contained. */}
        <ShopMediaGallery shopName={shop.name} />
        {MEDIA_CAPABLE_BUILD ? null : (
          <p className={styles.photosPending}>
            <Icon name="camera" size={16} />
            <span>Photos coming soon</span>
          </p>
        )}

        {/* 3 — deciding to go and being able to act on it, together. */}
        <div className={styles.actionsRow}>{actions}</div>

        <div className={styles.body} data-columns={columns}>
          <div className={styles.mainColumn}>
            <ShopEditorial content={shop.editorial} />
            <ShopWhatYouCanDo shop={shop} />
            <ShopValueGap shop={shop} />
            <ShopExclusives shop={shop} />

            {brands.length > 0 ? (
              <section className={styles.section} aria-labelledby="brands">
                <h2 className={styles.sectionTitle} id="brands">
                  Brands seen at this shop
                </h2>
                <p className={styles.plain}>
                  Stock changes without notice, and Nib Atlas is not a product
                  catalogue.
                </p>
                <TagList items={brands} label="Brands" />
              </section>
            ) : null}
          </div>

          {/* 4 — everything a visitor needs to actually make the trip. */}
          <aside className={styles.sideColumn}>
            <section className={styles.section} aria-labelledby="plan-your-visit">
              <h2 className={styles.sectionTitle} id="plan-your-visit">
                Plan your visit
              </h2>

              {shop.positionPrecision === "locality" ? (
                <p className={styles.plain}>
                  Approximate area only. Check the shop’s address before travelling.
                </p>
              ) : null}

              {hasGettingThere ? (
                <div className={styles.subsection}>
                  <h3 className={styles.subheading} id="getting-there">
                    Getting there
                  </h3>
                  <FactList facts={facts.gettingThere} />

                  {/*
                    Trip context, inside getting there rather than a section of
                    its own at the foot of the page: which other shops are within
                    reach is part of how you plan getting to this one.
                  */}
                  <ShopNearby nearby={nearby} localityName={shop.localityName} />
                </div>
              ) : null}

              {/*
                Always present: opening hours say something on every record — the
                published table, or the one caution that they are not published.
                The other rows inside it come and go with the record's evidence.
              */}
              <div className={styles.subsection}>
                <h3 className={styles.subheading} id="before-you-go">
                  Before you go
                </h3>
                {hours.length === 0 ? (
                  <p className={styles.fact}>
                    <Icon name="alert" size={18} />
                    <span>
                      {shop.openingHoursNote ??
                        "Opening hours are not confirmed. Check with the shop before travelling."}
                    </span>
                  </p>
                ) : (
                  <>
                    <div className={styles.hours}>
                      {hours.map((entry) => (
                        <p className={styles.hourRow} key={entry.day}>
                          <span>{DAY_LABELS[entry.day]}</span>
                          <span>
                            {entry.closed
                              ? "Closed"
                              : `${entry.opens ?? "—"}–${entry.closes ?? "—"}`}
                            {entry.note ? ` · ${entry.note}` : ""}
                          </span>
                        </p>
                      ))}
                    </div>
                    {shop.openingHoursNote ? (
                      <p className={styles.plain}>{shop.openingHoursNote}</p>
                    ) : null}
                    <p className={styles.fact}>
                      <Icon name="alert" size={18} />
                      <span>Always confirm with the shop before travelling.</span>
                    </p>
                  </>
                )}

                <FactList facts={facts.beforeYouGo} />

                <div className={styles.factList}>
                  {/*
                    The shop's own website, as a contextual link. It was a second
                    header button until the founder's staging review: the website
                    is visit information, and it only needs to be on the page once.
                  */}
                  {links.map((link) => (
                    <p className={styles.fact} key={link.url}>
                      <Icon name="link" size={18} />
                      <span>
                        <span className={styles.factLabel}>
                          {link.isOfficial ? "Official website" : "Reference"}
                        </span>
                        <a
                          className={styles.linkRow}
                          href={link.url}
                          rel="noreferrer noopener"
                          target="_blank"
                        >
                          {link.label}
                        </a>
                      </span>
                    </p>
                  ))}
                </div>
              </div>

              {/*
                Reviewer-only, and deliberately outside both subsections: a shop
                with no sourced address renders no *Getting there* at all, and the
                coordinate note is evidence a sourcing review needs, so it must
                not disappear with the subsection. It renders nothing for a normal
                tester.
              */}
              <ShopPositionDiagnostic shop={shop} />
            </section>
          </aside>
        </div>

        {/* 5 — quiet provenance, then the correction route. */}
        <ShopProvenance shop={shop} />
        <ShopCorrection shopSlug={shop.slug} />
      </div>
    </ShopMediaProvider>
  );
}
