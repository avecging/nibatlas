import type { Metadata } from "next";

import { DiscoverView } from "@/src/components/shops/DiscoverView";

export const metadata: Metadata = {
  title: "Discover",
  description: "Rule-based prompts that complement the Nib Atlas map.",
};

export default function DiscoverPage() {
  return <DiscoverView />;
}
