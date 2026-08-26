import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ShopActions, ShopStatusBadges } from "@/src/components/shops/ShopActions";
import { ShopBackLink } from "@/src/components/shops/ShopBackLink";
import { ShopDetailView } from "@/src/components/shops/ShopDetailView";
import detailStyles from "@/src/components/shops/ShopDetailView.module.css";
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
    description:
      shop.shortDescription ??
      `${shop.name} in ${shop.localityName}. Prototype catalogue record — a small sourced sample, not a complete listing.`,
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
      back={
        <Suspense
          fallback={<span className={detailStyles.back}>Back to map</span>}
        >
          <ShopBackLink className={detailStyles.back} shopSlug={shop.slug} />
        </Suspense>
      }
      statusBadges={<ShopStatusBadges shop={shop} />}
      actions={<ShopActions shop={shop} />}
    />
  );
}
