"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { NibAtlasMark } from "@/src/components/brand/NibAtlasMark";
import { Icon, type IconName } from "@/src/components/ui/Icon";
import { accountHeadline } from "@/src/features/account/account-session";
import { useAccountSession } from "@/src/features/account/AccountSessionProvider";
import { useSignInPrompt } from "@/src/features/auth/SignInProvider";
import { useCollection } from "@/src/features/collection/collection-store";
import {
  HELP_PATH,
  SUGGEST_SHOP_PATH,
} from "@/src/features/contribute/contribute-links";
import { exportLocalData } from "@/src/features/me/local-data";
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
 * Milestone 4 WP3 makes the signed-in state real. The reviewer preview that
 * stood in for it is gone: which state a reader gets is now decided by
 * `GET /api/v1/auth/session`, and the two states above are joined by the two a
 * network answer adds — the session is still being read, or it could not be
 * read at all. All four are rendered here, because a screen that claims either
 * of the settled states while it is in one of the others is the same defect the
 * preview was built to avoid.
 *
 * What a signed-in reader is offered is bounded by what exists. WP2 built the
 * session; the profile-update, account-export and account-deletion routes do
 * not exist, so those rows say so in the same plain form the rest of Me uses
 * rather than presenting controls that would fail. Saved shops and collected
 * impressions are still device-local until WP4 and WP5 connect them, and the
 * data group says that too.
 */

interface RowProps {
  readonly icon: IconName;
  readonly title: string;
  readonly detail: string;
  readonly href?: string;
  /**
   * Leaves the application — a `mailto:` today. Rendered as a plain anchor
   * rather than a `Link`, which exists to prefetch and client-navigate routes
   * this one is not.
   */
  readonly external?: boolean;
  /** What a normal tester reads: why the row cannot be used yet, in plain terms. */
  readonly action?: string;
  /** The same fact with its milestone or work-package number, for internal review. */
  readonly reviewerAction?: string;
}

