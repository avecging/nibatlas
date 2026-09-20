"use client";
import { useEffect, useRef } from "react";
import type { RefObject } from "react";

const FOCUSABLE =
  'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal behaviour for the confirmation dialogs.
 *
 * `aria-modal="true"` tells assistive technology that the rest of the page is
 * not there, so Tab must not walk out of the dialog into the app's own
 * navigation, and Escape must close it. When the dialog goes away focus returns
 * to whatever opened it; if that control is gone — a delete removed the image
 * its button belonged to — focus goes to `fallback` rather than to the top of
 * the document.
 *
 * The handlers are held in refs so a caller passing an inline arrow function
 * does not re-run the effect on every render, which would restore focus while
 * the dialog is still open.
 */
export function useDialog(
  container: RefObject<HTMLElement | null>,
  onClose: () => void,
  fallback?: RefObject<HTMLElement | null>,
) {
  const close = useRef(onClose);
  const exit = useRef(fallback);
  useEffect(() => {
    close.current = onClose;
    exit.current = fallback;
  });

  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
        return;
      }
      if (event.key !== "Tab") return;
      const box = container.current;
      if (!box) return;
      const focusable = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (!box.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      const target =
        previous && previous.isConnected ? previous : (exit.current?.current ?? null);
      target?.focus();
    };
  }, [container]);
}
