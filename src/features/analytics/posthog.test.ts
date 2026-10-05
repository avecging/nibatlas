import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

describe("anonymous beta analytics", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
    window.history.replaceState(null, "", "/shops/test?auth=success&latitude=1.234567");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    document.querySelector('script[src*="posthog.com"]')?.remove();
    delete window.posthog;
  });
  it("sends only path pageviews and coarse failure reasons", async () => {
    const { initAnalytics, trackPage, captureProductEvent } = await import("./posthog");
    initAnalytics();
    trackPage("/shops/test");
    captureProductEvent("check_in_failed", "too_far_away");
    const calls = window.posthog ?? [];
    expect(calls).toContainEqual(["capture", "$pageview", {
      $current_url: window.location.origin + "/shops/test",
    }]);
    expect(calls).toContainEqual(["capture", "check_in_failed", { reason: "too_far_away" }]);
    const config = (window.posthog?._i?.[0] as [string, {
      before_send: (event: { properties: Record<string, unknown> }) => unknown;
      session_recording: Record<string, unknown>;
    }])[1];
    expect(config.before_send({ properties: { $current_url: window.location.href } }))
      .toEqual({ properties: { $current_url: window.location.origin + "/shops/test" } });
    expect(config.session_recording).toMatchObject({ maskAllInputs: true, maskTextSelector: "*" });
  });
});
