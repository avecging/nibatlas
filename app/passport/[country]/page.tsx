import type { Metadata } from "next";

import { PassportScreen } from "@/src/components/passport/PassportScreen";

export const metadata: Metadata = {
  title: "Passport country",
};

export default async function PassportCountryPage({
  params,
}: {
  readonly params: Promise<{ readonly country: string }>;
}) {
  const { country } = await params;

  return <PassportScreen target={{ kind: "country", country }} />;
}
