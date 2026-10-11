import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { AdminAccessFrame } from "./AdminAccessFrame";
import { AtlasErrorPage } from "./AtlasErrorPage";

const navigation = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));
const route = vi.hoisted(() => ({ pathname: "/admin/shops" }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation, usePathname: () => route.pathname }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  navigation.back.mockReset();
  navigation.push.mockReset();
  route.pathname = "/admin/shops";
});

it.each([
  ["not-found", "1.29135° N", "103.84999° E", "The trail ends here."],
  ["access-denied", "35.7118° N", "139.7828° E", "reserved for its keepers."],
] as const)("renders the %s page as live content", (kind, latitude, longitude, message) => {
  render(<AtlasErrorPage kind={kind} />);
  expect(screen.getByRole("heading", { name: "Off the map." })).toBeInTheDocument();
  expect(screen.getByText(`LAT ${latitude}`)).toBeInTheDocument();
  expect(screen.getByText(`LON ${longitude}`)).toBeInTheDocument();
  expect(screen.getByText(new RegExp(message.replace(".", "\\.")))).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "← Go back" })).toBeInTheDocument();
});

it("sends a denied visitor home instead of back into the admin route", () => {
  render(<AtlasErrorPage kind="access-denied" />);
  fireEvent.click(screen.getByRole("button", { name: "← Go back" }));
  expect(navigation.push).toHaveBeenCalledWith("/");
  expect(navigation.back).not.toHaveBeenCalled();
});

it("shows the illustrated denial only for the server's 403 response", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
  const view = render(<AdminAccessFrame>Private admin interface</AdminAccessFrame>);
  await waitFor(() => expect(screen.getByText(/reserved for its keepers/i)).toBeInTheDocument());
  expect(screen.queryByText("Private admin interface")).toBeNull();
  view.unmount();

  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ role: "editor" })));
  render(<AdminAccessFrame>Private admin interface</AdminAccessFrame>);
  await waitFor(() => expect(screen.getByText("Private admin interface")).toBeInTheDocument());
});

it.each(["/admin/about", "/admin/shops/import"])("shows the denial to editors on %s", async pathname => {
  route.pathname = pathname;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ role: "editor" })));
  render(<AdminAccessFrame>Admin-only screen</AdminAccessFrame>);
  await waitFor(() => expect(screen.getByText(/reserved for its keepers/i)).toBeInTheDocument());
  expect(screen.queryByText("Admin-only screen")).toBeNull();
});
