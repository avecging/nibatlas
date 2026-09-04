import { cookies } from "next/headers";

import type {
  AuthFailure,
  AuthGateway,
  AuthRouteDependencies,
} from "@/src/server/auth/http";
import {
  createSupabaseServerClient,
  SupabaseUnavailableError,
} from "@/src/server/supabase/server-client";
import { readSupabasePublicConfig } from "@/src/server/supabase/config";

export async function createAuthRouteDependencies(): Promise<AuthRouteDependencies> {
  const cookieStore = await cookies();
  const supabase = await createSupabaseServerClient();
  const config = readSupabasePublicConfig();

  if (!config) {
    throw new SupabaseUnavailableError();
  }
  const failure = (
    error: { code?: string | undefined; status?: number | undefined } | null,
  ): AuthFailure | null =>
    error
      ? {
          ...(typeof error.code === "string" ? { code: error.code } : {}),
          ...(typeof error.status === "number" ? { status: error.status } : {}),
        }
      : null;
  const auth: AuthGateway = {
    signInWithOtp: async (input) => {
      const { error } = await supabase.auth.signInWithOtp(input);
      return { error: failure(error) };
    },
    signInWithOAuth: async (input) => {
      const { data, error } = await supabase.auth.signInWithOAuth(input);
      return { data: { url: data.url }, error: failure(error) };
    },
    exchangeCodeForSession: async (code) => {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      return { error: failure(error) };
    },
    verifyOtp: async (input) => {
      const { error } = await supabase.auth.verifyOtp(input);
      return { error: failure(error) };
    },
    signOut: async (input) => {
      const { error } = await supabase.auth.signOut(input);
      return { error: failure(error) };
    },
    getClaims: async () => {
      const { data, error } = await supabase.auth.getClaims();

      return {
        data: data ? { claims: data.claims as Record<string, unknown> } : null,
        error: failure(error),
      };
    },
    getProfile: async (userId) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle();

      return { data, error };
    },
  };

  return {
    auth,
    supabaseOrigin: new URL(config.url).origin,
    cookies: {
      get: (name) => cookieStore.get(name),
      set: (name, value, options) => cookieStore.set(name, value, options),
      delete: (name) => cookieStore.delete(name),
    },
  };
}

export async function withAuthRoute(
  handler: (dependencies: AuthRouteDependencies) => Promise<Response>,
) {
  try {
    return await handler(await createAuthRouteDependencies());
  } catch (error) {
    if (error instanceof SupabaseUnavailableError) {
      return Response.json(
        { ok: false, error: { code: "auth_unavailable" } },
        { status: 503, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    throw error;
  }
}
