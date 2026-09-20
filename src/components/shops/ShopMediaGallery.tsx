"use client";
/* eslint-disable @next/next/no-img-element -- Publication-checked same-origin delivery; no persistent image proxy or optimiser cache. */

import { useState } from "react";

import { useShopMedia } from "@/src/components/shops/ShopMediaProvider";
import { ShopPhotoViewer } from "@/src/components/shops/ShopPhotoViewer";
import { Icon } from "@/src/components/ui/Icon";
import type { ShopMedia } from "@/src/features/admin/media-contract";

import styles from "./ShopMedia.module.css";

/** Cover plus two previews. Everything beyond that is behind *View all*. */
const PREVIEW_COUNT = 3;

function PhotoTile({
  photo,
  src,
  index,
  total,
  onOpen,
  children,
}: {
  readonly photo: ShopMedia;
  readonly src: string;
  readonly index: number;
  readonly total: number;
  readonly onOpen: (index: number) => void;
  readonly children?: React.ReactNode;
}) {
  const [broken, setBroken] = useState(false);

  return (
    <button
      type="button"
      className={styles.tile}
      onClick={() => onOpen(index)}
      aria-label={`Open photo ${index + 1} of ${total}: ${photo.altText}`}
    >
      {broken ? (
        <span className={styles.tileBroken}>
          <Icon name="alert" size={18} />
          <span>Photo unavailable</span>
        </span>
      ) : (
        <img
          className={styles.tileImage}
          src={src}
          alt=""
          width={photo.width}
          height={photo.height}
          loading={index === 0 ? undefined : "lazy"}
          onError={() => setBroken(true)}
        />
      )}
      {children}
    </button>
  );
}

/**
 * The shop's photographs, as a contained preview.
 *
 * Issue #82: the page used to render every published entry as a full-width
 * figure, one after another, so a shop with eight photographs was a stack of
 * eight pictures rather than a gallery. This is one cover and two previews in a
 * fixed composition, with the rest reachable through a count taken from the
 * actual list — never a number typed into the design.
 *
 * Photographs only. The business's logo is identity and is drawn in the header
 * by `ShopLogoMark`, so a shop with one photo and a logo has one photo here.
 *
 * Server order is the founder's chosen arrangement, so the first published photo
 * is the cover and nothing is re-sorted. Proportions are kept intact: every
 * preview is `object-fit: contain` on the page's own warm surface rather than a
 * crop this component invented.
 */
export function ShopMediaGallery({ shopName }: { readonly shopName: string }) {
  const { status, photos, srcFor, retry } = useShopMedia();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (status === "unavailable") {
    return null;
  }

  if (status === "failed") {
    return (
      <p className={styles.galleryStatus} data-testid="shop-gallery-failed">
        <Icon name="alert" size={18} />
        <span>Shop photos could not load.</span>
        <button type="button" className={styles.retry} onClick={retry}>
          Retry images
        </button>
      </p>
    );
  }

  if (status === "loading") {
    return (
      <p className={styles.galleryStatus} aria-busy="true" data-testid="shop-gallery-loading">
        <Icon name="camera" size={18} />
        <span>Loading photos…</span>
      </p>
    );
  }

  /* No photographs: no gallery, no placeholder slots, and no count of nothing. */
  if (photos.length === 0) {
    return null;
  }

  const cover = photos[0]!;
  const previews = photos.slice(1, PREVIEW_COUNT);
  const hidden = photos.length - PREVIEW_COUNT;

  return (
    <section className={styles.gallery} aria-label={`Photos of ${shopName}`}>
      <ul className={styles.grid} data-count={Math.min(photos.length, PREVIEW_COUNT)}>
        <li className={styles.coverCell}>
          <PhotoTile
            photo={cover}
            src={srcFor(cover.id)}
            index={0}
            total={photos.length}
            onOpen={setViewerIndex}
          >
            {photos.length > 1 ? (
              <span className={styles.counter} aria-hidden="true">
                <Icon name="camera" size={14} />
                1 / {photos.length}
              </span>
            ) : null}
          </PhotoTile>
        </li>

        {previews.map((photo, offset) => (
          <li className={styles.previewCell} key={photo.id}>
            <PhotoTile
              photo={photo}
              src={srcFor(photo.id)}
              index={offset + 1}
              total={photos.length}
              onOpen={setViewerIndex}
            />
          </li>
        ))}
      </ul>

      {/*
        One overflow control, and only when something is actually behind it. With
        three or fewer photographs everything published is already on screen and
        any of them opens the viewer.
      */}
      {hidden > 0 ? (
        <button
          type="button"
          className={styles.viewAll}
          onClick={() => setViewerIndex(PREVIEW_COUNT)}
        >
          <Icon name="camera" size={16} />
          View all {photos.length} photos
        </button>
      ) : null}

      {(cover.caption ?? cover.creditText) ? (
        <p className={styles.coverCaption}>
          {cover.caption ? <span>{cover.caption}</span> : null}
          {cover.creditText ? (
            <span className={styles.coverCredit}>{cover.creditText}</span>
          ) : null}
        </p>
      ) : null}

      {viewerIndex !== null ? (
        <ShopPhotoViewer
          photos={photos}
          index={viewerIndex}
          shopName={shopName}
          srcFor={srcFor}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </section>
  );
}
