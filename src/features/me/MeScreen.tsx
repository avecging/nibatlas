"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { NibAtlasMark } from "@/src/components/brand/NibAtlasMark";
import { Icon, type IconName } from "@/src/components/ui/Icon";
import {
  DISPLAY_NAME_MAX_LENGTH,
  accountHeadline,
} from "@/src/features/account/account-session";
import { useAccountSession } from "@/src/features/account/AccountSessionProvider";
import { useCollection } from "@/src/features/collection/collection-store";
import { buildLocalDataExport, downloadLocalData } from "@/src/features/me/local-data";
import { ReviewerModeBadge } from "@/src/features/reviewer/ReviewerModeBadge";
import { useReviewerMode } from "@/src/features/reviewer/ReviewerModeProvider";

import styles from "./MeScreen.module.css";

/**
 * Me, restructured for WP2.
 *
 * `docs/milestone-1-5-product-refinement.md` — *Revised Me structure* — replaces
 * Milestone 1's single undifferentiated list with two distinct states and four
 * named groups. Three things drive the shape:
 *
 * 1. **The two states are different screens, not one screen with extra rows.**
 *    A signed-out reader is offered an account and told where their data lives;
 *    a signed-in reader is shown who they are and given the controls that only
 *    make sense once an account exists, including a separated Danger group.
 * 2. **Every control either works or says plainly that it does not.** Rows that
 *    cannot be used carry the reason in the reader's terms, never a milestone
 *    number — that wording stays available in reviewer mode, where it is the
 *    useful form.
 * 3. **Places visited is compact and clickable.** It is a route into the
 *    Passport rather than a second rendering of it.
 *
 * Authentication is Milestone 4, so the signed-in state cannot be real yet. It
 * is reachable only as a labelled reviewer preview; see
 * `src/features/account/account-session.ts` for why normal mode can never enter
 * it.
 */

interface RowProps {
  readonly icon: IconName;
  readonly title: string;
  readonly detail: string;
  readonly href?: string;
  /** What a normal tester reads: why the row cannot be used yet, in plain terms. */
  readonly action?: string;
  /** The same fact with its milestone or work-package number, for internal review. */
  readonly reviewerAction?: string;
}

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

