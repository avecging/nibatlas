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
        There is no background location, no continuous location history, and no automatic
        visit detection. Panning the map, opening a shop page, and searching for a
        place never involve your position at all.
      </p>

      <h2 className="type-h2">When location is used</h2>
      <p>
        Location is requested once, in the foreground, at the moment you tap{" "}
        <strong>Collect Stamp</strong>{" "}
        while you are at a shop. Your browser asks you first, and you can
        decline. The position is checked against that shop&rsquo;s location and
        then discarded.
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

      <h2 className="type-h2">Browsing and personal actions</h2>
      <p>The map, search and shop pages are available without an account.
        Saving a shop and collecting a verified stamp require sign-in. Saved
        shops and stamps are kept privately in Supabase with your account and
        appear when you sign in on another device. Existing device saves may be
        imported after sign-in; simulated impressions are never imported as visits.</p>
      <p>Verification keeps limited diagnostics for up to 30 days, with automatic
        deletion normally running every ten minutes. These include the shop,
        attempt time, outcome, coarse accuracy and distance ranges, and limited
        abuse indicators. They contain no raw coordinates. Short-lived verification
        proofs and rate-limit counters are deleted separately.</p>

      <h2 className="type-h2">Signing in</h2>
      <p>
        Signing in is optional. If you choose an email link, Nib Atlas sends your
        email address to Supabase Auth to manage your account and session, and the
        configured email delivery service sends the message. If you choose Google,
        Google and Supabase process the sign-in instead.
      </p>
      <p>
        Nib Atlas keeps an essential, secure session cookie in your browser so it
        can recognise that you are signed in. Your email address and account details
        are not shown publicly. There are still no public profiles.
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
      <p>Signing out clears the Passport displayed in this browser. Clearing site
        data does not delete saved shops or stamps held with your account.
        Account export and deletion controls are not available yet. For help,
        see <Link href="/help">Help</Link>.</p>
      <h2 className="type-h2">When you send us something</h2>
      <p>
        Alongside account, save and collection requests, you may choose to send:{" "}
        <Link href="/suggest-shop">suggesting a pen shop</Link>, and reporting
        something wrong with a listing from that shop&rsquo;s own page.
      </p>
      <p>
        <strong>What is sent is what you typed</strong> — the shop, and what you
        know about it. A correction also carries which listing it is about,
        because you opened it from that listing.
      </p>
      <p>
        <strong>Your name and email address are optional.</strong> Give an email
        only if you are happy to be asked a follow-up question; we ask for a name
        alongside it so a reply has someone to address. Leave both blank and the
        submission is anonymous — it is not treated differently.
      </p>
      <p>
        Submissions are received in a Google spreadsheet the people who maintain
        the catalogue read, which means Google processes them on our behalf. They
        are kept while there is still something to do about them and while they
        are useful as a record of where a listing came from; contact details are
        cleared once we no longer need them. They are never published, never
        shown on a shop page, and never used to send you anything you did not ask
        for.
      </p>
      <p>
        Each form checks that a person is filling it in, using Cloudflare
        Turnstile. It is not an advertising or tracking product and it does not
        follow you around the web.
      </p>

      <h2 className="type-h2">Demonstration mode</h2>
      <p>Fixture and reviewer demonstrations may show simulated impressions held
        on the device. These do not verify your location and are kept separate
        from your account Passport.</p>

      <p className="type-body-sm">
        More about the catalogue and the countries it covers:{" "}
        <Link href="/about">About Nib Atlas</Link>.
      </p>

      <PrivacyReviewerNote />
    </article>
  );
}
