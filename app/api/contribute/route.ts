import {
  hasErrors,
  normaliseSubmission,
  validateSubmission,
  type ContributionKind,
  type SubmissionValues,
} from "@/src/features/contribute/contribute-schema";
import { resolveShopIdentity } from "@/src/features/shops/server-shop-identity-source";

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

/**
 * Larger than any honest submission. Reading stops the instant a request
 * exceeds it, so an oversized body is never fully held in memory — the cap
 * is enforced against the stream as it arrives, not against a buffer already
 * built from it.
 */
const MAX_BODY_BYTES = 16_384;

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** The upstream is a Google redirect chain; do not let it hang the request. */
const UPSTREAM_TIMEOUT_MS = 10_000;

function fail(status: number, error: string, extra: object = {}) {
  return Response.json({ ok: false, error, ...extra }, { status });
}

/**
 * Reads the body a chunk at a time and gives up the moment it is too big.
 *
 * This endpoint is public and unauthenticated, and Turnstile is checked only
 * after the body is parsed — so `request.text()`, which buffers the whole
 * request before anything can be measured, would let an oversized request
 * consume the isolate's memory before the size check ever runs. Returns
 * `undefined` once the cap is exceeded, rather than the bytes read so far.
 */
async function readBoundedBody(
  request: Request,
  maxBytes: number,
): Promise<string | undefined> {
  const reader = request.body?.getReader();

  if (!reader) {
    return "";
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    total += value.byteLength;

    if (total > maxBytes) {
      await reader.cancel().catch(() => {});

      return undefined;
    }

    chunks.push(value);
  }

  const combined = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(combined);
}

/**
 * `JSON.parse` only proves the body is valid JSON, not that it is the shape
 * this route expects — `null`, an array, or a string all parse cleanly and
 * would otherwise throw the moment a field on them is read. Field values are
 * kept only when they are strings, so a caller cannot smuggle a number or
 * object past `.trim()` in the schema either.
 */
function stringValues(input: unknown): SubmissionValues {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {};
  }

  const values: Record<string, string> = {};

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === "string") {
      values[key] = value;
    }
  }

  return values;
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

  let raw: string | undefined;

  try {
    raw = await readBoundedBody(request, MAX_BODY_BYTES);
  } catch {
    return fail(400, "unreadable");
  }

  if (raw === undefined) {
    return fail(413, "too_large");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail(400, "invalid_json");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return fail(400, "invalid_json");
  }

  const body = parsed as Record<string, unknown>;

  if (body["kind"] !== "suggestion" && body["kind"] !== "correction") {
    return fail(400, "unknown_kind");
  }

  const kind = body["kind"] as ContributionKind;
  const shopSlug = typeof body["shopSlug"] === "string" ? body["shopSlug"] : undefined;
  const turnstileToken =
    typeof body["turnstileToken"] === "string" ? body["turnstileToken"] : "";

  /*
   * A correction carries its listing, and the listing's name is resolved here
   * rather than trusted from the request. The reader never typed it, so a name
   * arriving in the payload would be a name the client chose — and a correction
   * filed against a shop that does not exist is not a correction.
   */
  const context: Record<string, string> = {};

  if (kind === "correction") {
    const result = shopSlug
      ? await resolveShopIdentity(shopSlug, {}, request.signal)
      : { status: "missing" as const };

    if (result.status === "unavailable") {
      return fail(503, "unavailable");
    }

    if (result.status === "missing") {
      return fail(400, "unknown_shop");
    }

    context["shop_slug"] = result.shop.slug;
    context["shop_name"] = result.shop.name;
  }

  const submitted = stringValues(body["values"]);
  const fieldErrors = validateSubmission(kind, submitted);

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
      turnstileToken,
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
    ...normaliseSubmission(kind, submitted),
    ...context,
  };

  try {
    const delivered = await forward(scriptUrl, sharedSecret, kind, fields);

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
