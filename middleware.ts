import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { authorizeAdmin } from "@/src/server/admin/http";
import { createAdminGateway } from "@/src/server/admin/route-context";
import { createSupabaseClientForCookies } from "@/src/server/supabase/server-client";

export const config = { matcher: "/admin/:path*" };

export async function middleware(request: NextRequest) {
  const updates: { name: string; value: string; options?: CookieOptions }[] = [];
  const finish = (response: NextResponse) => {
    for (const { name, value, options } of updates) {
      if (options) response.cookies.set(name, value, options);
      else response.cookies.set(name, value);
    }
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
  try {
    const client = createSupabaseClientForCookies({
      getAll: () => request.cookies.getAll(),
      set(name, value, options) {
        // The next handler sees the refreshed token in this same request.
        request.cookies.set(name, value);
        updates.push({ name, value, ...(options ? { options } : {}) });
      },
    });
    const path = request.nextUrl.pathname;
    const adminOnly = path === "/admin/about" || path.startsWith("/admin/about/") ||
      path === "/admin/shops/import" || path.startsWith("/admin/shops/import/");
    const access = await authorizeAdmin(await createAdminGateway(client), adminOnly ? "admin" : "editor");
    const response = access instanceof Response
      ? NextResponse.redirect(new URL("/me", request.url))
      : NextResponse.next({ request });
    return finish(response);
  } catch {
    return finish(NextResponse.json({ error: "service_unavailable" }, { status: 503 }));
  }
}
