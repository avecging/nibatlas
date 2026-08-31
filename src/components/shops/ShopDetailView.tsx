import type { ReactNode } from "react";

import { ShopCorrection } from "@/src/components/shops/ShopCorrection";
import {
  ShopIdentityHero,
  ShopLocalName,
} from "@/src/components/shops/ShopIdentityHero";
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
 * WP4 reordered it away from the directory shape root cause D describes. The
 * founder's staging review then moved the actions back up: deciding *whether* to
 * go and being able to *act* on the decision belong together at the top, and an
 * action block stranded below the practical detail was found on both mobile and
 * desktop. So the order is now:
 *
 * 1. the designed identity plate, with Save as a bookmark beside the name;
 * 2. the shop's own name, its status, one line on why it may be worth the trip,
 *    then Directions and Collect Stamp;
 * 3. what you can do there — or the one caution when nothing is sourced;
 * 4. what is only available here;
 * 5. **Plan your visit** — *Getting there* and *Before you go*;
 * 6. brands as supporting information;
 * 7. a quiet provenance line and the correction route.
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
  const access = shop.access;
  const practical = shop.practical;
  const hasWhyVisit = Boolean(shop.shortDescription) || specialties.length > 0;

  /*
   * Which subsections of "Plan your visit" have anything to say.
   *
   * Computed rather than inlined, because the founder's review asks for two
   * specific absences: no heading over an empty subsection, and no reserved
   * space where a section would have been. Both are decided here, once.
   */
  const hasDirections =
    Boolean(access?.nearestStation) ||
    Boolean(access?.walkFromStation) ||
    Boolean(access?.floorNote) ||
    (shop.addressLines?.length ?? 0) > 0;
  const hasGettingThere = hasDirections || nearby.length > 0;

  return (
    <div className={styles.page}>
      {back}

      {/* 1 — the designed identity, standing in for a photograph. */}
      <ShopIdentityHero shop={shop} save={save} />

      {/* 2 — the shop's own name, why it may be worth the trip, and the actions. */}
      <header className={styles.header}>
        <ShopLocalName shop={shop} />
        <div className={styles.badges}>
          {statusBadges}
          <OperationalStatusBadge status={shop.operationalStatus} />
        </div>
        {hasWhyVisit ? (
          <>
            {shop.shortDescription ? (
              <p className={styles.lede}>{shop.shortDescription}</p>
            ) : null}
            {specialties.length > 0 ? (
              <TagList items={specialties} label="Specialties" />
            ) : null}
          </>
        ) : shop.specialtyLine ? (
          <p className={styles.lede}>{shop.specialtyLine}</p>
        ) : null}
        {actions}
      </header>

      <div className={styles.grid}>
        {/* 3 — what you can do there, or the one caution when nothing is sourced. */}
        <ShopWhatYouCanDo shop={shop} />
        <ShopValueGap shop={shop} />

        {/* 4 — the reason a pen traveller detours. */}
        <ShopExclusives shop={shop} />

        {/* 5 — everything a visitor needs to actually make the trip. */}
        <section className={styles.section} aria-labelledby="plan-your-visit">
          <h2 className={styles.sectionTitle} id="plan-your-visit">
            Plan your visit
          </h2>

          {hasGettingThere ? (
            <div className={styles.subsection}>
              <h3 className={styles.subheading} id="getting-there">
                Getting there
              </h3>
              {hasDirections ? (
                <div className={styles.factList}>
                  {access?.nearestStation || access?.walkFromStation ? (
                    <Fact icon="train" label="Nearest station">
                      {[access.nearestStation?.value, access.walkFromStation?.value]
                        .filter(Boolean)
                        .join(" · ")}
                    </Fact>
                  ) : null}
                  {access?.floorNote ? (
                    <Fact icon="locate" label="Finding the door">
                      {access.floorNote.value}
                    </Fact>
                  ) : null}
                  {shop.addressLines && shop.addressLines.length > 0 ? (
                    <Fact icon="locate" label="Address">
                      {shop.addressLines.join(", ")}
                    </Fact>
                  ) : null}
                </div>
              ) : null}

              {/*
                Trip context, inside getting there rather than a section of its
                own at the foot of the page: which other shops are within reach
                is part of how you plan getting to this one.
              */}
              <ShopNearby nearby={nearby} localityName={shop.localityName} />
            </div>
          ) : null}

          {/*
            Always present: opening hours say something on every record — the
            published table, or the one caution that they are not published. The
            other rows inside it come and go with the record's own evidence.
          */}
          <div className={styles.subsection}>
            <h3 className={styles.subheading} id="before-you-go">
              Before you go
            </h3>
            {/*
                Ordinary unsupported fields are omitted silently, but unknown
                hours are the case accepted decision 1 allows one caution for:
                turning up to a closed shop is the failure this page exists to
                prevent.
              */}
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

            <div className={styles.factList}>
              {practical?.appointmentRequired?.value ? (
                <Fact icon="clock" label="Appointment">
                  An appointment is required.
                </Fact>
              ) : null}
              {practical?.paymentMethods &&
              practical.paymentMethods.values.length > 0 ? (
                <Fact icon="card" label="Payment">
                  {practical.paymentMethods.values.join(", ")}
                </Fact>
              ) : null}
              {practical?.languages && practical.languages.values.length > 0 ? (
                <Fact icon="globe" label="Languages">
                  {practical.languages.values.join(", ")}
                </Fact>
              ) : null}
              {access?.accessibilityNote ? (
                <Fact icon="accessibility" label="Accessibility">
                  {access.accessibilityNote.value}
                </Fact>
              ) : null}
              {/*
                The shop's own website, as a contextual link. It was a second
                header button until the founder's staging review: the website is
                visit information, and it only needs to be on the page once.
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
            Reviewer-only, and deliberately outside both subsections: a shop with
            no sourced address renders no *Getting there* at all, and the
            coordinate note is evidence a sourcing review needs, so it must not
            disappear with the subsection. It renders nothing for a normal
            tester.
          */}
          <ShopPositionDiagnostic shop={shop} />
        </section>

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

        {/* 7 — quiet provenance, then the correction route. */}
        <ShopProvenance shop={shop} />
        <ShopCorrection shopSlug={shop.slug} />
      </div>
    </div>
  );
}
