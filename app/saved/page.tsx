import type { Metadata } from "next";

import { SavedView } from "@/src/components/shops/SavedView";

export const metadata: Metadata = {
  title: "Saved",
  description: "Shops saved for a future visit.",
};

export default function SavedPage() {
  return <SavedView />;
}
