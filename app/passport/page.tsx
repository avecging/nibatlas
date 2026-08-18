import type { Metadata } from "next";

import { PassportOverviewView } from "@/src/components/passport/PassportViews";

export const metadata: Metadata = {
  title: "Passport",
  description: "A private geographic record of collected Atlas Stamps.",
};

export default function PassportPage() {
  return <PassportOverviewView />;
}
