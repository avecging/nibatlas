import type { Metadata } from "next";
import { AtlasErrorPage } from "@/src/components/errors/AtlasErrorPage";

export const metadata: Metadata = { title: "Access Denied", robots: { index: false, follow: false } };

export default function AccessDenied() {
  return <AtlasErrorPage kind="access-denied" />;
}
