import {
  hasErrors,
  normaliseSubmission,
  validateSubmission,
  type ContributionKind,
  type SubmissionValues,
} from "@/src/features/contribute/contribute-schema";
import { findPrototypeShop } from "@/src/fixtures/prototype-catalogue";

/**
 * Contribution intake.
 *
 * The only server-side route the contribution flows have, and the reason there
 * is one at all: the Apps Script deployment URL and its shared secret must never
 * reach a browser. An Apps Script Web App set to *Anyone* is a public,
 * unauthenticated write endpoint, so a page posting to it directly would publish
 * both the address and the key to whoever opened the network tab.
 *
 * Everything the client sent is re-validated here. Client-side validation is a
 * courtesy to the person typing; this is the control.
 *
 * Setup and secrets: `docs/runbooks/contribution-intake.md`.
 */

/** Larger than any honest submission; small enough that nothing is buffered. */
const MAX_BODY_BYTES = 16_384;

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** The upstream is a Google redirect chain; do not let it hang the request. */
const UPSTREAM_TIMEOUT_MS = 10_000;

interface ContributeRequest {
  readonly kind: ContributionKind;
  readonly values: SubmissionValues;
  readonly turnstileToken?: string;
  /** Correction only. The listing the reader came from. */
  readonly shopSlug?: string;
}

function fail(status: number, error: string, extra: object = {}) {
  return Response.json({ ok: false, error, ...extra }, { status });
}

export async function POST(request: Request) {
  const scriptUrl = process.env["CONTRIBUTE_SCRIPT_URL"];
  const sharedSecret = process.env["CONTRIBUTE_SHARED_SECRET"];
  const turnstileSecret = process.env["TURNSTILE_SECRET_KEY"];
  const production = process.env.NODE_ENV === "production";

  /*
   * Fail closed in production, open in development.
   *
   * A deployed build with no script URL cannot deliver anything, and answering
   * as though it could would be the fake success this flow exists to avoid. In
   * development the same absence is simply an unconfigured machine, and the form
   * is expected to report that it could not send.
   */
  if (!scriptUrl || !sharedSecret) {
    return fail(503, "unavailable");
  }

  let raw: string;

  try {
    raw = await request.text();
  } catch {
    return fail(400, "unreadable");
  }

  if (raw.length > MAX_BODY_BYTES) {
    return fail(413, "too_large");
  }

  let body: ContributeRequest;

  try {
    body = JSON.parse(raw) as ContributeRequest;
  } catch {
    return fail(400, "invalid_json");
  }

  if (body.kind !== "suggestion" && body.kind !== "correction") {
    return fail(400, "unknown_kind");
  }

  /*
   * A correction carries its listing, and the listing's name is resolved here
   * rather than trusted from the request. The reader never typed it, so a name
   * arriving in the payload would be a name the client chose — and a correction
   * filed against a shop that does not exist is not a correction.
   */
  const context: Record<string, string> = {};

  if (body.kind === "correction") {
    const shop = body.shopSlug ? findPrototypeShop(body.shopSlug) : undefined;

    if (!shop) {
      return fail(400, "unknown_shop");
    }

    context["shop_slug"] = shop.slug;
    context["shop_name"] = shop.name;
  }

  const submitted = typeof body.values === "object" && body.values !== null
    ? body.values
    : {};
  const fieldErrors = validateSubmission(body.kind, submitted);

  if (hasErrors(fieldErrors)) {
    return fail(400, "invalid", { fieldErrors });
  }

  /*
   * Turnstile.
   *
   * A production build with no secret is a misconfiguration, not a licence to
   * accept unverified submissions — the whole point of the control is that it
   * cannot be switched off by omission. Locally, and in the end-to-end suite,
   * there is no secret and no widget, and the check is skipped.
   */
  if (turnstileSecret) {
    const passed = await verifyTurnstile(
      turnstileSecret,
      body.turnstileToken ?? "",
      request.headers.get("CF-Connecting-IP"),
    );

    if (!passed) {
      return fail(403, "challenge_failed");
    }
  } else if (production) {
    console.error("TURNSTILE_SECRET_KEY is not set; refusing to accept submissions.");

    return fail(503, "unavailable");
  }

  /*
   * The context goes on last and is not merged with anything a request sent:
   * `normaliseSubmission` returns only the fields a person filled in, so the
   * listing a correction is filed against is the one the route resolved.
   */
  const fields = {
    ...normaliseSubmission(body.kind, submitted),
    ...context,
  };

  try {
    const delivered = await forward(scriptUrl, sharedSecret, body.kind, fields);

    return delivered ? Response.json({ ok: true }) : fail(502, "not_delivered");
  } catch (error) {
    console.error("Contribution forward failed", error);

    return fail(502, "not_delivered");
  }
}

async function verifyTurnstile(
  secret: string,
  token: string,
  remoteIp: string | null,
): Promise<boolean> {
  if (token === "") {
    return false;
  }

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);

  if (remoteIp) {
    form.append("remoteip", remoteIp);
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!response.ok) {
      return false;
    }

    const result = (await response.json()) as { success?: boolean };

    return result.success === true;
  } catch (error) {
    /*
     * A challenge that cannot be verified is not a challenge that passed. The
     * person sees the submission fail and is offered the email route, which is
     * the honest outcome when the control is unavailable.
     */
    console.error("Turnstile verification failed", error);

    return false;
  }
}

/**
 * Hand the submission to the Apps Script Web App.
 *
 * `redirect: "follow"` is not optional: a Web App answers a POST with a redirect
 * to `script.googleusercontent.com`, and a client that does not follow it reads
 * an empty response as a failure. The script always answers 200 and carries its
 * real status in the body, so `ok` is what decides.
 */
async function forward(
  scriptUrl: string,
  secret: string,
  kind: ContributionKind,
  fields: Record<string, string>,
): Promise<boolean> {
  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, type: kind, fields }),
    redirect: "follow",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!response.ok) {
    console.error("Intake responded", response.status);

    return false;
  }

  const result = (await response.json()) as { ok?: boolean; error?: string };

  if (result.ok !== true) {
    console.error("Intake rejected the submission", result.error);

    return false;
  }

  return true;
}
