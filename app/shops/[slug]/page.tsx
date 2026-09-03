import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ShopActions, ShopStatusBadges } from "@/src/components/shops/ShopActions";
import { ShopSaveButton } from "@/src/components/shops/ShopSaveButton";
import { ShopBackLink } from "@/src/components/shops/ShopBackLink";
import { ShopDetailUnavailable } from "@/src/components/shops/ShopDetailUnavailable";
import { ShopDetailView } from "@/src/components/shops/ShopDetailView";
import { shopMetaDescription } from "@/src/components/shops/shop-metadata";
import detailStyles from "@/src/components/shops/ShopDetailView.module.css";
import { readCatalogueMode } from "@/src/features/catalogue/catalogue-mode";
import { shopDetailForRequest } from "@/src/features/shops/server-shop-detail-source";
import { prototypeShopDetails } from "@/src/fixtures/prototype-catalogue";

/**
 * Prerendered slugs.
 *
 * Only fixture mode has a slug list to enumerate at build time. In API mode the
 * catalogue is a database this build knows nothing about, so the route renders
 * on request instead — which is also what keeps a published shop appearing
 * without a redeploy. Either way the `/shops/[slug]` URL is unchanged.
 */
export function generateStaticParams() {
  return readCatalogueMode().mode === "fixture"
    ? prototypeShopDetails.map((shop) => ({ slug: shop.slug }))
    : [];
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await shopDetailForRequest(slug);

  if (result.status === "missing") {
    return { title: "Shop not found" };
  }

  /*
   * A page that could not be read has no title to give and nothing to index. It
   * is explicitly `noindex` rather than left to chance: a crawler that captured
   * this state would otherwise hold "unavailable" as the listing.
   */
  if (result.status === "unavailable") {
    return { title: "Shop page unavailable", robots: { index: false, follow: true } };
  }

  return {
    title: result.shop.name,
    // Shared and indexed, so this is product copy rather than a build note, and
    // it is built only from fields the record actually carries — a preview must
    // never advertise an address or hours the page omits.
    description: shopMetaDescription(result.shop),
  };
}

export default async function ShopPage({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}) {
  const { slug } = await params;
  const result = await shopDetailForRequest(slug);

  if (result.status === "missing") {
    notFound();
  }

  /*
   * A failed read is not a missing shop.
   *
   * `notFound()` here would tell the reader this shop does not exist, and a
   * fixture fallback would invent one. The URL stays valid and the page says the
   * listing could not be loaded.
   */
  if (result.status === "unavailable") {
    return <ShopDetailUnavailable slug={slug} reason={result.reason} />;
  }

  const { shop } = result;

  return (
    <ShopDetailView
      shop={shop}
      nearby={result.nearby}
      back={
        <Suspense
          fallback={<span className={detailStyles.back}>Back to map</span>}
        >
          <ShopBackLink className={detailStyles.back} shopSlug={shop.slug} />
        </Suspense>
      }
      save={<ShopSaveButton shop={shop} />}
      statusBadges={<ShopStatusBadges shop={shop} />}
      actions={<ShopActions shop={shop} />}
    />
  );
}
