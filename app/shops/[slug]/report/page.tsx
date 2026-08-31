import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContributeForm } from "@/src/components/contribute/ContributeForm";
import { shopCorrectionHref } from "@/src/features/contribute/contribute-links";
import {
  findPrototypeShop,
  prototypeShopDetails,
} from "@/src/fixtures/prototype-catalogue";

export function generateStaticParams() {
  return prototypeShopDetails.map((shop) => ({ slug: shop.slug }));
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const shop = findPrototypeShop(slug);

  if (!shop) {
    return { title: "Shop not found" };
  }

  return {
    title: `Report incorrect information — ${shop.name}`,
    description: `Tell us what is wrong with the Nib Atlas listing for ${shop.name}.`,
    // A correction form has nothing to offer a search result, and indexing one
    // per listing would put a form between a reader and the shop they searched
    // for.
    robots: { index: false, follow: true },
  };
}

/**
 * Report incorrect information, for one listing.
 *
 * The listing is in the route, so the page knows which shop this is about and
 * the reader is never asked to identify it — which is what accepted decision 8
 * asks for, and the reason this lives under the shop rather than as a global
 * form. The slug is resolved to a real record here and again in the route
 * handler, so a correction cannot be filed against a shop that does not exist.
 *
 * The page names the shop in its heading rather than in a field, because a fact
 * the product already holds should be shown as a fact, not as a prefilled input
 * somebody has to read and verify.
 */
export default async function ShopReportPage({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}) {
  const { slug } = await params;
  const shop = findPrototypeShop(slug);

  if (!shop) {
    notFound();
  }

  return (
    <article className="prose-page">
      <p className="type-overline">Report incorrect information</p>
      <h1 className="type-h1">{shop.name}</h1>
      <p className="type-body-lg">
        Tell us what is wrong with this listing and we&rsquo;ll look into it as
        soon as possible.
      </p>

      <p>
        This is attached to <strong>{shop.name}</strong> in{" "}
        {shop.localityName} — you don&rsquo;t need to tell us which shop you mean.{" "}
        <Link href={`/shops/${shop.slug}`}>Back to the listing</Link>.
      </p>

      <ContributeForm
        kind="correction"
        shopSlug={shop.slug}
        fallbackHref={shopCorrectionHref(shop.name)}
        submitLabel="Send this correction"
        confirmation="Someone will check this against the shop's own sources and update the listing if it needs it. If you left an email address, we may come back to you with a question."
      />
    </article>
  );
}
