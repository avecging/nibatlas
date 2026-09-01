"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import styles from "./ContributeForm.module.css";

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      theme?: string;
      appearance?: string;
    },
  ): string;
  remove(widgetId: string): void;
  reset(widgetId: string): void;
}

/** What a caller can ask the widget to do once it exists. */
export interface TurnstileHandle {
  /**
   * Discards the current token and re-runs the challenge for a fresh one.
   *
   * Needed after a submission whose token was already consumed — verified by
   * Turnstile but not delivered to the intake — since a Turnstile token is
   * single-use and resending it is rejected as a duplicate even once the
   * intake has recovered.
   */
  reset(): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * The spam control, rendered explicitly.
 *
 * Explicit rather than automatic rendering because the widget has to be created
 * and destroyed with the component: a form that unmounts on success would
 * otherwise leave an orphaned widget behind.
 *
 * **When no site key is configured this renders nothing and hands back an empty
 * token.** That is the local and end-to-end case, and it is safe because the
 * decision is not made here — `POST /api/contribute` refuses to accept anything
 * in production without a verified token, so an unconfigured deployment fails
 * closed rather than quietly accepting unverified submissions.
 */
export const Turnstile = forwardRef<
  TurnstileHandle,
  {
    readonly siteKey: string | undefined;
    readonly onToken: (token: string) => void;
  }
>(function Turnstile({ siteKey, onToken }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onTokenRef = useRef(onToken);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    },
  }));

  useEffect(() => {
    if (!siteKey) {
      return;
    }

    const container = containerRef.current;

    if (!container) {
      return;
    }

    let cancelled = false;

    function renderWidget() {
      if (cancelled || !container || !window.turnstile || !siteKey) {
        return;
      }

      widgetIdRef.current = window.turnstile.render(container, {
        sitekey: siteKey,
        callback: (token) => {
          setFailed(false);
          onTokenRef.current(token);
        },
        // An expired token is no token. Clearing it makes the next submit fail
        // honestly rather than sending something the verifier will reject.
        "expired-callback": () => onTokenRef.current(""),
        "error-callback": () => {
          setFailed(true);
          onTokenRef.current("");
        },
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      const existing = document.querySelector<HTMLScriptElement>(
        `script[src="${SCRIPT_SRC}"]`,
      );
      const script = existing ?? document.createElement("script");

      script.addEventListener("load", renderWidget);
      script.addEventListener("error", () => setFailed(true));

      if (!existing) {
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;

      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }

      widgetIdRef.current = undefined;
    };
  }, [siteKey]);

  if (!siteKey) {
    return null;
  }

  return (
    <div className={styles.challenge}>
      <div ref={containerRef} />
      {failed ? (
        <p className={styles.hint}>
          The spam check could not load. Sending will not work until it does —
          reloading the page usually fixes it.
        </p>
      ) : null}
    </div>
  );
});
