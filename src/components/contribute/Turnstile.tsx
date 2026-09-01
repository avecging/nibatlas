"use client";

import { useEffect, useRef, useState } from "react";

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
export function Turnstile({
  siteKey,
  onToken,
}: {
  readonly siteKey: string | undefined;
  readonly onToken: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onTokenRef = useRef(onToken);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useEffect(() => {
    if (!siteKey) {
      return;
    }

    const container = containerRef.current;

    if (!container) {
      return;
    }

    let widgetId: string | undefined;
    let cancelled = false;

    function renderWidget() {
      if (cancelled || !container || !window.turnstile || !siteKey) {
        return;
      }

      widgetId = window.turnstile.render(container, {
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

      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
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
}
