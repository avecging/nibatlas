import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginScreen } from "@/src/features/auth/LoginScreen";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to Nib Atlas with a link sent to your email address, or with Google.",
};

/**
 * The route form of the sign-in interruption, from `UX.md`'s route map.
 *
 * Public, like every other page here: it is what a signed-out reader is sent to
 * by a link, and it must not require a session to render. The Suspense boundary
 * is there because the screen reads `returnTo` from the query, and a page that
 * reads search parameters cannot otherwise be prerendered.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<p style={{ padding: "1rem" }}>Loading sign-in…</p>}>
      <LoginScreen />
    </Suspense>
  );
}
