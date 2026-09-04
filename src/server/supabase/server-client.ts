import { createServerClient } from "@supabase/ssr";
import type { CookieMethodsServer, CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { readSupabasePublicConfig } from "@/src/server/supabase/config";

const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

export interface WritableCookieStore {
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options?: CookieOptions): void;
}

export class SupabaseUnavailableError extends Error {
  constructor() {
    super("Supabase authentication is not configured.");
    this.name = "SupabaseUnavailableError";
  }
}

export function createSupabaseCookieMethods(
  cookieStore: WritableCookieStore,
): CookieMethodsServer {
  return {
    encode: "tokens-only",
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      for (const { name, value, options } of cookiesToSet) {
        cookieStore.set(name, value, {
          ...options,
          ...AUTH_COOKIE_OPTIONS,
        });
      }
    },
  };
}

export function createSupabaseClientForCookies(cookieStore: WritableCookieStore) {
  const config = readSupabasePublicConfig();

  if (!config) {
    throw new SupabaseUnavailableError();
  }

  return createServerClient(config.url, config.publishableKey, {
    cookies: createSupabaseCookieMethods(cookieStore),
    cookieOptions: AUTH_COOKIE_OPTIONS,
  });
}

/**
 * Creates one request-scoped client. WP2 uses it in route handlers, where token
 * refreshes can be written to the response. Server Components must not become
 * an alternate session boundary before the frontend package defines one.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createSupabaseClientForCookies({
    getAll: () => cookieStore.getAll(),
    set: (name, value, options) => {
      try {
        type NextCookieOptions = NonNullable<
          Parameters<typeof cookieStore.set>[2]
        >;
        const sameSite =
          options?.sameSite === true
            ? "strict"
            : options?.sameSite === false
              ? undefined
              : options?.sameSite;

        cookieStore.set(name, value, {
          ...options,
          ...(sameSite === undefined ? {} : { sameSite }),
        } as NextCookieOptions);
      } catch {
        // Server Components cannot write cookies. The proxy owns refreshes.
      }
    },
  });
}
