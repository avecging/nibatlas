import type { Metadata } from "next";
import Link from "next/link";

import { AboutReviewerNote } from "@/src/features/reviewer/ReviewerNotes";
import { countryLabel, type CountryCode } from "@/src/domain/geo";
import { prototypeShopDetails } from "@/src/fixtures/prototype-catalogue";

export const metadata: Metadata = {
  title: "About Nib Atlas",
  description:
    "What Nib Atlas is and what its carefully sourced catalogue currently contains.",
};

/**
 * Coverage, counted from the catalogue itself.
 *
 * Written as a derivation rather than as prose so the page cannot drift out of
 * date as shops are added. It reports what is here now and never a denominator:
 * `PRODUCT.md` allows `x / y` only against an explicitly versioned curated set,
 * and "shops we know about" is not one.
 */
function coverageByCountry(): readonly {
  readonly countryCode: CountryCode;
  readonly countryLabel: string;
  readonly shopCount: number;
  readonly localities: readonly string[];
}[] {
  const byCountry = new Map<CountryCode, { shops: number; localities: Set<string> }>();

  for (const shop of prototypeShopDetails) {
    const entry = byCountry.get(shop.countryCode) ?? {
      shops: 0,
      localities: new Set<string>(),
    };

    entry.shops += 1;
    entry.localities.add(shop.localityName);
    byCountry.set(shop.countryCode, entry);
  }

  return [...byCountry.entries()]
    .map(([countryCode, entry]) => ({
      countryCode,
      countryLabel: countryLabel(countryCode),
      shopCount: entry.shops,
      localities: [...entry.localities].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.countryLabel.localeCompare(b.countryLabel));
}

/**
 * About Nib Atlas.
 *
 * The one page that explains the product to someone who has just been handed a
 * link. It says what the catalogue is, how far it reaches today, and what Nib
 * Atlas deliberately is not — in product language, with no milestone numbers,
 * no coverage-set identifiers, and no test instructions.
 */
export default function AboutPage() {
  const coverage = coverageByCountry();
  const totalShops = coverage.reduce((sum, country) => sum + country.shopCount, 0);

  return (
    <article className="prose-page">
      <p className="type-overline">Nib Atlas</p>
      <h1 className="type-h1">About Nib Atlas</h1>
      <p className="type-body-lg">
        Nib Atlas is a map of physical fountain pen shops, and a private record of
        the ones you have been to. It exists to answer one question:{" "}
        <strong>where can I go to experience this hobby?</strong>
      </p>

      <h2 className="type-h2">What the catalogue is</h2>
      <p>
        Every entry in Nib Atlas is a real business, entered by hand from a source
        we can point to — usually the shop&rsquo;s own website. Each listing names
        where its details came from and when they were last checked.
      </p>
      <p>
        <strong>Most are shops you can walk into.</strong> A few are makers or
        suppliers whose own sources do not confirm a public shopfront, and those
        pages say so rather than assuming one — a detour is too far to travel on an
        assumption.
      </p>
      <p>
        Where something is not confirmed, Nib Atlas leaves it out rather than
        guessing. A shop with no published opening hours shows no hours at all. That
        is deliberate: a blank is easier to plan around than a plausible invention.
      </p>
      <p>
        The catalogue is curated rather than exhaustive. It does not claim to list
        every fountain pen shop in a country, and it grows a shop at a time.
      </p>

      <h2 className="type-h2">Where it covers today</h2>
      <p>
        Today the catalogue holds {totalShops} shop{totalShops === 1 ? "" : "s"}{" "}
        across the places below. This is a snapshot of the entries currently
        included, not a promise of national coverage or completeness:
      </p>
      <ul>
        {coverage.map((country) => (
          <li key={country.countryCode}>
            <strong>{country.countryLabel}</strong> — {country.shopCount} shop
            {country.shopCount === 1 ? "" : "s"} in {country.localities.join(", ")}.
          </li>
        ))}
      </ul>
      <p>
        If a shop you know is missing,{" "}
        <Link href="/suggest-shop">tell us about it</Link>. If a detail here is
        wrong, the shop&rsquo;s own page has a way to report it that carries the
        listing with it.
      </p>

      <h2 className="type-h2">Stamps and your Passport</h2>
      <p>
        Visiting a shop is the point. When you are there, Nib Atlas can keep the
        visit as a stamp: an ink impression for that shop, with the place and the
        date. Stamps gather into a Passport that is{" "}
        <Link href="/privacy">private by default</Link> — no public profile, no
        followers, no leaderboard.
      </p>
      <p>
        Collecting a stamp is the only moment Nib Atlas has any interest in where
        you are, and it asks first. Browsing the map never does.
      </p>

      <h2 className="type-h2">What Nib Atlas is not</h2>
      <p>
        There are no star ratings, no review prose, and no ranked feed. Nib Atlas is
        not a shop, and it is not a catalogue of pens, inks, or paper — it is about
        the places, and whether one is worth the trip.
      </p>

      <p className="type-body-sm">
        More on what is stored and what is never stored:{" "}
        <Link href="/privacy">Privacy</Link>.
      </p>

      <AboutReviewerNote />
    </article>
  );
}
