import Link from "next/link";
import type { ReactNode } from "react";

import { localeForCountry } from "@/src/components/shops/locale";
import { Icon } from "@/src/components/ui/Icon";
import {
  DemoBadge,
  OperationalStatusBadge,
} from "@/src/components/ui/StatusBadge";
import { SHOP_TYPE_LABELS, type ShopDetail } from "@/src/domain/shop-detail";

import styles from "./ShopDetailView.module.css";

const DAY_LABELS: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

function TagList({ items, label }: { readonly items: readonly string[]; readonly label: string }) {
  if (items.length === 0) {
    return (
      <p className={styles.plain}>No {label.toLowerCase()} recorded for this demo record.</p>
    );
  }

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
}

export function ShopDetailView({ shop, actions, statusBadges }: ShopDetailViewProps) {
  return (
    <div className={styles.page}>
      <Link className={styles.back} href="/">
        <Icon name="chevron-right" size={16} />
        Back to map
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>{shop.name}</h1>
        {shop.localName ? (
          <p className={styles.localTitle} lang={localeForCountry(shop.countryCode)}>
            {shop.localName}
          </p>
        ) : null}
        <p className={styles.lede}>
          {shop.localityName} · {shop.shopTypes.map((type) => SHOP_TYPE_LABELS[type]).join(" · ")}
        </p>
        <div className={styles.badges}>
          {statusBadges}
          <OperationalStatusBadge status={shop.operationalStatus} />
          <DemoBadge>Demo record</DemoBadge>
        </div>
        <p className={styles.lede}>{shop.shortDescription}</p>
        {actions}
      </header>

      <div className={styles.grid}>
        <section className={styles.section} aria-labelledby="why-visit">
          <h2 className={styles.sectionTitle} id="why-visit">
            Why it may be worth visiting
          </h2>
          <TagList items={shop.specialties} label="Specialties" />
          <TagList items={shop.services} label="Services" />
        </section>

        <section className={styles.section} aria-labelledby="visit-info">
          <h2 className={styles.sectionTitle} id="visit-info">
            Planning a visit
          </h2>
          <div className={styles.factList}>
            <p className={styles.fact}>
              <Icon name="locate" size={18} />
              <span>
                <span className={styles.factLabel}>Address</span>
                {shop.addressLines.join(", ")}
              </span>
            </p>
            <p className={styles.fact}>
              <Icon name="clock" size={18} />
              <span>
                <span className={styles.factLabel}>Appointment</span>
                {shop.appointmentRequired
                  ? "An appointment is required for this demo record."
                  : "No appointment recorded for this demo record."}
              </span>
            </p>
            <p className={styles.fact}>
              <Icon name="accessibility" size={18} />
              <span>
                <span className={styles.factLabel}>Accessibility</span>
                {shop.accessibilityNotes ?? "No accessibility information recorded."}
              </span>
            </p>
            {shop.links.map((link) => (
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
          </div>
        </section>

        <section className={styles.section} aria-labelledby="hours">
          <h2 className={styles.sectionTitle} id="hours">
            Opening hours
          </h2>
          {shop.openingHours.length === 0 ? (
            <p className={styles.plain}>
              {shop.openingHoursNote ?? "Hours are not recorded for this demo record."}
            </p>
          ) : (
            <div className={styles.hours}>
              {shop.openingHours.map((entry) => (
                <p className={styles.hourRow} key={entry.day}>
                  <span>{DAY_LABELS[entry.day]}</span>
                  <span>
                    {entry.closed
                      ? "Closed"
                      : `${entry.opens ?? "—"}–${entry.closes ?? "—"}${
                          entry.note ? ` · ${entry.note}` : ""
                        }`}
                  </span>
                </p>
              ))}
            </div>
          )}
          <p className={styles.fact}>
            <Icon name="alert" size={18} />
            <span>Demo hours. Always confirm with the shop before travelling.</span>
          </p>
        </section>

        <section className={styles.section} aria-labelledby="brands">
          <h2 className={styles.sectionTitle} id="brands">
            Brands carried
          </h2>
          <p className={styles.plain}>
            Supporting information only. Stock changes without notice and Nib Atlas is
            not a product catalogue.
          </p>
          <TagList items={shop.brands} label="Brands" />
        </section>

        <section className={`${styles.provenance} ${styles.wide}`} aria-labelledby="freshness">
          <h2 className="type-h3" id="freshness">
            Data freshness
          </h2>
          <p>{shop.provenance.summary}</p>
          <p>
            Last verified:{" "}
            {shop.provenance.lastVerifiedAt ?? "never — this listing is fixture data"}.
          </p>
          <p>
            Reporting incorrect information arrives with the founder administration
            milestone.
          </p>
        </section>
      </div>
    </div>
  );
}
