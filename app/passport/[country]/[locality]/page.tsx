import type { Metadata } from "next";

import { PassportLocalityView } from "@/src/components/passport/PassportViews";

export const metadata: Metadata = {
  title: "Passport locality",
};

export default async function PassportLocalityPage({
  params,
}: {
  readonly params: Promise<{ readonly country: string; readonly locality: string }>;
}) {
  const { country, locality } = await params;

  return <PassportLocalityView country={country} locality={locality} />;
}
