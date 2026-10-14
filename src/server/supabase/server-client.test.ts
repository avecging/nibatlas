import { describe, expect, it, vi } from "vitest";

import { createSupabaseCookieMethods } from "@/src/server/supabase/server-client";

describe("the server Supabase cookie adapter", () => {
  it("passes request cookies in and hardens every refreshed cookie written out", () => {
    const set = vi.fn();
    const methods = createSupabaseCookieMethods({
      getAll: () => [{ name: "sb-session", value: "old" }],
      set,
    });

    expect(methods.getAll()).toEqual([{ name: "sb-session", value: "old" }]);
    methods.setAll?.(
      [
        {
          name: "sb-session",
          value: "refreshed",
          options: { maxAge: 3_600, sameSite: "none", path: "/wrong" },
        },
      ],
      { "Cache-Control": "private, no-store" },
    );

    expect(set).toHaveBeenCalledWith(
      "sb-session",
      "refreshed",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 3_600,
      }),
    );
  });
});
