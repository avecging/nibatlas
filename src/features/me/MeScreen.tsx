"use client";

import Link from "next/link";

import { NibAtlasMark } from "@/src/components/brand/NibAtlasMark";
import { Icon, type IconName } from "@/src/components/ui/Icon";
import { PrototypeBadge } from "@/src/components/ui/StatusBadge";
import { useCollection } from "@/src/features/collection/collection-store";

import styles from "./MeScreen.module.css";

interface RowProps {
  readonly icon: IconName;
  readonly title: string;
  readonly detail: string;
  readonly href?: string;
  readonly action?: string;
}

/**
 * Me is deliberately conventional. Every row either navigates somewhere real or
 * says plainly that the action arrives with a later milestone — nothing pretends
 * to work.
 */
function Row({ icon, title, detail, href, action }: RowProps) {
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
        {action ? <span className={styles.pending}>{action}</span> : null}
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

  const localitySeals = seals.filter((seal) => seal.scope === "locality");
  const countrySeals = seals.filter((seal) => seal.scope === "country");

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
        <PrototypeBadge>Prototype</PrototypeBadge>
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
            action="Sign-in arrives in Milestone 4"
          />
        </ul>
      </Section>

      <Section
        id="me-geography"
        title="Places visited"
        description="Derived from the shop stamps you have collected. Nothing here is recorded automatically."
      >
        <div className={styles.stats}>
          <p className={styles.stat}>
            <span className={styles.statValue}>{passport.stampCount}</span>
            <span className={styles.statLabel}>Shop stamps</span>
          </p>
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
            No visits yet. Collect a stamp at a shop and the country and locality
            appear here.
          </p>
        ) : (
          <ul className={styles.geoList}>
            {countryProgress.map((country) => {
              const localities = localitySeals.filter(
                (seal) => seal.countryCode === country.countryCode,
              );

              return (
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
                        {country.stampCount} of {country.required} stamps towards the
                        country seal
                      </span>
                    )}
                  </div>
                  <p className={styles.geoLocalities}>
                    {localities.length === 0
                      ? "No localities yet"
                      : localities
                          .map((seal) => seal.localityName)
                          .filter((name): name is string => Boolean(name))
                          .join(" · ")}
                  </p>
                  {country.coverageSetVersion ? (
                    <p className={styles.geoVersion}>
                      Counted against curated set {country.coverageSetVersion}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <p className={styles.sectionNote}>
          <Link className={styles.inlineLink} href="/passport">
            Open Passport
          </Link>{" "}
          to see the impressions themselves.
        </p>
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

      <Section
        id="me-location"
        title="Location and check-in"
        description="The one place Nib Atlas asks for your location, and what happens to it."
      >
        <div className={styles.explainer}>
          <p>
            <strong>Nib Atlas does not track where you go.</strong> There is no
            background location, no location history, and no automatic visit
            recording. Nothing about your position is collected while you browse the
            map.
          </p>
          <p>
            Location is requested once, in the foreground, at the moment you tap{" "}
            <strong>Collect Stamp</strong> at a shop. The position is used to check
            you are at that shop, then discarded. Raw coordinates are never stored.
          </p>
          <p>
            You choose every time. If you decline, the map, shop pages, and search
            keep working exactly as before — you simply do not collect that stamp.
          </p>
          <p className={styles.explainerNote}>
            This prototype does not request your location at all. Collection is
            simulated so the ceremony and Passport can be reviewed.
          </p>
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
            action="Arrives in Milestone 8"
          />
          <Row
            icon="alert"
            title="Delete my account"
            detail="Removes your profile, saves, and collected stamps. This cannot be undone."
            action="Arrives in Milestone 8"
          />
        </ul>
      </Section>

      <Section id="me-help" title="Help and account">
        <ul className={styles.rows}>
          <Row
            icon="help"
            title="Help and contact"
            detail="Report incorrect shop information or ask for help with a failed collection."
            action="Arrives in Milestone 6"
          />
          <Row
            icon="logout"
            title="Sign out"
            detail="Ends the session on this device. Your Passport stays on your account."
            action="Needs an account first"
          />
        </ul>
      </Section>

      <Section id="me-prototype" title="Prototype controls">
        <p className={styles.sectionNote}>
          Milestone 1 keeps saves and simulated collections in this browser session
          only. Nothing is sent anywhere.
        </p>
        <ul className={styles.rows}>
          <li>
            <button className={styles.row} type="button" onClick={resetPrototypeState}>
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
    </div>
  );
}
