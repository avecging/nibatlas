import type { Metadata } from "next";
import Link from "next/link";

import { PrivacyReviewerNote } from "@/src/features/reviewer/ReviewerNotes";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Nib Atlas stores, what it never stores, and when it asks for your location.",
};

/**
 * Plain-language privacy page.
 *
 * This is where the *full* location explanation lives. WP1 reduces the
 * explanation at the point of collection to the minimum a person needs in that
 * moment and links here for the rest, so these sections deliberately stay long:
 * shortening them would leave the product with no complete account anywhere.
 *
 * The active/passive distinction is the point — location is used once, on a tap,
 * and never in the background.
 */
export default function PrivacyPage() {
  return (
    <article className="prose-page">
      <p className="type-overline">Nib Atlas</p>
      <h1 className="type-h1">Privacy</h1>
      <p className="type-body-lg">
        Nib Atlas helps you find physical fountain pen shops and keep a private
        record of the ones you have visited. This page says plainly what that
        involves.
      </p>

      <h2 className="type-h2">Nib Atlas does not track where you go</h2>
      <p>
        There is no background location, no location history, and no automatic
        visit detection. Panning the map, opening a shop page, and searching for a
        place never involve your position at all.
      </p>

      <h2 className="type-h2">When location is used</h2>
      <p>
        Location is requested once, in the foreground, at the moment you tap{" "}
        <strong>Collect Stamp</strong> while you are at a shop. Your browser asks
        you first, and you can decline. The position is checked against that
        shop&rsquo;s location and then discarded.
      </p>
      <p>
        <strong>Raw coordinates are never stored</strong> — not in the database,
        not in analytics, and not in logs. What is kept is the fact that a
        verified visit happened, for that shop, on that date.
      </p>
      <p>
        Declining costs you nothing except that one stamp. Exploration, search,
        and shop pages continue to work exactly as before.
      </p>

      <h2 className="type-h2">Browsing and saving without an account</h2>
      <p>
        The map, search, and every shop page are available anonymously — and so is
        saving a shop or keeping an impression. Neither needs an account.
      </p>
      <p>
        <strong>What you save stays on this device.</strong> It is held in this
        browser&rsquo;s storage, it is not sent to Nib Atlas, it does not appear on
        your other devices, and clearing this browser&rsquo;s data clears it. An
        account will later carry saved shops and verified visits between your
        devices; nothing needs one today.
      </p>

      <h2 className="type-h2">Your Passport is private</h2>
      <p>
        Collected stamps are private by default. There are no public profiles, no
        followers, no leaderboards, and no feed. Nothing you collect is shown to
        anyone else.
      </p>
      <p>
        Nib Atlas also starts you with nothing. A Passport is empty until you put
        something in it — no sample visits, no places you did not choose.
      </p>

      <h2 className="type-h2">Your data, your call</h2>
      <p>
        Nothing Nib Atlas holds for you today leaves this browser, and two
        controls act on it. <strong>Download local data</strong> hands you a
        machine-readable copy of your saved shops and collected impressions, and{" "}
        <strong>Clear data on this device</strong> removes those same two things
        from this browser. Both are in{" "}
        <Link href="/me#me-device">Me &rsaquo; On this device</Link>. Clearing your
        browser&rsquo;s own site data for Nib Atlas removes everything it has kept
        here, including those.
      </p>
      <p>
        Once accounts exist, the same two things apply to an account: a
        machine-readable export, and deleting the account along with everything
        collected against it.
      </p>

      <h2 className="type-h2">Location is not switched on yet</h2>
      <p>
        The location check described above is not running in this build. Collecting
        a stamp keeps a preview impression on this device so you can see how the
        Passport works; nothing about your position is requested, checked, or sent
        anywhere.
      </p>

      <p className="type-body-sm">
        More about the catalogue and the countries it covers:{" "}
        <Link href="/about">About Nib Atlas</Link>.
      </p>

      <PrivacyReviewerNote />
    </article>
  );
}
