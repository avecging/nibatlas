import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Nib Atlas stores, what it never stores, and when it asks for your location.",
};

/**
 * Plain-language privacy page.
 *
 * The copy states what the product does today and what is not built yet. It
 * makes the active/passive distinction the acceptance brief requires: location
 * is used once, on a tap, and never in the background.
 */
export default function PrivacyPage() {
  return (
    <article className="privacy-page">
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

      <h2 className="type-h2">Browsing without an account</h2>
      <p>
        The map, search, and every shop page are available anonymously. An account
        is needed only to keep things that must persist: saved shops and your
        Passport.
      </p>

      <h2 className="type-h2">Your Passport is private</h2>
      <p>
        Collected stamps are private by default. There are no public profiles, no
        followers, no leaderboards, and no feed. Nothing you collect is shown to
        anyone else.
      </p>

      <h2 className="type-h2">Your data, your call</h2>
      <p>
        You will be able to export a machine-readable copy of your profile, saved
        shops, and collected stamps, and to delete your account along with all of
        it. Both controls live in{" "}
        <Link href="/me#me-privacy">Me &rsaquo; Privacy and your data</Link>.
      </p>

      <h2 className="type-h2">What this prototype does</h2>
      <p>
        Milestone 1 is a frontend prototype. It has no accounts, no server, and no
        location access: it never asks your browser for a position. Saved shops and
        simulated collections are held in this browser session and are not sent
        anywhere. Shop records are a small sourced sample and are not a complete or
        continuously verified catalogue.
      </p>
      <p className="type-body-sm">
        This page is prototype copy for review. The binding policy is published
        before public launch.
      </p>
    </article>
  );
}
