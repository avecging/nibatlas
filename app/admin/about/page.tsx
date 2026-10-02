import type { Metadata } from "next";
import { AboutAdmin } from "@/src/features/about/AboutAdmin";
export const metadata: Metadata = { title: "About page administration" };
export default function Page() {
  return <AboutAdmin />;
}
