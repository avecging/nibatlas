"use client";
/* eslint-disable @next/next/no-img-element -- Publication-checked same-origin delivery; no persistent image proxy or optimiser cache. */

import { useEffect, useRef, useState } from "react";

import { useDialogFocus } from "@/src/components/hooks/useDialogFocus";
import { Icon } from "@/src/components/ui/Icon";
import type { ShopMedia } from "@/src/features/admin/media-contract";
import styles from "./ShopMedia.module.css";

/** A deliberate swipe rather than a tap that drifted, in CSS pixels. */
const SWIPE_THRESHOLD = 48;

/**
 * The enlarged photo, as a modal viewer.
 *
 * Issue #82 asks for a contained preview that opens into something you can
 * browse. This is that second half: one photograph at a time, fitted whole
 * rather than cropped to the window, with the position in the set stated rather
 * than implied.
 *
 * It reuses `useDialogFocus`, so Escape closes it, Tab stays inside it, and
 * focus returns to the thumbnail that opened it — the same contract the collect
 * preflight and the ceremony already keep.
 *
 * Only three images are ever in the document: the one being read and its two
 * neighbours. A shop at the media limit does not download fifty full-size
 * photographs because someone opened the first one.
 */
export function ShopPhotoViewer({
  photos,
  index,
  shopName,
  srcFor,
  onIndexChange,
  onClose,
}: {
  readonly photos: readonly ShopMedia[];
  readonly index: number;
  readonly shopName: string;
  readonly srcFor: (mediaId: string) => string;
  readonly onIndexChange: (index: number) => void;
  readonly onClose: () => void;
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>(true, onClose);
  const [broken, setBroken] = useState<readonly string[]>([]);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const current = photos[index];
  const hasPrevious = index > 0;
  const hasNext = index < photos.length - 1;

  /*
   * Arrow keys move through the set. Escape is the dialog hook's, so it is not
   * handled twice, and a modifier combination is left to the browser.
   */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      if (event.key === "ArrowLeft" && index > 0) {
        event.preventDefault();
        onIndexChange(index - 1);
      }

      if (event.key === "ArrowRight" && index < photos.length - 1) {
        event.preventDefault();
        onIndexChange(index + 1);
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [index, onIndexChange, photos.length]);

  /* The page behind a modal must not scroll under it. */
  useEffect(() => {
    const previous = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!current) {
    return null;
  }

  const position = `${index + 1} of ${photos.length}`;

  /* The photograph being read and its two neighbours, and nothing else. */
  const window = [index - 1, index, index + 1]
    .filter((at) => at >= 0 && at < photos.length)
    .map((at) => ({ photo: photos[at]!, isCurrent: at === index }));

  return (
    <div className={styles.viewerBackdrop}>
      <div
        ref={dialogRef}
        className={styles.viewer}
        role="dialog"
        aria-modal="true"
        aria-label={`Photos of ${shopName}`}
        tabIndex={-1}
      >
        <div className={styles.viewerBar}>
          <p className={styles.viewerPosition} aria-live="polite">
            Photo {position}
          </p>
          <button
            type="button"
            className={styles.viewerControl}
            onClick={onClose}
            aria-label="Close photos"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div
          className={styles.viewerStage}
          onTouchStart={(event) => {
            const touch = event.touches[0];

            touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
          }}
          onTouchEnd={(event) => {
            const start = touchStart.current;
            const end = event.changedTouches[0];

            touchStart.current = null;

            if (!start || !end) {
              return;
            }

            const travelled = end.clientX - start.x;

            // A mostly-vertical drag is not a swipe through the set.
            if (Math.abs(travelled) <= Math.abs(end.clientY - start.y)) {
              return;
            }

            if (travelled <= -SWIPE_THRESHOLD && hasNext) {
              onIndexChange(index + 1);
            }

            if (travelled >= SWIPE_THRESHOLD && hasPrevious) {
              onIndexChange(index - 1);
            }
          }}
        >
          {/*
            One element per photograph in the window, keyed by the photograph.
            Moving to the next photograph shows the element that already
            fetched it rather than creating a new one: the public media route
            is `no-store`, so a fresh element would re-request the image and
            re-run its publication check. Only the current one is shown, and
            only the current one is in the accessibility tree.
          */}
          {window.map(({ photo, isCurrent }) => {
            const readable = isCurrent && !broken.includes(photo.id);

            return (
              <img
                key={photo.id}
                className={readable ? styles.viewerImage : styles.viewerPreload}
                src={srcFor(photo.id)}
                alt={readable ? photo.altText : ""}
                aria-hidden={readable ? undefined : "true"}
                width={photo.width}
                height={photo.height}
                onError={() =>
                  setBroken((ids) => (ids.includes(photo.id) ? ids : [...ids, photo.id]))
                }
              />
            );
          })}

          {broken.includes(current.id) ? (
            <p className={styles.viewerBroken}>
              <Icon name="alert" size={18} />
              <span>This photo could not be loaded.</span>
            </p>
          ) : null}
        </div>

        {current.caption || current.creditText ? (
          <div className={styles.viewerCaption}>
            {current.caption ? <p>{current.caption}</p> : null}
            {current.creditText ? (
              <p className={styles.viewerCredit}>{current.creditText}</p>
            ) : null}
          </div>
        ) : null}

        {photos.length > 1 ? (
          <div className={styles.viewerNavigation}>
            {/*
              `aria-disabled` rather than `disabled` at the ends of the set: a
              control that disables itself under the finger that just pressed it
              drops focus to the document, and a keyboard reader loses its place
              in the middle of browsing.
            */}
            <button
              type="button"
              className={styles.viewerControl}
              onClick={() => hasPrevious && onIndexChange(index - 1)}
              aria-disabled={hasPrevious ? undefined : "true"}
              aria-label="Previous photo"
            >
              <Icon name="chevron-left" size={20} />
            </button>
            <button
              type="button"
              className={styles.viewerControl}
              onClick={() => hasNext && onIndexChange(index + 1)}
              aria-disabled={hasNext ? undefined : "true"}
              aria-label="Next photo"
            >
              <Icon name="chevron-right" size={20} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
