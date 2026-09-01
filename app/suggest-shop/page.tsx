import type { Metadata } from "next";

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
        Every listing is checked by hand before it appears, so this is the start
        of that work rather than the end of it. Not every suggestion becomes a
        listing.
      </p>

      <ContributeForm
        kind="suggestion"
        fallbackHref={suggestShopHref()}
        submitLabel="Send this suggestion"
        confirmation="Someone will look into this shop and check what can be confirmed about it. If you left an email address, we may come back to you with a question."
        anotherLabel="Suggest another shop"
      />
    </article>
  );
}
