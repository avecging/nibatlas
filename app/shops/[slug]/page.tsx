import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ShopActions, ShopStatusBadges } from "@/src/components/shops/ShopActions";
import { ShopDetailView } from "@/src/components/shops/ShopDetailView";
import { demoShopDetails, findDemoShop } from "@/src/fixtures/demo-catalogue";

export function generateStaticParams() {
  return demoShopDetails.map((shop) => ({ slug: shop.slug }));
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const shop = findDemoShop(slug);

  if (!shop) {
    return { title: "Shop not found" };
  }

  return {
    title: shop.name,
    description: `${shop.shortDescription} Demo fixture record — not a verified business listing.`,
  };
}

export default async function ShopPage({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}) {
  const { slug } = await params;
  const shop = findDemoShop(slug);

  if (!shop) {
    notFound();
  }

  return (
    <ShopDetailView
      shop={shop}
      statusBadges={<ShopStatusBadges shop={shop} />}
      actions={<ShopActions shop={shop} />}
    />
  );
}
