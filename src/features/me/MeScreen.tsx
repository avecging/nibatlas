"use client";

import Link from "next/link";

import { NibAtlasMark } from "@/src/components/brand/NibAtlasMark";
import { Icon, type IconName } from "@/src/components/ui/Icon";
import { useCollection } from "@/src/features/collection/collection-store";
import { ReviewerModeBadge } from "@/src/features/reviewer/ReviewerModeBadge";
import { useReviewerMode } from "@/src/features/reviewer/ReviewerModeProvider";

import styles from "./MeScreen.module.css";

interface RowProps {
  readonly icon: IconName;
  readonly title: string;
  readonly detail: string;
  readonly href?: string;
  /** What a normal tester reads: why the row cannot be used yet, in plain terms. */
  readonly action?: string;
  /** The same fact with its milestone number, for internal review. */
  readonly reviewerAction?: string;
}

/**
 * Me is deliberately conventional. Every row either navigates somewhere real or
 * says plainly that it cannot be used yet — nothing pretends to work.
 *
 * A row that is not ready says so without a milestone number. "Arrives in
 * Milestone 8" tells a tester nothing they can act on and tells them a great
 * deal about how the product is built; "Needs an account" is the same fact in
 * their terms. The milestone wording stays available in reviewer mode, where it
 * is the useful form.
 */
