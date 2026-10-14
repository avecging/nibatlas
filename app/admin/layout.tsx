import type { Metadata } from "next";
import type { ReactNode } from "react";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Shop administration",
  robots: { index: false, follow: false },
};
// Block all admin DOM from session replay, including client-side transitions
// before the analytics navigation effect can stop recording.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div data-ph-no-capture="">{children}</div>;
}