/** A row that does something immediately, with an optional result message. */
function ActionRow({
  icon,
  title,
  detail,
  onClick,
  status,
}: {
  readonly icon: IconName;
  readonly title: string;
  readonly detail: string;
  onClick(): void;
  readonly status?: string | null;
}) {
  return (
    <li>
      <button className={styles.row} type="button" onClick={onClick}>
        <span className={styles.rowIcon} aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{title}</span>
          <span className={styles.rowDetail}>{detail}</span>
          {/*
            `role="status"` rather than a bare paragraph: the button stays put
            and only its subtitle changes, which a screen-reader user would
            otherwise never learn about.
          */}
          {status ? (
            <span className={styles.rowStatus} role="status">
              {status}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

/**
 * A destructive row that asks first.
 *
 * An inline disclosure rather than `window.confirm`: the native dialog cannot
 * be styled, cannot be screenshotted for review evidence, is suppressible by
 * the browser, and reads out of context to assistive technology. The panel
 * takes focus when it opens and returns it to the row when it closes, so a
 * keyboard user is never left where they cannot see what changed.
 */
function ConfirmRow({
  icon,
  title,
  detail,
  question,
  consequence,
  confirmLabel,
  tone = "default",
  onConfirm,
  note,
  status,
}: {
  readonly icon: IconName;
  readonly title: string;
  readonly detail: string;
  readonly question: string;
  readonly consequence: string;
  readonly confirmLabel: string;
  readonly tone?: "default" | "destructive";
  onConfirm(): void;
  /** Standing explanatory text. Present from first paint, so not a live region. */
  readonly note?: string | null;
  /** The result of using the control, announced when it appears. */
  readonly status?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      confirmRef.current?.focus();
    }
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  return (
    <li>
      <button
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        className={styles.row}
        data-tone={tone}
        onClick={() => {
          setOpen((current) => !current);
        }}
        ref={triggerRef}
        type="button"
      >
        <span className={styles.rowIcon} aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{title}</span>
          <span className={styles.rowDetail}>{detail}</span>
          {note ? <span className={styles.rowStatus}>{note}</span> : null}
          {status ? (
            <span className={styles.rowStatus} role="status">
              {status}
            </span>
          ) : null}
        </span>
      </button>

      {open ? (
        <div className={styles.confirm} data-tone={tone} id={panelId}>
          <p className={styles.confirmQuestion}>{question}</p>
          <p className={styles.confirmConsequence}>{consequence}</p>
          <div className={styles.confirmActions}>
            <button
              className={styles.confirmButton}
              data-tone={tone}
              onClick={() => {
                onConfirm();
                close();
              }}
              ref={confirmRef}
              type="button"
            >
              {confirmLabel}
            </button>
            <button className={styles.cancelButton} onClick={close} type="button">
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function Section({
  id,
  title,
  description,
  tone,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly tone?: "danger";
  readonly children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={styles.section} data-tone={tone}>
      <h2 className={styles.sectionTitle} id={id}>
        {title}
      </h2>
      {description ? <p className={styles.sectionNote}>{description}</p> : null}
      {children}
    </section>
  );
}

/**
 * Places visited: the compact, clickable route into the Passport.
 *
 * Visited geography comes from the stamps themselves, never from seals. A
 * country is visited on its first stamp; its seal is a separate threshold that
 * may take four more. Reporting seals here would hide a country the reader has
 * genuinely been to — the defect the Milestone 1 review found — so the counts
 * and the seal state are rendered as two different things on the same row.
 */
function PlacesVisited() {
  const { passport, countryProgress, hydrated } = useCollection();
  const reviewer = useReviewerMode();

  // The section is omitted entirely until there is something to point at, per
  // the approved structure. `hydrated` gates it so a returning reader is never
  // shown, even for one frame, a Me screen with their record missing.
  if (!hydrated || passport.countries.length === 0) {
    return null;
  }

  const progressFor = (countryCode: string) =>
    countryProgress.find((country) => country.countryCode === countryCode);

  return (
    <Section
      description="From the stamps you have collected. Nothing here is recorded automatically."
      id="me-places"
      title="Places visited"
    >
      <div className={styles.stats}>
        <p className={styles.stat}>
          <span className={styles.statValue}>{passport.stampCount}</span>
          <span className={styles.statLabel}>Shop stamps</span>
        </p>
        <p className={styles.stat}>
          <span className={styles.statValue}>{passport.countryCount}</span>
          <span className={styles.statLabel}>Countries</span>
        </p>
        <p className={styles.stat}>
          <span className={styles.statValue}>{passport.localityCount}</span>
          <span className={styles.statLabel}>Localities</span>
        </p>
      </div>

      <ul className={styles.geoList}>
        {passport.countries.map((country) => {
          const progress = progressFor(country.countryCode);

          return (
            <li className={styles.geoRow} key={country.countryCode}>
              <Link className={styles.geoLink} href={`/passport/${country.slug}`}>
                <span className={styles.geoText}>
                  <span className={styles.geoName}>{country.countryLabel}</span>
                  <span className={styles.geoProgress}>
                    {country.stampCount} stamp{country.stampCount === 1 ? "" : "s"} ·{" "}
                    {country.localities.length} localit
                    {country.localities.length === 1 ? "y" : "ies"}
                  </span>
                </span>
                {progress?.earned ? (
                  <span className={styles.geoSeal}>
                    <Icon name="seal" size={14} />
                    Seal
                  </span>
                ) : null}
                <Icon name="chevron-right" size={18} />
              </Link>

              <ul className={styles.localityList}>
                {country.localities.map((locality) => (
                  <li key={locality.slug}>
                    <Link
                      className={styles.localityLink}
                      href={`/passport/${country.slug}/${locality.slug}`}
                    >
                      {locality.name}
                    </Link>
                  </li>
                ))}
              </ul>

              {/*
                The seal threshold is a separate fact from the visit, so it is
                stated separately and only where it is not already earned.
              */}
              {progress && !progress.earned ? (
                <p className={styles.geoSealProgress}>
                  {progress.requirementFromCuratedSet
                    ? `${progress.progressCount} of ${progress.required} curated shops collected towards the country seal`
                    : `${progress.progressCount} of ${progress.required} stamps towards the country seal`}
                </p>
              ) : null}

              {reviewer && progress?.coverageSetVersion ? (
                <p className={styles.geoVersion}>
                  Counted against curated set {progress.coverageSetVersion}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className={styles.sectionNote}>
        <Link className={styles.inlineLink} href="/passport">
          Open Passport
        </Link>{" "}
        to see the impressions themselves.
      </p>
    </Section>
  );
}

function Preferences() {
  return (
    <Section id="me-preferences" title="Preferences and accessibility">
      <ul className={styles.rows}>
        <Row
          action="No in-app override"
          detail="Nib Atlas follows your operating system's reduce-motion setting. Page turns and the stamp ceremony become an immediate change with a short fade."
          icon="settings"
          title="Reduced motion"
        />
        <Row
          action="Reference only"
          detail="Every map result has a list equivalent, status never relies on colour alone, and controls are keyboard operable with visible focus."
          icon="accessibility"
          title="Accessibility"
        />
      </ul>
    </Section>
  );
}

/**
 * Contribute.
 *
 * The entries are WP2's; the routing behind them is WP7's — `mailto` first, a
 * `/suggest-shop` page later. They are placed now, in the group the approved
 * structure gives them, and they say plainly that they cannot be used yet
 * rather than opening a link that goes nowhere.
 */
function Contribute() {
  return (
    <Section
      description="The catalogue is small and hand-checked. Both of these come back to a person."
      id="me-contribute"
      title="Contribute"
    >
      <ul className={styles.rows}>
        <Row
          action="Not open yet"
          detail="Tell us about a shop that sells or services fountain pens and is not on the map."
          icon="pen"
          reviewerAction="Routing arrives in WP7"
          title="Suggest a pen shop"
        />
        <Row
          action="Not open yet"
          detail="Hours, address or services wrong on a shop page? Send a correction and it is checked against the shop's own sources."
          icon="alert"
          reviewerAction="Routing arrives in WP7"
          title="Report incorrect information"
        />
      </ul>
    </Section>
  );
}

export function MeScreen() {
  const {
    scope,
    savedShopIds,
    collections,
    seals,
    hydrated,
    clearLocalData,
    resetPrototypeState,
  } = useCollection();
  const { session, canPreview, previewSignedIn, signOut, setDisplayName } =
    useAccountSession();
  const reviewer = useReviewerMode();

  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [clearStatus, setClearStatus] = useState<string | null>(null);
  const [nameStatus, setNameStatus] = useState<string | null>(null);

  const signedIn = session.status === "signed-in";

  const handleDownload = useCallback(() => {
    const started = downloadLocalData(
      buildLocalDataExport({
        scope,
        savedShopIds,
        collections,
        seals,
        exportedAt: new Date(),
      }),
    );

    setDownloadStatus(
      started
        ? "Your file has been prepared and downloaded."
        : "This browser blocked the download. Check its download settings and try again.",
    );
  }, [collections, savedShopIds, scope, seals]);

  const handleClear = useCallback(() => {
    clearLocalData();
    setClearStatus("Cleared. Nothing from Nib Atlas is stored on this device now.");
  }, [clearLocalData]);

  const localDataRows = (
    <>
      <ActionRow
        detail="A JSON copy of your saved shops and collected impressions, exactly as they are stored here."
        icon="download"
        onClick={handleDownload}
        status={downloadStatus}
        title="Download local data"
      />
      <ConfirmRow
        confirmLabel="Clear this device"
        consequence="Your saved shops and collected impressions are removed from this browser. There is no copy anywhere else, so this cannot be undone — download your data first if you want to keep it."
        detail="Removes your saved shops and collected impressions from this browser."
        icon="trash"
        onConfirm={handleClear}
        question="Clear everything Nib Atlas has stored on this device?"
        status={clearStatus}
        title="Clear data on this device"
        tone="destructive"
      />
    </>
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span aria-hidden="true" className={styles.avatar}>
          <NibAtlasMark size={34} />
        </span>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Me</h1>
          <p className={styles.subtitle}>
            {signedIn
              ? "Your account, the places you have been, and the controls over your own data."
              : "Nib Atlas works without an account. What you keep is kept on this device."}
          </p>
        </div>
        <ReviewerModeBadge />
      </header>

      {signedIn ? (
        <Section id="me-account" title="Account">
          <div className={styles.identity}>
            <p className={styles.identityName}>{accountHeadline(session)}</p>
            <p className={styles.identityLabel}>{session.identityLabel}</p>
            {/*
              The preview is labelled where it renders, not only where it is
              switched on. A reviewer who lands mid-screen has to be able to see
              that this account does not exist.
            */}
            {session.preview ? (
              <p className={styles.identityNote}>
                Reviewer preview: this device is not signed in to anything. There is
                no authentication in this build; the signed-in structure is shown so
                it can be reviewed before Milestone 4 builds it.
              </p>
            ) : null}
          </div>

          <form
            className={styles.nameForm}
            onSubmit={(event) => {
              event.preventDefault();

              // Read from the form rather than from a draft in state: an
              // uncontrolled input seeded with the stored name means a reader
              // who opens Me and presses Save without typing keeps the name
              // they already had, instead of silently clearing it.
              const submitted = new FormData(event.currentTarget).get("displayName");
              const value = typeof submitted === "string" ? submitted : "";

              setDisplayName(value);
              setNameStatus(
                value.trim().length === 0
                  ? "Display name cleared."
                  : "Display name saved.",
              );
            }}
          >
            <label className={styles.nameLabel} htmlFor="me-display-name">
              Display name
            </label>
            <p className={styles.nameHint} id="me-display-name-hint">
              Optional. What Nib Atlas calls you. Leave it empty to be shown your
              account address instead.
            </p>
            <div className={styles.nameControls}>
              <input
                aria-describedby="me-display-name-hint"
                className={styles.nameInput}
                defaultValue={session.displayName ?? ""}
                id="me-display-name"
                /* Remounts when the stored name changes, so the uncontrolled
                   input picks up the value resolved after hydration. */
                key={session.displayName ?? ""}
                maxLength={DISPLAY_NAME_MAX_LENGTH}
                name="displayName"
                onChange={() => {
                  setNameStatus(null);
                }}
                type="text"
              />
              <button className={styles.nameSave} type="submit">
                Save
              </button>
            </div>
            {nameStatus ? (
              <p className={styles.rowStatus} role="status">
                {nameStatus}
              </p>
            ) : null}
          </form>
        </Section>
      ) : (
        <Section id="me-account" title="Account">
          <ul className={styles.rows}>
            <Row
              action="Not available yet"
              detail="An account carries your saved shops and collected impressions between devices. Everything you can do today works without one."
              icon="login"
              reviewerAction="Sign-in and sync arrive in Milestone 4"
              title="Sign in"
            />
          </ul>
        </Section>
      )}

      <PlacesVisited />

      <Preferences />

      {signedIn ? (
        <Section
          description="Your account data lives on a server; the two controls below act on this browser only."
          id="me-data"
          title="Privacy and your data"
        >
          <ul className={styles.rows}>
            <Row
              detail="What Nib Atlas stores, what it does not, and how your location is used when you collect a stamp."
              href="/privacy"
              icon="shield"
              title="Privacy policy"
            />
            <Row
              action="Not available yet"
              detail="A machine-readable copy of everything held against your account."
              icon="download"
              reviewerAction="Arrives in Milestone 8"
              title="Export account data"
            />
            {localDataRows}
          </ul>
        </Section>
      ) : (
        <Section
          /*
            The one place the local-storage fact is stated in full. Milestone 1
            repeated a shorter version of it on several screens; the approved
            structure gives it a single home, next to the controls that act on it.
          */
          description="Your saved shops, collected impressions and preferences are stored in this browser, on this device. They do not sync to your other devices, and they are lost if you clear this browser's data or remove Nib Atlas from your home screen."
          id="me-device"
          title="On this device"
        >
          <ul className={styles.rows}>{localDataRows}</ul>
        </Section>
      )}

      <Contribute />

      <Section id="me-help" title="Help and about">
        <ul className={styles.rows}>
          {/*
            Privacy is its own group once signed in, where the account controls
            live beside it. Signed out there is nothing to group it with, so it
            heads this one.
          */}
          {signedIn ? null : (
            <Row
              detail="What Nib Atlas stores, what it does not, and how your location is used when you collect a stamp."
              href="/privacy"
              icon="shield"
              title="Privacy policy"
            />
          )}
          <Row
            action="Not open yet"
            detail="Ask for help with a shop page or a collection that did not work."
            icon="help"
            reviewerAction="Routing arrives in WP7"
            title="Help and contact"
          />
          <Row
            detail="What the catalogue is, and the countries it covers today."
            href="/about"
            icon="map"
            title="About Nib Atlas"
          />
          {signedIn ? (
            <ActionRow
              detail="Ends this session. What is stored in this browser stays where it is."
              icon="logout"
              onClick={signOut}
              title="Sign out"
            />
          ) : null}
        </ul>
      </Section>

      {/*
        The Danger group is separated by its own rule and heading rather than
        being one more row in a list, because the approved structure asks for a
        control the reader cannot reach by accident on the way to something else.
      */}
      {signedIn ? (
        <Section id="me-danger" title="Danger" tone="danger">
          <ul className={styles.rows}>
            <ConfirmRow
              confirmLabel="Delete my account"
              consequence="Your account, your saved shops and every stamp you have collected are removed permanently. This cannot be undone."
              detail="Removes your account and everything collected against it."
              icon="alert"
              onConfirm={signOut}
              note={
                session.preview
                  ? "Reviewer preview: confirming leaves the preview. No account exists to delete."
                  : null
              }
              question="Delete your Nib Atlas account?"
              title="Delete account"
              tone="destructive"
            />
          </ul>
        </Section>
      ) : null}

      {/*
        Reviewer-only, and gated with a conditional rather than CSS so these
        controls are not merely invisible to a tester — they are not in their
        document at all, and cannot be reached by keyboard or assistive
        technology.
      */}
      {reviewer ? (
        <Section id="me-prototype" title="Prototype controls">
          <p className={styles.sectionNote}>
            Saves and simulated collections are kept on this device only, in this
            browser&rsquo;s local storage under a reviewer-only key. They survive a
            reload and a new tab, they are separate from the normal-mode store, and
            nothing is sent anywhere.
          </p>
          <ul className={styles.rows}>
            <ActionRow
              detail="Restores the seeded saves and simulated impressions."
              icon="clock"
              onClick={resetPrototypeState}
              title="Reset the prototype session"
            />
            {canPreview && !signedIn ? (
              <ActionRow
                detail="Renders Me in its signed-in form — account identity, display name, and the Danger group — so the structure can be reviewed before Milestone 4 builds it."
                icon="person"
                onClick={previewSignedIn}
                title="Preview the signed-in account"
              />
            ) : null}
          </ul>
          {!hydrated ? null : (
            <p className={styles.geoVersion}>
              Store in use: {scope}. {savedShopIds.size} saved,{" "}
              {collections.length} simulated impression
              {collections.length === 1 ? "" : "s"}.
            </p>
          )}
        </Section>
      ) : null}
    </div>
  );
}
