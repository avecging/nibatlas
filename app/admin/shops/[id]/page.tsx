import { notFound } from "next/navigation";
import { ShopAdmin } from "@/src/features/admin/ShopAdmin";
import { UUID } from "@/src/features/admin/shop-contract";
export default async function Shop({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <ShopAdmin id={id} />;
}