function Row({
  icon,
  title,
  detail,
  href,
  external,
  action,
  reviewerAction,
}: RowProps) {
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

  if (href && external) {
    return (
      <li>
        <a className={styles.row} href={href}>
          {body}
        </a>
      </li>
    );
  }

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

/**
 * The result of using a row control.
 *
 * A **sibling** of the button, never a descendant. A native button's
 * descendants are flattened into its accessible name, so a `role="status"`
 * nested inside one is not exposed as a live region at all — the announcement
 * simply never happens, and the reader is left with a control that appears to
 * have done nothing. That matters most in the case with no other feedback: a
 * download the browser blocked.
 *
 * Rendered inside the same list item and indented to the row text, so the
 * visual association is unchanged.
 *
 * The element is always present, empty included: a live region has to be in the
 * document *before* its text arrives, or several screen readers miss the first
 * update. It is named after its own row, because two unnamed status regions on
 * one screen are indistinguishable to anyone navigating by region.
 */
function RowStatus({
  label,
  status,
}: {
  readonly label: string;
  readonly status: string | null | undefined;
}) {
  return (
    <p aria-label={`${label} result`} className={styles.rowResult} role="status">
      {status ?? ""}
    </p>
  );
}

/** A row that does something immediately, with an optional result message. */
function ActionRow({
  icon,
  title,
  detail,
  onClick,
  disabled,
  status,
}: {
  readonly icon: IconName;
  readonly title: string;
  readonly detail: string;
  onClick(): void;
  /**
   * Held while the device's own state is still being read. One frame in
   * practice, so it is a race guard rather than an interface state.
   */
  readonly disabled?: boolean;
  readonly status?: string | null;
}) {
  return (
    <li>
      <button
        className={styles.row}
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        <span className={styles.rowIcon} aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{title}</span>
          <span className={styles.rowDetail}>{detail}</span>
        </span>
      </button>
      <RowStatus label={title} status={status} />
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
  disabled,
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
  /** Held while the device's own state is still being read. */
  readonly disabled?: boolean;
  /** The result of using the control, announced when it appears. */
  readonly status?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  /*
   * A destructive panel opens with focus on **Cancel**, never on the action.
   * Opening the panel and confirming it are one keystroke apart otherwise: a
   * reader who presses Enter or Space twice — a perfectly ordinary way to
   * operate a list of buttons — would delete their collection without ever
   * reading the question. Cancel first makes the second keystroke the safe one,
   * and the destructive button is still one Tab away.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    if (tone === "destructive") {
      cancelRef.current?.focus();
    } else {
      confirmRef.current?.focus();
    }
  }, [open, tone]);

  // Focus returns to the row that opened the panel, whether the reader
  // cancelled or went through with it — otherwise the panel unmounts under
  // their focus and a keyboard user is dropped back to the top of the document.
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
        disabled={disabled}
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
          {/*
            The note stays inside: it is standing description, so belonging to
            the button's accessible name is correct. The result does not — see
            `RowStatus`.
          */}
        </span>
      </button>
      <RowStatus label={title} status={status} />

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
            <button
              className={styles.cancelButton}
              onClick={close}
              ref={cancelRef}
              type="button"
            >
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

/*
 * There is no Preferences and accessibility section.
 *
 * WP2 first rendered reduced motion and accessibility as rows with a pending
 * badge, then as two sentences of copy. The founder's staging review rejected
 * both, and the reasoning holds: Me is where a person changes their own
 * settings, and there is nothing here to change. General statements about how
 * the product behaves are not personal settings, and putting them on this page
 * makes it read as a specification of itself.
 *
 * The behaviour is unchanged and its documentation stays in the repository. The
 * section returns when there is something to set — a theme choice, a text size,
 * a colour-vision option, a motion override — and not before. None of those are
 * built here.
 */

/**
 * Contribute.
 *
 * One entry, still. **Suggest a pen shop** now opens the real form at
 * `/suggest-shop` rather than a mail client; the email route it replaced stays
 * in `contribute-links.ts` as what that form offers when it cannot deliver.
 *
 * **Report incorrect information** is still not here, and now for a stronger
 * reason than when the founder's staging review removed it. It exists, it works,
 * and it lives on the shop page — because the form carries the listing the
 * reader came from, and a global Me row has no listing to carry.
 */
function Contribute() {
  return (
    <Section
      description="The catalogue is small and hand-checked."
      id="me-contribute"
      title="Contribute"
    >
      <ul className={styles.rows}>
        <Row
          detail="Tell us about a fountain pen shop that isn't on the map."
          href={SUGGEST_SHOP_PATH}
          icon="pen"
          title="Suggest a pen shop"
        />
      </ul>
    </Section>
  );
}

export function MeScreen() {
  const {
    source,
    scope,
    savedShopIds,
    collections,
    seals,
    hydrated,
    clearLocalData,
    resetPrototypeState,
  } = useCollection();
  const { session, refresh, signOut } = useAccountSession();
  const { requestSignIn } = useSignInPrompt();
  const reviewer = useReviewerMode();

  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [clearStatus, setClearStatus] = useState<string | null>(null);
  const [signOutStatus, setSignOutStatus] = useState<string | null>(null);

  const signedIn = session.status === "signed-in";

  /*
   * Signing out is a request to the server, so it can fail, and the row says so
   * rather than appearing to have worked. On success the session state changes
   * underneath this screen and the signed-out structure replaces it — there is
   * nothing left to announce, and the row that would have announced it is gone.
   */
  const handleSignOut = useCallback(async () => {
    setSignOutStatus(null);

    const outcome = await signOut();

    if (!outcome.ok) {
      setSignOutStatus(
        outcome.code === "network"
          ? "Nib Atlas could not reach the network. You are still signed in."
          : "Signing out did not complete. You are still signed in — try again.",
      );
    }
  }, [signOut]);

  const handleDownload = useCallback(() => {
    const result = exportLocalData({
      hydrated,
      scope,
      savedShopIds,
      collections,
      seals,
      exportedAt: new Date(),
    });

    setDownloadStatus(
      {
        ok: "Your data has been downloaded.",
        // Unreachable through the interface — the row is held until the store
        // has been read — but the message exists so the guard can never fail
        // silently if some other path reaches it.
        "not-ready": "Still reading this device. Try again in a moment.",
        blocked:
          "This browser blocked the download. Check its download settings and try again.",
      }[result],
    );
  }, [collections, hydrated, savedShopIds, scope, seals]);

  const handleClear = useCallback(() => {
    // Guarded for the same reason as the export: before the store has been read
    // this would clear the empty baseline and write it over a returning
    // reader's real collection.
    if (!hydrated) {
      return;
    }

    clearLocalData();
    /*
     * Names the two things that were removed rather than claiming the device is
     * now free of Nib Atlas. It is not: the reviewer choice, the account preview
     * and whatever else a browser keeps are untouched, and a control that
     * overstates what it did is the same defect as one that understates it.
     */
    setClearStatus(
      "Cleared. Your saved shops and collected impressions have been removed from this browser.",
    );
  }, [clearLocalData, hydrated]);

  const localDataRows = (
    <>
      <ActionRow
        detail="A JSON copy of your saved shops and collected impressions."
        disabled={!hydrated}
        icon="download"
        onClick={handleDownload}
        status={downloadStatus}
        title="Download local data"
      />
      <ConfirmRow
        confirmLabel="Clear this device"
        disabled={!hydrated}
        consequence="Your saved shops and collected impressions are removed from this browser. There is no copy anywhere else, so this cannot be undone — download your data first if you want to keep it."
        detail="Removes them from this browser."
        icon="trash"
        onConfirm={handleClear}
        question="Clear your saved shops and collected impressions from this browser?"
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
          {/*
            Three wordings for four states, because the two unsettled ones must
            not claim either settled one. "What you keep is kept on this device"
            is true of a signed-out reader and would be a claim about a
            signed-in one, so it waits until the session is known.
          */}
          <p className={styles.subtitle}>
            {signedIn
              ? "Your account, the places you have been, and the controls over your own data."
              : session.status === "signed-out"
                ? "Nib Atlas works without an account. What you keep is kept on this device."
                : "The places you have been, and the controls over your own data."}
          </p>
        </div>
        <ReviewerModeBadge />
      </header>

      {/*
        One section, four states, and no state borrowed from another.

        Loading is not rendered as signed out. The session lives in an HTTP-only
        cookie, so the browser has to ask before it knows, and showing the
        anonymous invitation in the meantime would flash "Sign in" at a reader
        who already has an account on every visit to this page.
      */}
      <Section id="me-account" title="Account">
        {session.status === "loading" ? (
          <p
            aria-label="Account status"
            className={styles.sectionNote}
            role="status"
          >
            Checking your account&hellip;
          </p>
        ) : null}

        {session.status === "signed-in" ? (
          <>
            <div className={styles.identity}>
              <p className={styles.identityName}>{accountHeadline(session)}</p>
              {/*
                The address is the second line only when the first one is not
                already it. With no display name chosen, `accountHeadline`
                returns the address, and printing it twice reads as a defect.
              */}
              {session.displayName ? (
                <p className={styles.identityLabel}>{session.identityLabel}</p>
              ) : null}
            </div>

            <ul className={styles.rows}>
              {/*
                A row, not the form this replaced. WP2 gives the interface a
                profile read and no profile write, so the form's Save button had
                nothing to call: the honest form of an unbuilt control is the
                same pending row the rest of Me uses.
              */}
              <Row
                action="Not available yet"
                detail="What Nib Atlas calls you, instead of your email address."
                icon="person"
                reviewerAction="Needs a profile-update route; not in WP3"
                title="Display name"
              />
            </ul>
          </>
        ) : null}

        {session.status === "signed-out" ? (
          <ul className={styles.rows}>
            {/*
              The explanation is the approved wording, unchanged. What changed is
              that the row is now a control: it opens the interruption, which
              returns here — to this section — once the reader is signed in.
            */}
            <ActionRow
              detail="An account carries your saved shops and collected impressions between devices. Everything you can do today works without one."
              icon="login"
              onClick={() => requestSignIn({ returnTo: "/me#me-account" })}
              title="Sign in"
            />
          </ul>
        ) : null}

        {/*
          A failed session read is two different facts, and only one of them is
          worth a retry. A build with no authentication behind it cannot offer
          sign-in at all; a configured build that did not answer can, once it
          does.
        */}
        {session.status === "unavailable" && session.reason === "not-configured" ? (
          <ul className={styles.rows}>
            <Row
              action="Not available in this build"
              detail="This build has no accounts behind it. The map, saving shops on this device and collecting impressions all work without one."
              icon="login"
              reviewerAction="No Supabase auth configuration reached this build; hosted sign-in is WP6"
              title="Sign in"
            />
          </ul>
        ) : null}

        {session.status === "unavailable" && session.reason === "unreachable" ? (
          <>
            <p aria-label="Account status" className={styles.sectionNote} role="alert">
              Nib Atlas could not check your account just now. Nothing about it
              has changed, and nothing on this device has been touched.
            </p>
            <ul className={styles.rows}>
              <ActionRow
                detail="Read your account again."
                icon="clock"
                onClick={refresh}
                title="Try again"
              />
            </ul>
          </>
        ) : null}
      </Section>

      <PlacesVisited />

      {signedIn ? (
        <Section
          /*
            The second half of that sentence is doing the work in WP3. Signing in
            establishes an identity and nothing else yet: the saved-shop endpoints
            are WP4 and the import is WP5, so a signed-in reader's saves and
            impressions are still exactly where a signed-out reader's are. Saying
            so here is the difference between an account that is quietly
            incomplete and one that is honestly early.
          */
          description={source === "account" ? "Your saved shops and verified stamps are kept privately with your account and available when you sign in on another device." : "Your account holds your identity. Your saved shops and collected impressions are still kept in this browser and do not sync yet."}
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
            {source === "account" ? null : localDataRows}
          </ul>
        </Section>
      ) : (
        <Section
          /*
            The one place the local-storage fact is stated in full. Milestone 1
            repeated a shorter version of it on several screens; the approved
            structure gives it a single home, next to the controls that act on it.
          */
          /*
            Two corrections against the WP2 draft. Preferences are not named,
            because neither control touches them — Nib Atlas follows the
            operating system's settings and stores none of its own. And removing
            the app from a home screen is not stated as deleting its data:
            whether it does depends on the platform, and on several it does not.
          */
          description={source === "account" ? "Signing out clears your displayed Passport. Clearing browser data does not delete stamps held with your account. Account export and deletion tools are not available yet." : "Your saved shops and collected impressions are stored in this browser, on this device. They do not sync to your other devices, and clearing this browser's data clears them."}
          id="me-device"
          title="On this device"
        >
          <ul className={styles.rows}>{source === "account" ? null : localDataRows}</ul>
        </Section>
      )}

      <Contribute />

      {/*
        Help returns, and the section is renamed with it.

        Revision 22 removed the help row for carrying *Not open yet* and renamed
        the group to "About", on the grounds that a group called "Help and about"
        offering no help is an inaccuracy one level up. Both halves of that
        reasoning now run the other way: there is help, it works, and the heading
        should say so. The anchor stays `#me-about` — it is linked from
        `/account`, and renaming a heading is not a reason to break a route.
      */}
      <Section id="me-about" title="Help and about">
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
            detail="How the map, stamps and your Passport work, and the questions people ask."
            href={HELP_PATH}
            icon="help"
            title="Help"
          />
          <Row
            detail="What the catalogue is, and the countries it covers today."
            href="/about"
            icon="map"
            title="About Nib Atlas"
          />
          {signedIn ? (
            <ActionRow
              detail="Ends this session on this device."
              icon="logout"
              onClick={() => {
                void handleSignOut();
              }}
              status={signOutStatus}
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
            {/*
              A row, not a confirmation.

              While the signed-in state was a reviewer preview, this asked its
              question and then left the preview — labelled as doing so. Against
              a real account that would be a confirmation dialog whose confirm
              button signs the reader out and leaves everything in place, which
              is worse than an unbuilt control: it is a destructive control that
              lies about what it did. Deletion arrives with account export in
              Milestone 8, and until then the row says what it is.
            */}
            <Row
              action="Not available yet"
              detail="Removes your account and everything held against it."
              icon="alert"
              reviewerAction="Account export and deletion arrive in Milestone 8"
              title="Delete account"
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
