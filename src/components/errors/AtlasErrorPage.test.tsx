import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { AtlasErrorPage } from "./AtlasErrorPage";

const navigation = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));
const route = vi.hoisted(() => ({ pathname: "/admin/shops" }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation, usePathname: () => route.pathname }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
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


it.each(["not-found", "access-denied"] as const)("returns a %s visitor to their previous public page", kind => {
  window.sessionStorage.setItem("nibatlas:last-public-page", "/shops/think");
  render(<AtlasErrorPage kind={kind} />);
  fireEvent.click(screen.getByRole("button", { name: "← Go back" }));
  expect(navigation.push).toHaveBeenCalledWith("/shops/think");
});

it.each(["/admin/seals", "/access-denied", "//evil.example", "https://evil.example", "/missing"])("falls back to the map for unsafe history %s", previous => {
  window.sessionStorage.setItem("nibatlas:last-public-page", previous);
  window.history.replaceState(null, "", "/missing");
  render(<AtlasErrorPage kind="not-found" />);
  fireEvent.click(screen.getByRole("button", { name: "← Go back" }));
  expect(navigation.push).toHaveBeenCalledWith("/");
});
