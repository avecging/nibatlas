import Link from "next/link";

import { Icon } from "@/src/components/ui/Icon";
import {
  SERVICE_ACCESS_MODE_LABELS,
  type ShopDetail,
  type ShopService,
} from "@/src/domain/shop-detail";
import {
  CONTRIBUTION_INVITATION,
  MATERIAL_GAP_CAUTION,
  hasSourcedValueLayer,
} from "@/src/domain/shop-evidence";
import { shopCorrectionPath } from "@/src/features/contribute/contribute-links";

import styles from "./ShopDetailView.module.css";

/**
 * What you can do there, and what is only available here.
 *
 * The two sections root cause D in `docs/milestone-1-5-product-refinement.md`
 * asks for. A service carries how it is reached and how long it takes, because
 * that is what separates a repair bench from a shelf; an exclusive is the reason
 * a pen traveller detours, and is the field a general listing can never have.
 *
 * Every entry is rendered from a record that named the source backing it. There
 * is no path here that can produce a claim the data does not carry.
 *
 * `ShopWhatYouCanDo` no longer ships on the public shop page. The founder's
 * 20 September decision is that published editorial answers "what can I do
 * here?" once, under one heading, rather than having this section answer it
 * again under a second one. It is kept whole — with its access modes,
 * durations and booking qualifiers — and rendered in the styleguide, because
 * the data, the evidence rules and the design all survive the page it came off.
 * `ShopExclusives` and `ShopValueGap` are unaffected and still public.
 */

function ServiceRow({ service }: { readonly service: ShopService }) {
  const mode =
    service.accessMode === undefined
      ? null
      : SERVICE_ACCESS_MODE_LABELS[service.accessMode];
  const meta = [mode, service.duration].filter(Boolean).join(" · ");

  return (
    <li className={styles.valueRow}>
      <span className={styles.valueLabel}>{service.label}</span>
      {meta ? <span className={styles.valueMeta}>{meta}</span> : null}
      {service.note ? <span className={styles.valueNote}>{service.note}</span> : null}
    </li>
  );
}

export function ShopWhatYouCanDo({ shop }: { readonly shop: ShopDetail }) {
  const services = shop.services ?? [];
  const experiences = shop.experiences ?? [];

  if (services.length === 0 && experiences.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-labelledby="what-you-can-do">
      <h2 className={styles.sectionTitle} id="what-you-can-do">
        What you can do there
      </h2>

      {/*
        Two groups, labelled. Without the subheadings a nib grind and a test
        bench read as one undifferentiated list, and the distinction — something
        done to your pen, versus something you do in the shop — is the reason the
        section is more useful than a directory's "services" field.
      */}
      {services.length > 0 ? (
        <div className={styles.subsection}>
          <h3 className={styles.subheading} id="services">
            Services
          </h3>
          <ul className={styles.valueList} aria-label="Services">
            {services.map((service) => (
              <ServiceRow key={service.label} service={service} />
            ))}
          </ul>
        </div>
      ) : null}

      {experiences.length > 0 ? (
        <div className={styles.subsection}>
          <h3 className={styles.subheading} id="experiences">
            In the shop
          </h3>
          <ul className={styles.valueList} aria-label="In-store experiences">
            {experiences.map((experience) => (
              <li className={styles.valueRow} key={experience.label}>
                <span className={styles.valueLabel}>{experience.label}</span>
                {experience.bookingRequired === undefined ? null : (
                  <span className={styles.valueMeta}>
                    {experience.bookingRequired ? "Booking needed" : "No booking needed"}
                  </span>
                )}
                {experience.detail ? (
                  <span className={styles.valueNote}>{experience.detail}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function ShopExclusives({ shop }: { readonly shop: ShopDetail }) {
  const exclusives = shop.exclusives ?? [];

  if (exclusives.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-labelledby="only-here">
      <h2 className={styles.sectionTitle} id="only-here">
        Only available here
      </h2>
      <ul className={styles.valueList} aria-label="Only available here">
        {exclusives.map((exclusive) => (
          <li className={styles.valueRow} key={exclusive.label}>
            <span className={styles.valueLabel}>{exclusive.label}</span>
            {exclusive.detail ? (
              <span className={styles.valueNote}>{exclusive.detail}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The one caution a material gap earns, and the invitation that follows it.
 *
 * It carries the same heading the populated editorial section does, so the
 * question a reader is asking is named the same way on every record whether or
 * not it is answered. Its condition is deliberately unchanged: a record with
 * sourced services still counts as having a value layer, so the page stays
 * silent about them rather than claiming nothing was confirmed when something
 * was.
 *
 * Not an explanation of the omission, not a list of the fields that are empty,
 * and not an apology: one sentence saying what is not known, and one asking the
 * person who does know. The mail carries the shop's name so the reply is
 * actionable: it opens the same correction form the foot of the page does, and
 * that form already knows which shop it is about.
 */
export function ShopValueGap({ shop }: { readonly shop: ShopDetail }) {
  if (hasSourcedValueLayer(shop)) {
    return null;
  }

  return (
    <section
      className={`${styles.section} ${styles.gap}`}
      aria-labelledby="what-you-can-do-unknown"
      data-testid="shop-value-gap"
    >
      <h2 className={styles.sectionTitle} id="what-you-can-do-unknown">
        What you can do here
      </h2>
      <p className={styles.fact}>
        <Icon name="alert" size={18} />
        <span>{MATERIAL_GAP_CAUTION}</span>
      </p>
      <p className={styles.plain}>
        <Link className={styles.inlineLink} href={shopCorrectionPath(shop.slug)}>
          {CONTRIBUTION_INVITATION}
        </Link>
      </p>
    </section>
  );
}
