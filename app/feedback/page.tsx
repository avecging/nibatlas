import type { Metadata } from "next";
import Link from "next/link";
import { ContributeForm } from "@/src/components/contribute/ContributeForm";
import { feedbackHref } from "@/src/features/contribute/contribute-links";

export const metadata: Metadata = { title: "Share feedback" };

export default function Page() {
  return (
    <article className="prose-page">
      <p className="type-overline"><Link href="/me#me-contribute">Contribute</Link></p>
      <h1 className="type-h1">Share feedback</h1>
      <p className="type-body-lg">Ideas, confusing moments, and general comments are all welcome.</p>
      <p>You can optionally include the page path your feedback is about.</p>
      <p>Please leave out passwords, precise locations and other sensitive information.
        Your name and email are optional. Submissions are privately reviewed in Google Sheets.
        See <Link href="/privacy">Privacy</Link>.</p>
      <ContributeForm
        kind="feedback"
        fallbackHref={feedbackHref()}
        submitLabel="Send feedback"
        confirmationTitle="Thanks for contributing!"
        confirmation="Thanks for helping improve Nib Atlas. If you left an email, we may ask a follow-up question."
        anotherLabel="Send another"
      />
    </article>
  );
}
