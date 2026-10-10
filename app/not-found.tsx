import type { Metadata } from "next";
import { OffTheMap } from "@/src/components/errors/OffTheMap";

export const metadata: Metadata = {
  title: "Off the map",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <OffTheMap variant="missing" />;
}
