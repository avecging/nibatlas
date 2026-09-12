import type { Metadata } from "next";
import Link from "next/link";

import { CONTRIBUTE_EMAIL } from "@/src/features/contribute/contribute-links";

export const metadata: Metadata = {
  title: "Help",
  description:
    "How Nib Atlas works — finding shops, collecting stamps, and the questions people actually ask.",
};

export const dynamic = "force-static";

/**
 * Help.
 *
 * Accepted decision 8 left this route deliberately unspecified: destination,
 * copy and even whether an address was the right answer were all open. The
 * founder settled it as a short walkthrough followed by the questions people
 * actually ask, with contact as the last line rather than the headline — a
 * person who can find their answer here would rather not have to write to
 * anyone.
 *
 * **Coverage is not restated here.** *Where does Nib Atlas cover* links to
 * About, which derives its list from the catalogue. Two pages both naming the
 * countries is two places to be wrong, and it was already wrong in one of them.
 *
 * The answers distinguish verified account collections from standalone previews,
 * in the same terms Privacy and the collection dialog use.
 */
export default function HelpPage() {
  return (
    <article className="prose-page">
      <p className="type-overline">Nib Atlas</p>
      <h1 className="type-h1">Help</h1>
      <p className="type-body-lg">
        Nib Atlas is a map of physical fountain pen shops, and a private record of
        the ones you have been to. Here is how to use it.
      </p>

      <h2 className="type-h2">Finding shops</h2>
      <p>
        <strong>Map</strong> opens on the map. Search for a city or a place to
        move to it, then pan and zoom as you like — moving the map never reloads
        the results underneath you. When you have moved far enough that the
        results no longer match what you are looking at,{" "}
        <strong>Search this area</strong> appears; tapping it fetches shops for
        where you are now.
      </p>
      <p>
        Results sit in a sheet below the map on a phone, which you can drag up to
        see more of, and beside the map on a wider screen. Tapping a shop in
        either opens its page.
      </p>
      <p>
        <strong>Filters</strong> are behind the filter button, and the button
        shows how many are active so a forgotten filter cannot quietly hide half
        the map.
      </p>

      <h2 className="type-h2">Shop pages</h2>
      <p>
        A shop page is there to answer one question: is this worth the trip? It
        leads with what the shop is and what you can do there, then how to get to
        it and what to know before you go.
      </p>
      <p>
        <strong>Where something is not confirmed, it is left out</strong> rather
        than guessed at. A shop showing no opening hours has none published that
        we could check — that is a blank you can plan around, not an oversight.
      </p>
      <p>
        <strong>Save</strong>{" "}
        is the bookmark beside the shop&rsquo;s name. Saved shops gather into a
        list you reach from the map, which is what most people use to plan a day
        of visits.
      </p>

      <h2 className="type-h2">Stamps and your Passport</h2>
      <p>
        When you are at a shop, <strong>Collect Stamp</strong> keeps the visit as
        an ink impression for that shop, with the place and the date. Impressions
        gather in your <strong>Passport</strong>, which you can browse as a list or a book, grouped by country and locality.
      </p>
      <p>
        In the connected catalogue, sign in, choose <strong>Check my location</strong>, then confirm{" "}
        <strong>I am at this shop</strong> after the check passes. A stamp only
        appears after the server confirms it. Your precise position is discarded.
      </p>
      <p>Standalone demonstrations offer preview impressions instead. Their
        collection dialog explains that no location check runs and that the
        impression stays on the device; it is not a verified visit.</p>

      <h2 className="type-h2">Questions</h2>

      <h3 className="type-h3">Do I need an account?</h3>
      <p>
        Browsing does not require an account. Account-backed saves and verified
        stamps do, so your private collection is available across devices.
        In a standalone demo without sign-in configured, saves and preview
        impressions need no account and remain in this browser.
        See <Link href="/privacy">Privacy</Link>.
      </p>

      <h3 className="type-h3">Where does Nib Atlas cover?</h3>
      <p>
        The current coverage, counted from the catalogue itself, is on{" "}
        <Link href="/about">About Nib Atlas</Link>. It is curated rather than
        exhaustive and grows a shop at a time, so it does not claim to list every
        fountain pen shop anywhere.
      </p>

      <h3 className="type-h3">Why does this listing have so little on it?</h3>
      <p>
        Because nothing more could be confirmed from a source we can point to.
        Every listing names where its details came from and when they were last
        checked. If you know better, the listing&rsquo;s own page has a way to
        tell us.
      </p>

      <h3 className="type-h3">Something on a listing is wrong.</h3>
      <p>
        Open that shop&rsquo;s page and use{" "}
        <strong>Report incorrect information</strong> at the foot of it. It
        carries the listing with it, so you never have to say which shop you
        mean.
      </p>

      <h3 className="type-h3">A shop is missing.</h3>
      <p>
        <Link href="/suggest-shop">Suggest a pen shop</Link>. The shop&rsquo;s
        name and country are the parts we need; the city is welcome but
        optional, and everything else helps.
      </p>

      <h3 className="type-h3">Is there a review or rating on here anywhere?</h3>
      <p>
        No, and there will not be. Nib Atlas has no star ratings, no review prose,
        no ranked feed, and no public profiles. It is about the places and whether
        one is worth the trip.
      </p>

      <h3 className="type-h3">What does Nib Atlas know about me?</h3>
      <p>
        Less than you would expect, and{" "}
        <Link href="/privacy">Privacy</Link> says exactly what. The short version:
        location is used only when you ask, account saves and verified stamps are
        held privately with your account, and standalone demo records stay in
        this browser.
      </p>

      <h3 className="type-h3" id="collection-help">Trouble collecting a stamp?</h3>
      <p>Keep the shop page visible while checking location. If permission was
        denied, enable this site in your browser location settings. For an unclear
        reading, try once more near an entrance or window. If it still fails,
        contact us with the shop name and the message shown. Do not send your
        coordinates. Support can review the issue; contacting us does not
        automatically issue a stamp.</p>
      <p>If the result was interrupted, open Passport or start a fresh check.
        An existing stamp is returned with its original date, without another
        ceremony. If asked to pause, try again later.</p>

      <p className="type-body-sm">
        If your question is not here, write to us at{" "}
        <a href={`mailto:${CONTRIBUTE_EMAIL}`}>{CONTRIBUTE_EMAIL}</a>.
      </p>
    </article>
  );
}
