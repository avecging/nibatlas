"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AtlasErrorPage } from "./AtlasErrorPage";

/** Presentation only. The admin APIs keep their own trusted per-request role checks. */
export function AdminAccessFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const [access, setAccess] = useState<"admin" | "editor" | "denied" | "unknown">("unknown");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/v1/admin/access", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    }).then(async (response) => {
      if (controller.signal.aborted) return;
      if (response.status === 403) return setAccess("denied");
      if (response.ok) {
        const value: unknown = await response.json();
        const role = value && typeof value === "object" && "role" in value ? value.role : null;
        if (!controller.signal.aborted && (role === "admin" || role === "editor")) setAccess(role);
      }
    }).catch(() => {
      // The existing admin views handle sign-in and service errors themselves.
    });
    return () => controller.abort();
  }, []);

  // The About editor and bulk importer are admin-only; other admin screens
  // allow editors. The API remains the final authority for every operation.
  const adminOnly = pathname === "/admin/about" || pathname.startsWith("/admin/shops/import");
  return access === "denied" || (adminOnly && access === "editor")
    ? <AtlasErrorPage kind="access-denied" /> : children;
}
