import type { Metadata } from "next";

import { PassportCountryView } from "@/src/components/passport/PassportViews";

export const metadata: Metadata = {
  title: "Passport country",
};

export default async function PassportCountryPage({
  params,
}: {
  readonly params: Promise<{ readonly country: string }>;
}) {
  const { country } = await params;

  return <PassportCountryView country={country} />;
}
