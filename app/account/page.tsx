import { redirect } from "next/navigation";

/**
 * Compatibility route from `UX.md`. Account lives inside Me rather than as a
 * separate destination, so this redirects to the relevant section.
 */
export default function AccountPage() {
  redirect("/me#me-profile");
}
