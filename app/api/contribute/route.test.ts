import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/contribute/route";

const SCRIPT_URL = "https://script.google.com/macros/s/deployment/exec";
const SECRET = "shared-secret-value";

const CORRECTION = {
  kind: "correction",
  shopSlug: "ty-lee-pen-shop",
  values: { correction_type: "hours", what_is_wrong: "It opens at 11." },
};

const SUGGESTION = {
  kind: "suggestion",
  values: { shop_name: "Pen and Paper", country: "South Korea" },
};

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("https://nibatlas.test/api/contribute", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

/** The intake accepted whatever it was given. */
function intakeAccepts() {
  return vi.fn(async () =>
    Response.json({ ok: true, row: 2, status: 200 }),
  );
}

/**
 * One recorded `fetch` call.
 *
 * `vi.fn()` types its calls as `unknown[]`, so reading a URL and an init out of
 * one needs a cast somewhere; doing it once here keeps it out of the tests.
 */
type FetchCall = readonly [string, RequestInit];

function callOf(mock: ReturnType<typeof vi.fn>, index = 0): FetchCall {
  return mock.mock.calls[index] as unknown as FetchCall;
}

/** What the script was sent, parsed. */
function forwarded(fetchMock: ReturnType<typeof vi.fn>) {
  const [, init] = callOf(fetchMock, fetchMock.mock.calls.length - 1);

  return JSON.parse(String(init.body));
}

beforeEach(() => {
  vi.stubEnv("CONTRIBUTE_SCRIPT_URL", SCRIPT_URL);
  vi.stubEnv("CONTRIBUTE_SHARED_SECRET", SECRET);
  vi.stubEnv("TURNSTILE_SECRET_KEY", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("what reaches the intake", () => {
  it("forwards a valid suggestion with the shared secret", async () => {
    const fetchMock = intakeAccepts();
    vi.stubGlobal("fetch", fetchMock);

    const response = await post(SUGGESTION);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });

    const [url] = callOf(fetchMock);
    expect(url).toBe(SCRIPT_URL);

    const body = forwarded(fetchMock);
    expect(body.secret).toBe(SECRET);
    expect(body.type).toBe("suggestion");
    expect(body.fields.shop_name).toBe("Pen and Paper");
  });

  /*
   * A Web App answers a POST with a redirect to script.googleusercontent.com. A
   * client that does not follow it reads an empty response as a failure, and
   * every submission would appear to fail while landing in the sheet.
   */
  it("follows the redirect the Apps Script deployment answers with", async () => {
    const fetchMock = intakeAccepts();
    vi.stubGlobal("fetch", fetchMock);

    await post(SUGGESTION);

    const [, init] = callOf(fetchMock);
    expect(init.redirect).toBe("follow");
  });

  it("resolves the correction's listing itself rather than trusting the request", async () => {
    const fetchMock = intakeAccepts();
    vi.stubGlobal("fetch", fetchMock);

    await post({
      ...CORRECTION,
      // A client that sends its own name for the shop is ignored.
      values: { ...CORRECTION.values, shop_name: "Somewhere Else" },
    });

    const body = forwarded(fetchMock);
    expect(body.fields.shop_slug).toBe("ty-lee-pen-shop");
    expect(body.fields.shop_name).toBe("TY Lee Pen Shop");
  });

  it("never forwards the reviewing team's own columns", async () => {
    const fetchMock = intakeAccepts();
    vi.stubGlobal("fetch", fetchMock);

    await post({
      ...SUGGESTION,
      values: { ...SUGGESTION.values, status: "applied", admin_notes: "ok" },
    });

    const body = forwarded(fetchMock);
    expect(body.fields.status).toBeUndefined();
    expect(body.fields.admin_notes).toBeUndefined();
  });
});

describe("what is refused", () => {
  it("re-runs validation rather than trusting the browser", async () => {
    const fetchMock = intakeAccepts();
    vi.stubGlobal("fetch", fetchMock);

    const response = await post({ kind: "suggestion", values: { shop_name: "" } });
    const payload = (await response.json()) as {
      error: string;
      fieldErrors: Record<string, string>;
    };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("invalid");
    expect(Object.keys(payload.fieldErrors).sort()).toEqual(["country", "shop_name"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a correction against a listing that does not exist", async () => {
    const fetchMock = intakeAccepts();
    vi.stubGlobal("fetch", fetchMock);

    const response = await post({ ...CORRECTION, shopSlug: "not-a-shop" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "unknown_shop" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a kind it does not know", async () => {
    const response = await post({ kind: "merchant_claim", values: {} });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "unknown_kind" });
  });

  it("refuses a body large enough to be an attack rather than a submission", async () => {
    const response = await post(
      JSON.stringify({ ...SUGGESTION, padding: "x".repeat(20_000) }),
    );

    expect(response.status).toBe(413);
  });

  it("stops reading the request stream as soon as the byte cap is exceeded", async () => {
    const totalChunks = 10;
    let pulls = 0;
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;

        if (pulls > totalChunks) {
          controller.close();

          return;
        }

        controller.enqueue(new Uint8Array(4_096));
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request("https://nibatlas.test/api/contribute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThan(totalChunks);
  });

  it.each([null, [], JSON.stringify("valid JSON, wrong outer shape")])(
    "refuses a syntactically valid non-object JSON body: %j",
    async (body) => {
      const response = await post(body);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: "invalid_json" });
    },
  );

  it("refuses non-string submitted fields without throwing or forwarding", async () => {
    const fetchMock = intakeAccepts();
    vi.stubGlobal("fetch", fetchMock);

    const response = await post({
      kind: "suggestion",
      values: { shop_name: 42, country: "South Korea" },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid",
      fieldErrors: { shop_name: "Shop name is needed." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a body that is not JSON", async () => {
    const response = await post("not json at all");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_json" });
  });
});

/**
 * The endpoint is public. Turnstile is the only thing standing between it and a
 * bot, so the ways it could be bypassed are worth stating as tests.
 */
describe("the spam control", () => {
  it("refuses a submission whose challenge does not verify", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "turnstile-secret");

    const fetchMock = vi.fn(async () => Response.json({ success: false }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await post({ ...SUGGESTION, turnstileToken: "wrong" });

    expect(response.status).toBe(403);
    // Verification was the only call: nothing reached the intake.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a submission carrying no token at all", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "turnstile-secret");

    const fetchMock = vi.fn(async () => Response.json({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await post(SUGGESTION);

    expect(response.status).toBe(403);
    // Not even the verifier was called: an absent token cannot pass.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a verifier it cannot reach as a challenge that did not pass", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "turnstile-secret");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }),
    );

    const response = await post({ ...SUGGESTION, turnstileToken: "token" });

    expect(response.status).toBe(403);
  });

  it("passes the caller's address to the verifier when Cloudflare supplies one", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "turnstile-secret");

    const fetchMock = vi.fn(async (url: string) =>
      String(url).includes("turnstile")
        ? Response.json({ success: true })
        : Response.json({ ok: true }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await post(
      { ...SUGGESTION, turnstileToken: "token" },
      { "CF-Connecting-IP": "203.0.113.7" },
    );

    const [, init] = callOf(fetchMock);
    expect((init.body as FormData).get("remoteip")).toBe("203.0.113.7");
  });
});

describe("when something is not configured", () => {
  it("reports unavailable rather than pretending, with no intake to send to", async () => {
    vi.stubEnv("CONTRIBUTE_SCRIPT_URL", "");

    const response = await post(SUGGESTION);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "unavailable" });
  });

  /*
   * The control must not be switchable off by omission. A production build with
   * no Turnstile secret refuses submissions rather than accepting unverified
   * ones — the failure of a misconfigured deployment is that nothing arrives,
   * never that anything arrives unchecked.
   */
  it("fails closed in production when the spam control is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");

    const fetchMock = intakeAccepts();
    vi.stubGlobal("fetch", fetchMock);

    const response = await post(SUGGESTION);

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a failure the intake refused, rather than a success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: false, error: "forbidden" })),
    );

    const response = await post(SUGGESTION);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: "not_delivered" });
  });

  it("reports a failure when the intake cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("upstream down");
      }),
    );

    const response = await post(SUGGESTION);

    expect(response.status).toBe(502);
  });
});
