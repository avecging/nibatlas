import type { ReactNode } from "react";

import { ShopCorrection } from "@/src/components/shops/ShopCorrection";
import { ShopIdentityHero, ShopLocalName } from "@/src/components/shops/ShopIdentityHero";
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
import { type OpeningHoursDay, type ShopDetail } from "@/src/domain/shop-detail";

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
  /** Client island holding save, native directions, and simulated collection. */
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
 * WP4 reorders it to the sequence
 * `docs/milestone-1-5-product-refinement.md` approves, because root cause D was
 * that Milestone 1's page was structurally a directory entry: identity, then the
 * shop's own name and why it is worth the trip, then **what you can do there**,
 * then **what is only available here**, then practical access, then the actions,
 * then nearby shops as trip context, and finally a quiet provenance line with the
 * correction route.
 *
 * Every section renders only when its source-supported data exists. Ordinary
 * unsupported fields are omitted in silence. The one exceptions are opening
 * hours and the value layer itself, where not knowing changes whether the trip
 * happens at all — those get one concise caution each.
 */
export function ShopDetailView({
  shop,
  nearby,
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
  const hasVisitFacts =
    Boolean(access) ||
    Boolean(practical) ||
    (shop.addressLines?.length ?? 0) > 0 ||
    links.length > 0;

  return (
    <div className={styles.page}>
      {back}

      {/* 1 — the designed identity, standing in for a photograph. */}
      <ShopIdentityHero shop={shop} />

      {/* 2 — the shop's own name, then one line on why it may be worth the trip. */}
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
      </header>

      <div className={styles.grid}>
        {/* 3 — what you can do there, or the one caution when nothing is sourced. */}
        <ShopWhatYouCanDo shop={shop} />
        <ShopValueGap shop={shop} />

        {/* 4 — the reason a pen traveller detours. */}
        <ShopExclusives shop={shop} />

        {/* 5 — practical visit information. */}
        {hasVisitFacts ? (
          <section className={styles.section} aria-labelledby="visit-info">
            <h2 className={styles.sectionTitle} id="visit-info">
              Getting there
            </h2>
            <div className={styles.factList}>
              {access?.nearestStation || access?.walkFromStation ? (
                <Fact icon="train" label="Nearest station">
                  {[access.nearestStation, access.walkFromStation]
                    .filter(Boolean)
                    .join(" · ")}
                </Fact>
              ) : null}
              {access?.floorNote ? (
                <Fact icon="locate" label="Finding the door">
                  {access.floorNote}
                </Fact>
              ) : null}
              {shop.addressLines && shop.addressLines.length > 0 ? (
                <Fact icon="locate" label="Address">
                  {shop.addressLines.join(", ")}
                </Fact>
              ) : null}
              {practical?.appointmentRequired ? (
                <Fact icon="clock" label="Appointment">
                  An appointment is required.
                </Fact>
              ) : null}
              {practical?.paymentMethods && practical.paymentMethods.length > 0 ? (
                <Fact icon="card" label="Payment">
                  {practical.paymentMethods.join(", ")}
                </Fact>
              ) : null}
              {practical?.languages && practical.languages.length > 0 ? (
                <Fact icon="globe" label="Languages">
                  {practical.languages.join(", ")}
                </Fact>
              ) : null}
              {access?.accessibilityNote ? (
                <Fact icon="accessibility" label="Accessibility">
                  {access.accessibilityNote}
                </Fact>
              ) : null}
              {links.map((link) => (
                <p className={styles.fact} key={link.url}>
                  <Icon name="link" size={18} />
                  <span>
                    <span className={styles.factLabel}>
                      {link.isOfficial ? "Official site" : "Reference"}
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
              <ShopPositionDiagnostic shop={shop} />
            </div>
          </section>
        ) : null}

        <section className={styles.section} aria-labelledby="hours">
          <h2 className={styles.sectionTitle} id="hours">
            Opening hours
          </h2>
          {/*
            Ordinary unsupported fields are omitted silently, but unknown hours
            are the case accepted decision 1 allows one caution for: turning up
            to a closed shop is the failure this page exists to prevent.
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

        {/* 6 — Save, native Directions, Collect Stamp. */}
        <div className={`${styles.actionBlock} ${styles.wide}`}>{actions}</div>

        {/* 7 — nearby pen shops as trip-planning context. */}
        <ShopNearby nearby={nearby} localityName={shop.localityName} />

        {/* 8 — quiet provenance, then the correction route. */}
        <ShopProvenance shop={shop} />
        <ShopCorrection shopName={shop.name} />
      </div>
    </div>
  );
}
