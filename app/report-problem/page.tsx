import type { Metadata } from "next";
import Link from "next/link";
import { ReportProblemForm } from "@/src/components/contribute/ReportProblemForm";
import { reportProblemHref } from "@/src/features/contribute/contribute-links";

export const metadata: Metadata = { title: "Report a problem" };

export default function Page() {
  return (
    <article className="prose-page">
      <p className="type-overline"><Link href="/me#me-contribute">Contribute</Link></p>
      <h1 className="type-h1">Report a problem</h1>
      <p className="type-body-lg">Tell us what went wrong and, if you can, which page or feature you were using.</p>
      <p>Reports include this form’s page path, submission time, a coarse browser/device summary and whether the app shows you as signed in. No account identity is attached.</p>
      <p>Please leave out passwords, precise locations and other sensitive information.
        Your name and email are optional. Submissions are privately reviewed in Google Sheets.
        See <Link href="/privacy">Privacy</Link>.</p>
      <ReportProblemForm
        
        fallbackHref={reportProblemHref()}
        submitLabel="Send report"
        confirmationTitle="Thanks for contributing!"
        confirmation="We’ll look into it. If you left an email, we may ask a follow-up question."
        anotherLabel="Send another"
      />
    </article>
  );
}
