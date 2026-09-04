import {
  appendAuthResult,
  clearAuthContinuation,
  DEFAULT_AUTH_RETURN_TO,
  finishAuthContinuation,
  readAuthContinuation,
  writeAuthContinuation,
  type AuthCookieStore,
  type AuthErrorCode,
} from "@/src/server/auth/continuation";

export interface AuthFailure {
  readonly code?: string | undefined;
  readonly status?: number | undefined;
}

export interface AuthGateway {
  signInWithOtp(input: {
    email: string;
    options: { emailRedirectTo: string; shouldCreateUser: boolean };
  }): Promise<{ error: AuthFailure | null }>;
  signInWithOAuth(input: {
    provider: "google";
    options: { redirectTo: string; skipBrowserRedirect: true };
  }): Promise<{ data: { url: string | null }; error: AuthFailure | null }>;
  exchangeCodeForSession(code: string): Promise<{ error: AuthFailure | null }>;
  verifyOtp(input: {
    token_hash: string;
    type: "email";
  }): Promise<{ error: AuthFailure | null }>;
  signOut(input: { scope: "local" }): Promise<{ error: AuthFailure | null }>;
  getClaims(): Promise<{
    data: { claims: Record<string, unknown> } | null;
    error: AuthFailure | null;
  }>;
  getProfile(userId: string): Promise<{
    data: { display_name: string | null } | null;
    error: unknown | null;
  }>;
}

export interface AuthRouteDependencies {
  readonly auth: AuthGateway;
  readonly cookies: AuthCookieStore;
  readonly supabaseOrigin: string;
  readonly now?: () => number;
}

const NO_STORE = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
} as const;
const MAX_AUTH_BODY_BYTES = 4_096;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: NO_STORE });
}

function fail(status: number, error: string) {
  return json({ ok: false, error: { code: error } }, status);
}

function redirect(request: Request, returnTo: string, result: {
  readonly auth?: "success";
  readonly authError?: AuthErrorCode;
}) {
  return new Response(null, {
    status: 303,
    headers: {
      ...NO_STORE,
      Location: new URL(appendAuthResult(returnTo, result), request.url).href,
    },
  });
}

function requestOrigin(request: Request) {
  return new URL(request.url).origin;
}

function trustedMutation(request: Request) {
  const origin = request.headers.get("Origin");

  return origin !== null && origin === requestOrigin(request);
}

async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return null;
  }

  const declaredLength = Number(request.headers.get("Content-Length"));

  if (Number.isFinite(declaredLength) && declaredLength > MAX_AUTH_BODY_BYTES) {
    return null;
  }

  try {
    const raw = await request.text();

    if (new TextEncoder().encode(raw).byteLength > MAX_AUTH_BODY_BYTES) {
      return null;
    }

    const value: unknown = JSON.parse(raw);

    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function hasOnly(input: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(input).every((key) => allowed.includes(key));
}

function classifyCallbackError(error: AuthFailure | null): AuthErrorCode {
  const code = error?.code?.toLowerCase() ?? "";

  if (code.includes("expired") || code === "otp_expired") {
    return "expired_link";
  }

  if (
    code.includes("flow_state") ||
    code.includes("invalid") ||
    code === "bad_code_verifier"
  ) {
    return "invalid_callback";
  }

  return "service_unavailable";
}

export async function startMagicLink(
  request: Request,
  dependencies: AuthRouteDependencies,
) {
  if (!trustedMutation(request)) {
    return fail(403, "untrusted_origin");
  }

  const body = await readJsonObject(request);

  if (!body || !hasOnly(body, ["email", "returnTo", "intent"])) {
    return fail(400, "invalid_request");
  }

  const email = typeof body["email"] === "string" ? body["email"].trim() : "";

  if (email.length > 254 || !EMAIL.test(email)) {
    return fail(400, "invalid_email");
  }

  clearAuthContinuation(dependencies.cookies);
  const { error } = await dependencies.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: requestOrigin(request),
      shouldCreateUser: true,
    },
  });

  if (error) {
    return fail(error.status === 429 ? 429 : 502, "magic_link_unavailable");
  }

  writeAuthContinuation(
    dependencies.cookies,
    { returnTo: body["returnTo"], intent: body["intent"] },
    dependencies.now?.(),
  );

  // The same response is returned whether or not an account existed before.
  return json({ ok: true }, 202);
}

