import type { ReactNode } from "react";

import { localeForCountry } from "@/src/components/shops/locale";
import { Icon } from "@/src/components/ui/Icon";
import {
  OperationalStatusBadge,
  PrototypeBadge,
} from "@/src/components/ui/StatusBadge";
import {
  POSITION_PRECISION_LABELS,
  SHOP_TYPE_LABELS,
  SOURCE_KIND_LABELS,
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

interface ShopDetailViewProps {
  readonly shop: ShopDetail;
  /** Client island holding save, external link, and simulated collection. */
  readonly actions: ReactNode;
  /** Client island showing live saved/visited state. */
  readonly statusBadges: ReactNode;
  /** Client island resolving where "Back" returns to. */
  readonly back: ReactNode;
}

/**
 * Shop detail.
 *
 * The page answers "should I visit this shop?" — never "how highly is it rated?"
 * There are no ratings, review prose, engagement counts, stock claims, or
 * e-commerce actions anywhere on it.
 *
 * Every section renders only when its source-supported data exists. A shop with
 * no published hours shows no hours table and no invented placeholder; a shop
 * with no confirmed brand list shows no brand section at all. What the interface
 * does say, always, is where the facts came from.
 */
export function ShopDetailView({
  shop,
  actions,
  statusBadges,
  back,
}: ShopDetailViewProps) {
  const specialties = shop.specialties ?? [];
  const services = shop.services ?? [];
  const brands = shop.brands ?? [];
  const links = shop.links ?? [];
  const hours = shop.openingHours ?? [];
  const hasWhyVisit =
    Boolean(shop.shortDescription) || specialties.length > 0 || services.length > 0;

  return (
    <div className={styles.page}>
      {back}

      <header className={styles.header}>
        <h1 className={styles.title}>{shop.name}</h1>
        {shop.localName ? (
          <p className={styles.localTitle} lang={localeForCountry(shop.countryCode)}>
            {shop.localName}
          </p>
        ) : null}
        <p className={styles.lede}>
          {shop.localityName} ·{" "}
          {shop.shopTypes.map((type) => SHOP_TYPE_LABELS[type]).join(" · ")}
        </p>
        <div className={styles.badges}>
          {statusBadges}
          <OperationalStatusBadge status={shop.operationalStatus} />
        </div>
        {shop.shortDescription ? (
          <p className={styles.lede}>{shop.shortDescription}</p>
        ) : null}
        {actions}
      </header>

      <div className={styles.grid}>
        {hasWhyVisit ? (
          <section className={styles.section} aria-labelledby="why-visit">
            <h2 className={styles.sectionTitle} id="why-visit">
              Why it may be worth visiting
            </h2>
            {shop.specialtyLine ? (
              <p className={styles.plain}>{shop.specialtyLine}</p>
            ) : null}
            {specialties.length > 0 ? (
              <TagList items={specialties} label="Specialties" />
            ) : null}
            {services.length > 0 ? <TagList items={services} label="Services" /> : null}
          </section>
        ) : null}

        <section className={styles.section} aria-labelledby="visit-info">
          <h2 className={styles.sectionTitle} id="visit-info">
            Planning a visit
          </h2>
          <div className={styles.factList}>
            {shop.addressLines && shop.addressLines.length > 0 ? (
              <p className={styles.fact}>
                <Icon name="locate" size={18} />
                <span>
                  <span className={styles.factLabel}>Address</span>
                  {shop.addressLines.join(", ")}
                </span>
              </p>
            ) : null}
            {shop.appointmentRequired ? (
              <p className={styles.fact}>
                <Icon name="clock" size={18} />
                <span>
                  <span className={styles.factLabel}>Appointment</span>
                  An appointment is required.
                </span>
              </p>
            ) : null}
            {shop.accessibilityNotes ? (
              <p className={styles.fact}>
                <Icon name="accessibility" size={18} />
                <span>
                  <span className={styles.factLabel}>Accessibility</span>
                  {shop.accessibilityNotes}
                </span>
              </p>
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
            <p className={styles.fact}>
              <Icon name="map" size={18} />
              <span>
                <span className={styles.factLabel}>Map position</span>
                {POSITION_PRECISION_LABELS[shop.positionPrecision]}. Not a surveyed
                coordinate.
              </span>
            </p>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="hours">
          <h2 className={styles.sectionTitle} id="hours">
            Opening hours
          </h2>
          {hours.length === 0 ? (
            <p className={styles.plain}>
              {shop.openingHoursNote ??
                "No opening hours are recorded for this shop, so none are shown."}
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
            </>
          )}
          <p className={styles.fact}>
            <Icon name="alert" size={18} />
            <span>Always confirm with the shop before travelling.</span>
          </p>
        </section>

        {brands.length > 0 ? (
          <section className={styles.section} aria-labelledby="brands">
            <h2 className={styles.sectionTitle} id="brands">
              Brands seen at this shop
            </h2>
            <p className={styles.plain}>
              Supporting information only, taken from the source below. Stock changes
              without notice and Nib Atlas is not a product catalogue.
            </p>
            <TagList items={brands} label="Brands" />
          </section>
        ) : null}

        <section
          className={`${styles.provenance} ${styles.wide}`}
          aria-labelledby="provenance"
        >
          <h2 className="type-h3" id="provenance">
            Where this came from
          </h2>
          <p>
            Nib Atlas shows only what a source supports. Anything a source did not
            confirm is left off this page rather than filled in.
          </p>
          <ul className={styles.sourceList}>
            {shop.sources.map((source) => (
              <li className={styles.sourceRow} key={`${source.label}-${source.retrievedOn}`}>
                <span className={styles.sourceKind}>{SOURCE_KIND_LABELS[source.kind]}</span>
                <p className={styles.sourceLabel}>
                  {source.url ? (
                    <a href={source.url} rel="noreferrer noopener" target="_blank">
                      {source.label}
                    </a>
                  ) : (
                    source.label
                  )}
                </p>
                <span className={styles.sourceMeta}>
                  Read {source.retrievedOn} · confirms {source.confirms.join(", ")}
                </span>
              </li>
            ))}
          </ul>
          <div className={styles.provenanceFooter}>
            <PrototypeBadge>Prototype catalogue</PrototypeBadge>
            <span>
              This is a small sourced sample for review, not a complete or
              continuously verified catalogue. Reporting incorrect information
              arrives with the founder administration milestone.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
