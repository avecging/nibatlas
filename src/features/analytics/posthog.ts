"use client";

export type ProductEvent = "map_opened" | "near_me_clicked" | "shop_opened"
  | "check_in_started" | "check_in_succeeded" | "check_in_failed"
  | "passport_opened" | "login_started" | "login_succeeded";
export type FailureReason = "permission_denied" | "location_unavailable" | "too_far_away" | "unknown";

type Client = Array<[string, ...unknown[]]> & {
  _i?: unknown[];
  __SV?: number;
  init?: (token: string, config: Record<string, unknown>) => void;
  capture?: (name: string, properties?: Record<string, string>) => void;
  startSessionRecording?: () => void;
  stopSessionRecording?: () => void;
};
declare global { interface Window { posthog?: Client } }

const TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;
let active = false;
const allowed = (path: string) => !/^\/(?:admin|auth|api)(?:\/|$)/.test(path);
const safeUrl = () => window.location.origin + window.location.pathname;
function stripUrl(value: string): string {
  try {
    const url = new URL(value, window.location.origin);
    return url.origin + url.pathname;
  } catch { return ""; }
}

export function captureProductEvent(event: ProductEvent, reason?: FailureReason) {
  if (!active) initAnalytics();
  if (!active || !allowed(window.location.pathname)) return;
  try {
    window.posthog?.capture?.(event, event === "check_in_failed" ? { reason: reason ?? "unknown" } : undefined);
  } catch { /* Analytics never blocks actions. */ }
}

export function trackPage(path: string) {
  if (!active) return;
  try {
    if (!allowed(path)) { window.posthog?.stopSessionRecording?.(); return; }
    window.posthog?.startSessionRecording?.();
    window.posthog?.capture?.("$pageview", { $current_url: safeUrl() });
  } catch { /* Navigation continues. */ }
}

export function initAnalytics() {
  if (active || !TOKEN || !HOST || typeof window === "undefined" || !allowed(window.location.pathname)) return;
  if (!/^https:\/\/(?:us|eu)\.i\.posthog\.com$/.test(HOST)) return;
  try {
    // PostHog's browser snippet queue; the SDK replaces it when array.js loads.
    const stub = [] as unknown as Client;
    stub._i = [];
    stub.__SV = 1;
    stub.init = (token, config) => { stub._i?.push([token, config, "posthog"]); };
    stub.capture = (...args) => { stub.push(["capture", ...args]); };
    stub.startSessionRecording = () => { stub.push(["startSessionRecording"]); };
    stub.stopSessionRecording = () => { stub.push(["stopSessionRecording"]); };
    window.posthog = stub;
    stub.init(TOKEN, {
      api_host: HOST,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_capture_url_hashes: true,
      disable_surveys: true,
      advanced_disable_feature_flags: true,
      person_profiles: "never",
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "*",
        blockSelector: "[data-ph-no-capture]",
        maskAttributeFn: (name: string, value: string) => {
          if (/^(?:href|src|action|formaction|poster)$/i.test(name)) return stripUrl(value);
          if (/^(?:value|placeholder|title|aria-label|data-)/i.test(name)) return "[masked]";
          return value;
        },
        maskCapturedNetworkRequestFn: (request: { name: string }) => ({ ...request, name: stripUrl(request.name) }),
        recordBody: false,
        recordHeaders: false,
        recordCanvas: false,
        recordCrossOriginIframes: false,
      },
      before_send: (event: { properties?: Record<string, unknown> }) => {
        if (!event?.properties) return event;
        for (const key of Object.keys(event.properties)) {
          if (!/(?:url|href|referr)/i.test(key)) continue;
          if (typeof event.properties[key] !== "string") continue;
          try {
            event.properties[key] = stripUrl(event.properties[key] as string);
          } catch { delete event.properties[key]; }
        }
        return event;
      },
    });
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = HOST.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js";
    script.onerror = () => { active = false; delete window.posthog; };
    document.head.appendChild(script);
    active = true;
  } catch { active = false; delete window.posthog; }
}
