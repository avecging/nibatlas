import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewport } from "@/src/domain/geo";
import { useNearMe, nearbyViewport } from "@/src/features/map/use-near-me";
import { NearMe } from "./NearMe";

let succeed: PositionCallback;
let fail: PositionErrorCallback;
const getCurrentPosition = vi.fn((success: PositionCallback, error: PositionErrorCallback) => {
  succeed = success; fail = error;
});

function Harness({ onLocated }: { onLocated: (viewport: Viewport) => void }) {
  const location = useNearMe(onLocated);
  return <><NearMe location={location} /><button onClick={location.cancel}>Move map</button></>;
}

beforeEach(() => {
  getCurrentPosition.mockClear();
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
});
afterEach(() => vi.unstubAllGlobals());

function open() {
  const onLocated = vi.fn();
  const view = render(<Harness onLocated={onLocated} />);
  fireEvent.click(screen.getByRole("button", { name: "Near me" }));
  return { onLocated, ...view };
}

function request() { fireEvent.click(screen.getByRole("button", { name: "Use my location" })); }

describe("Near me", () => {
  it("explains first and only requests a one-time position after confirmation", async () => {
    const { onLocated } = open();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(screen.getByText(/exact position isn’t saved/)).toBeVisible();
    request();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Finding you…" })).toBeDisabled();
    await act(async () => succeed({ coords: { latitude: 1.2934567, longitude: 103.856789, accuracy: 10 } } as GeolocationPosition));
    expect(onLocated).toHaveBeenCalledTimes(1);
    const viewport = onLocated.mock.calls[0]![0] as Viewport;
    expect((viewport.bounds.south + viewport.bounds.north) / 2).toBeCloseTo(1.29);
    expect((viewport.bounds.west + viewport.bounds.east) / 2).toBeCloseTo(103.86);
    expect(JSON.stringify(viewport)).not.toMatch(/1\.2934567|103\.856789/);
  });

  it.each(["Cancel", "Move map"])("ignores late GPS results after %s", async (name) => {
    const { onLocated } = open(); request();
    fireEvent.click(screen.getByRole("button", { name }));
    await act(async () => succeed({ coords: { latitude: 1.29, longitude: 103.85, accuracy: 10 } } as GeolocationPosition));
    expect(onLocated).not.toHaveBeenCalled();
  });

  it("ignores results after unmount", async () => {
    const { onLocated, unmount } = open(); request(); unmount();
    await act(async () => succeed({ coords: { latitude: 1.29, longitude: 103.85, accuracy: 10 } } as GeolocationPosition));
    expect(onLocated).not.toHaveBeenCalled();
  });

  it.each([1, 2, 3])("allows recovery after location failure %s", async (code) => {
    const { onLocated } = open(); request();
    await act(async () => fail({ code } as GeolocationPositionError));
    expect(screen.getByRole("alert")).toHaveTextContent(/search for a place/);
    expect(onLocated).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it("handles browsers without location support", async () => {
    vi.stubGlobal("navigator", {});
    open(); request();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/couldn’t find/));
  });

  it("rejects invalid coordinates and keeps polar/date-line bounds usable", () => {
    expect(nearbyViewport({ latitude: NaN, longitude: 1 })).toBeNull();
    expect(nearbyViewport({ latitude: 1, longitude: 181 })).toBeNull();
    const polar = nearbyViewport({ latitude: 90, longitude: 180 })!;
    expect(polar.bounds.north).toBeLessThan(85.051129);
    expect(polar.bounds.east).toBeGreaterThan(polar.bounds.west);
  });
});
