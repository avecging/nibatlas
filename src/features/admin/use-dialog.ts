"use client";
import { useEffect, useRef, useState } from "react";
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
 * the dialog is still open. `container` must likewise be a stable ref object.
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

  // Captured on the dialog's first render, which still happens inside the click
  // that opened it. An effect would be too late: React applies the confirm
  // button's `autoFocus` while committing, so by then the "previously focused"
  // element is the dialog's own button and the trigger is lost.
  const [trigger] = useState(() =>
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );

  useEffect(() => {
    const box = container.current;
    const previous = trigger;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
        return;
      }
      if (event.key !== "Tab" || !box) return;
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
      // The trigger can be gone: deleting an image removes the button that
      // opened the dialog. Then focus goes to the caller's fallback rather than
      // to the top of the document.
      const restorable =
        previous &&
        previous.isConnected &&
        !box?.contains(previous) &&
        previous !== document.body;
      (restorable ? previous : (exit.current?.current ?? null))?.focus();
    };
  }, [container, trigger]);
}
