import type { Metadata } from "next";

import { MeScreen } from "@/src/features/me/MeScreen";

export const metadata: Metadata = {
  title: "Me",
  description:
    "Profile, places visited, account, settings, privacy, and data controls.",
};

export default function MePage() {
  return <MeScreen />;
}