export async function startGoogle(
  request: Request,
  dependencies: AuthRouteDependencies,
) {
  if (!trustedMutation(request)) {
    return fail(403, "untrusted_origin");
  }

  const body = await readJsonObject(request);

  if (!body || !hasOnly(body, ["returnTo", "intent"])) {
    return fail(400, "invalid_request");
  }

  clearAuthContinuation(dependencies.cookies);
  const { data, error } = await dependencies.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${requestOrigin(request)}/auth/callback`,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return fail(502, "google_unavailable");
  }

  let providerUrl: URL;

  try {
    providerUrl = new URL(data.url);
  } catch {
    return fail(502, "google_unavailable");
  }

  if (
    providerUrl.origin !== dependencies.supabaseOrigin ||
    providerUrl.pathname !== "/auth/v1/authorize" ||
    providerUrl.searchParams.get("provider") !== "google"
  ) {
    return fail(502, "google_unavailable");
  }

  writeAuthContinuation(
    dependencies.cookies,
    { returnTo: body["returnTo"], intent: body["intent"] },
    dependencies.now?.(),
  );

  return new Response(null, {
    status: 303,
    headers: { ...NO_STORE, Location: providerUrl.href },
  });
}

function callbackTarget(dependencies: AuthRouteDependencies) {
  return (
    readAuthContinuation(dependencies.cookies, dependencies.now?.())?.returnTo ??
    DEFAULT_AUTH_RETURN_TO
  );
}

export async function finishOAuthCallback(
  request: Request,
  dependencies: AuthRouteDependencies,
) {
  const url = new URL(request.url);
  const returnTo = callbackTarget(dependencies);

  if (url.searchParams.has("error")) {
    clearAuthContinuation(dependencies.cookies);

    return redirect(request, returnTo, { authError: "provider_denied" });
  }

  const code = url.searchParams.get("code");

  if (!code || code.length > 2_048) {
    clearAuthContinuation(dependencies.cookies);

    return redirect(request, returnTo, { authError: "invalid_callback" });
  }

  const { error } = await dependencies.auth.exchangeCodeForSession(code);

  if (error) {
    clearAuthContinuation(dependencies.cookies);

    return redirect(request, returnTo, { authError: classifyCallbackError(error) });
  }

  finishAuthContinuation(dependencies.cookies, dependencies.now?.());

  return redirect(request, returnTo, { auth: "success" });
}

export async function finishMagicLink(
  request: Request,
  dependencies: AuthRouteDependencies,
) {
  const url = new URL(request.url);
  const returnTo = callbackTarget(dependencies);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  if (!tokenHash || tokenHash.length > 2_048 || type !== "email") {
    clearAuthContinuation(dependencies.cookies);

    return redirect(request, returnTo, { authError: "invalid_callback" });
  }

  const { error } = await dependencies.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });

  if (error) {
    clearAuthContinuation(dependencies.cookies);

    return redirect(request, returnTo, { authError: classifyCallbackError(error) });
  }

  finishAuthContinuation(dependencies.cookies, dependencies.now?.());

  return redirect(request, returnTo, { auth: "success" });
}

export async function signOut(
  request: Request,
  dependencies: AuthRouteDependencies,
) {
  if (!trustedMutation(request)) {
    return fail(403, "untrusted_origin");
  }

  const { error } = await dependencies.auth.signOut({ scope: "local" });

  if (error) {
    return fail(502, "sign_out_failed");
  }

  clearAuthContinuation(dependencies.cookies);

  return new Response(null, { status: 204, headers: NO_STORE });
}

export async function readSession(
  _request: Request,
  dependencies: AuthRouteDependencies,
) {
  const { data, error } = await dependencies.auth.getClaims();
  const claims = data?.claims;
  const userId = claims?.["sub"];

  if (error) {
    return fail(503, "session_unavailable");
  }

  if (!claims || typeof userId !== "string") {
    return json({ status: "signed-out" });
  }

  const profile = await dependencies.auth.getProfile(userId);

  if (profile.error) {
    return fail(503, "session_unavailable");
  }

  const email = claims["email"];

  return json({
    status: "signed-in",
    userId,
    identityLabel: typeof email === "string" ? email : "Signed-in account",
    displayName: profile.data?.display_name ?? null,
  });
}
