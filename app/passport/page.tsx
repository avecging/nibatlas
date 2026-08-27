import type { Metadata } from "next";

import { PassportScreen } from "@/src/components/passport/PassportScreen";

export const metadata: Metadata = {
  title: "Passport",
  description: "A private geographic record of collected Atlas Stamps.",
};

export default function PassportPage() {
  return <PassportScreen target={{ kind: "all" }} />;
}
