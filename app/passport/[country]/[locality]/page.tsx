import type { Metadata } from "next";

import { PassportScreen } from "@/src/components/passport/PassportScreen";

export const metadata: Metadata = {
  title: "Passport locality",
};

export default async function PassportLocalityPage({
  params,
}: {
  readonly params: Promise<{ readonly country: string; readonly locality: string }>;
}) {
  const { country, locality } = await params;

  return <PassportScreen target={{ kind: "locality", country, locality }} />;
}