function Row({ icon, title, detail, href, action, reviewerAction }: RowProps) {
  const reviewer = useReviewerMode();
  const pendingLabel = reviewer ? (reviewerAction ?? action) : action;
  const body = (
    <>
      <span className={styles.rowIcon} aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        <span className={styles.rowDetail}>{detail}</span>
      </span>
      {href ? <Icon name="chevron-right" size={18} /> : null}
    </>
  );

  if (href) {
    return (
      <li>
        <Link className={styles.row} href={href}>
          {body}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <div className={styles.row} data-pending="true">
        {body}
        {pendingLabel ? <span className={styles.pending}>{pendingLabel}</span> : null}
      </div>
    </li>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 className={styles.sectionTitle} id={id}>
        {title}
      </h2>
      {description ? <p className={styles.sectionNote}>{description}</p> : null}
      {children}
    </section>
  );
}

export function MeScreen() {
  const { passport, seals, countryProgress, resetPrototypeState } = useCollection();
  const reviewer = useReviewerMode();

  const localitySeals = seals.filter((seal) => seal.scope === "locality");
  const countrySeals = seals.filter((seal) => seal.scope === "country");

  /** Countries and localities the collected stamps actually represent. */
  const visitedCountries = passport.countries.map((country) => ({
    countryCode: country.countryCode,
    countryLabel: country.countryLabel,
    stampCount: country.stampCount,
    localityNames: country.localities.map((locality) => locality.name),
  }));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.avatar} aria-hidden="true">
          <NibAtlasMark size={34} />
        </span>
        <div>
          <h1 className={styles.title}>Me</h1>
          <p className={styles.subtitle}>
            Your profile, the places you have been, and the controls over your own
            data.
          </p>
        </div>
        <ReviewerModeBadge />
      </header>

      <Section
        id="me-profile"
        title="Profile"
        description="Nib Atlas is anonymous until you choose to sign in. Exploring the map and opening shop pages never needs an account."
      >
        <ul className={styles.rows}>
          <Row
            icon="person"
            title="Not signed in"
            detail="Saving shops and keeping a Passport need an account. Browsing does not."
            action="Sign-in not available yet"
            reviewerAction="Sign-in arrives in Milestone 4"
          />
        </ul>
      </Section>

      <Section
        id="me-geography"
        title="Places visited"
        description="Countries and localities your collected shop stamps represent. Nothing here is recorded automatically."
      >
        {/*
          Visited geography comes from the stamps themselves, never from seals. A
          country is visited on its first stamp; its seal is a separate threshold
          that may take four more. Reporting seals here would hide a country the
          reader has genuinely been to.
        */}
        <div className={styles.stats}>
          <p className={styles.stat}>
            <span className={styles.statValue}>{passport.stampCount}</span>
            <span className={styles.statLabel}>Shop stamps</span>
          </p>
          <p className={styles.stat}>
            <span className={styles.statValue}>{passport.countryCount}</span>
            <span className={styles.statLabel}>Countries visited</span>
          </p>
          <p className={styles.stat}>
            <span className={styles.statValue}>{passport.localityCount}</span>
            <span className={styles.statLabel}>Localities visited</span>
          </p>
        </div>

        {visitedCountries.length === 0 ? (
          <p className={styles.empty}>
            No visits yet. Collect a stamp at a shop and the country and locality
            appear here.
          </p>
        ) : (
          <ul className={styles.geoList}>
            {visitedCountries.map((country) => (
              <li className={styles.geoRow} key={country.countryCode}>
                <div className={styles.geoHead}>
                  <span className={styles.geoName}>{country.countryLabel}</span>
                  <span className={styles.geoProgress}>
                    {country.stampCount} stamp{country.stampCount === 1 ? "" : "s"} ·{" "}
                    {country.localityNames.length} localit
                    {country.localityNames.length === 1 ? "y" : "ies"}
                  </span>
                </div>
                <p className={styles.geoLocalities}>
                  {country.localityNames.length === 0
                    ? "No localities yet"
                    : country.localityNames.join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.sectionNote}>
          <Link className={styles.inlineLink} href="/passport">
            Open Passport
          </Link>{" "}
          to see the impressions themselves.
        </p>
      </Section>

      <Section
        id="me-seals"
        title="Seal progress"
        description="Seals are separate from places visited. They derive from verified stamps once a country reaches its threshold."
      >
        <div className={styles.stats}>
          <p className={styles.stat}>
            <span className={styles.statValue}>{countrySeals.length}</span>
            <span className={styles.statLabel}>Country seals</span>
          </p>
          <p className={styles.stat}>
            <span className={styles.statValue}>{localitySeals.length}</span>
            <span className={styles.statLabel}>Locality seals</span>
          </p>
        </div>

        {countryProgress.length === 0 ? (
          <p className={styles.empty}>
            Collect a stamp and its locality seal derives straight away.
          </p>
        ) : (
          <ul className={styles.geoList}>
            {countryProgress.map((country) => (
              <li className={styles.geoRow} key={country.countryCode}>
                <div className={styles.geoHead}>
                  <span className={styles.geoName}>{country.countryLabel}</span>
                  {country.earned ? (
                    <span className={styles.geoSeal}>
                      <Icon name="seal" size={14} />
                      Country seal earned
                    </span>
                  ) : (
                    <span className={styles.geoProgress}>
                      {country.requirementFromCuratedSet
                        ? `${country.progressCount} of ${country.required} curated shops collected`
                        : `${country.progressCount} of ${country.required} stamps towards the country seal`}
                    </span>
                  )}
                </div>
                {reviewer && country.coverageSetVersion ? (
                  <p className={styles.geoVersion}>
                    Counted against curated set {country.coverageSetVersion}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="me-preferences" title="Preferences and accessibility">
        <ul className={styles.rows}>
          <Row
            icon="settings"
            title="Reduced motion"
            detail="Nib Atlas follows your operating system's reduce-motion setting. Page turns and the stamp ceremony become an immediate change with a short fade."
            action="No in-app override"
          />
          <Row
            icon="accessibility"
            title="Accessibility"
            detail="Every map result has a list equivalent, status never relies on colour alone, and controls are keyboard operable with visible focus."
            action="Reference only"
          />
        </ul>
      </Section>

      {/*
        WP1 reduces the location explanation to one sentence and sends the reader
        to Privacy for the rest. Four paragraphs in Me was the acceptance
        checklist answering itself: nothing on this screen requests a position,
        so there is nothing here for the reader to decide.
      */}
      <Section id="me-location" title="Location">
        <div className={styles.explainer}>
          <p>
            Nib Atlas never tracks where you go. Your location is used once, when
            you collect a stamp at a shop, and then discarded.{" "}
            <Link className={styles.inlineLink} href="/privacy">
              How location is used
            </Link>
            .
          </p>
          {reviewer ? (
            <p className={styles.explainerNote}>
              Reviewer note: this build does not request your location at all.
              Collection is simulated so the ceremony and Passport can be reviewed.
            </p>
          ) : null}
        </div>
      </Section>

      <Section id="me-privacy" title="Privacy and your data">
        <ul className={styles.rows}>
          <Row
            icon="shield"
            title="Privacy policy"
            detail="Plain-language explanation of what Nib Atlas stores and what it does not."
            href="/privacy"
          />
          <Row
            icon="download"
            title="Export my data"
            detail="A machine-readable copy of your profile, saved shops, and collected stamps."
            action="Needs an account"
            reviewerAction="Arrives in Milestone 8"
          />
          <Row
            icon="alert"
            title="Delete my account"
            detail="Removes your profile, saves, and collected stamps. This cannot be undone."
            action="Needs an account"
            reviewerAction="Arrives in Milestone 8"
          />
        </ul>
      </Section>

      <Section id="me-help" title="Help and account">
        <ul className={styles.rows}>
          <Row
            icon="map"
            title="About Nib Atlas"
            detail="What the catalogue is, and the countries it covers today."
            href="/about"
          />
          <Row
            icon="help"
            title="Help and contact"
            detail="Report incorrect shop information or ask for help with a failed collection."
            action="Not available yet"
            reviewerAction="Arrives in Milestone 6"
          />
          <Row
            icon="logout"
            title="Sign out"
            detail="Ends the session on this device. Your Passport stays on your account."
            action="Needs an account first"
          />
        </ul>
      </Section>

      {/*
        Reviewer-only, and gated with a conditional rather than CSS so the reset
        control is not merely invisible to a tester — it is not in their document
        at all, and cannot be reached by keyboard or assistive technology.
      */}
      {reviewer ? (
        <Section id="me-prototype" title="Prototype controls">
          <p className={styles.sectionNote}>
            This build keeps saves and simulated collections in this browser session
            only. Nothing is sent anywhere.
          </p>
          <ul className={styles.rows}>
            <li>
              <button
                className={styles.row}
                type="button"
                onClick={resetPrototypeState}
              >
                <span className={styles.rowIcon} aria-hidden="true">
                  <Icon name="clock" size={20} />
                </span>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>Reset the prototype session</span>
                  <span className={styles.rowDetail}>
                    Restores the seeded saves and simulated impressions.
                  </span>
                </span>
              </button>
            </li>
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
