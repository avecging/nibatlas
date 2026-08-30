import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ShopActions, ShopStatusBadges } from "@/src/components/shops/ShopActions";
import { ShopSaveButton } from "@/src/components/shops/ShopSaveButton";
import { ShopBackLink } from "@/src/components/shops/ShopBackLink";
import { ShopDetailView } from "@/src/components/shops/ShopDetailView";
import { shopMetaDescription } from "@/src/components/shops/shop-metadata";
import detailStyles from "@/src/components/shops/ShopDetailView.module.css";
import { nearbyPenShops } from "@/src/domain/nearby-shops";
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
    title: shop.name,
    // Shared and indexed, so this is product copy rather than a build note, and
    // it is built only from fields the record actually carries — a preview must
    // never advertise an address or hours the page omits.
    description: shopMetaDescription(shop),
  };
}

export default async function ShopPage({
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
    <ShopDetailView
      shop={shop}
      // Derived from the same catalogue the map reads, so nothing here is a
      // separate data structure that could drift out of step with the records.
      nearby={nearbyPenShops(shop, prototypeShopDetails)}
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
