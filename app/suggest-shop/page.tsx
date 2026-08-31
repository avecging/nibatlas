import type { Metadata } from "next";
import Link from "next/link";

import { ContributeForm } from "@/src/components/contribute/ContributeForm";
import { suggestShopHref } from "@/src/features/contribute/contribute-links";

export const metadata: Metadata = {
  title: "Suggest a pen shop",
  description:
    "Tell us about a fountain pen shop that is not on the map, and what makes it worth a visit.",
};

/**
 * Suggest a pen shop.
 *
 * An undistracted page: what the catalogue takes, then the form, and nothing
 * else competing for the screen. Somebody filling this in is doing the product a
 * favour, and the page should not spend their attention on anything but the
 * task.
 *
 * The expectations are set before the fields rather than after them. What
 * happens to a suggestion, and how long it takes, are the two questions a person
 * has while deciding whether to bother — answering them afterwards answers them
 * too late.
 */
export default function SuggestShopPage() {
  return (
    <article className="prose-page">
      <p className="type-overline">Contribute</p>
      <h1 className="type-h1">Suggest a pen shop</h1>
      <p className="type-body-lg">
        If you know a fountain pen shop that is not on the map, this is the way to
        tell us about it.
      </p>

      <p>
        Every listing is entered by hand from a source we can point to, so a
        suggestion is the start of that work rather than the end of it — someone
        checks the shop exists, that it is still trading, and what it actually
        offers before it appears. That takes a while, and it means not every
        suggestion becomes a listing.
      </p>
      <p>
        <strong>The shop&rsquo;s name and where it is are the parts we need.</strong>{" "}
        Everything else helps and none of it is required. A name and a city we can
        research; a detailed description of a shop we cannot find, we cannot.
      </p>

      <ContributeForm
        kind="suggestion"
        fallbackHref={suggestShopHref()}
        submitLabel="Send this suggestion"
        confirmation="Someone will look into this shop and check what can be confirmed about it. If you left an email address, we may come back to you with a question."
      />

      <p className="type-body-sm">
        A shop that is already on the map but has something wrong with it is a
        different job — use <strong>Report incorrect information</strong>{" "}
        at the foot of that shop&rsquo;s own page, which carries the listing
        with it.
        More about the catalogue: <Link href="/about">About Nib Atlas</Link>.
      </p>
    </article>
  );
}
