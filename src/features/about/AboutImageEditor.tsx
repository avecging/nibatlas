"use client";
import { useEffect, useState } from "react";
import { Node, type Editor } from "@tiptap/react";
import { aboutImageUrl, type RichNode } from "./content";
import { prepareShopImage } from "@/src/features/admin/prepare-shop-image";
import { readAdminResponse } from "@/src/features/admin/read-response";
import styles from "./AboutAdmin.module.css";

export const AboutImageNode = Node.create({
  name: "aboutImage",
  group: "block",
  atom: true,
  draggable: false,
  addAttributes() {
    return {
      imageId: { default: "" },
      alt: { default: "" },
      caption: { default: "" },
      width: { default: 1 },
      height: { default: 1 },
    };
  },
  // Only the upload control inserts images; pasted HTML cannot introduce external images.
  parseHTML() {
    return [];
  },
  renderHTML({ node }) {
    return [
      "figure",
      { "data-about-image": node.attrs.imageId, contenteditable: "false" },
      [
        "img",
        {
          src: aboutImageUrl(node.attrs.imageId, true),
          alt: node.attrs.alt,
          width: node.attrs.width,
          height: node.attrs.height,
        },
      ],
      [
        "figcaption",
        {},
        node.attrs.caption ||
          "Select this image, then click Image to edit or replace it.",
      ],
    ];
  },
});

export function AboutImageEditor({
  editor,
  close,
  onBusyChange,
}: {
  editor: Editor;
  close: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [selected] = useState(() => editor.isActive("aboutImage"));
  const [initial] = useState(() =>
    selected ? editor.getAttributes("aboutImage") : {},
  );
  const [alt, setAlt] = useState(String(initial.alt ?? ""));
  const [caption, setCaption] = useState(String(initial.caption ?? ""));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  // Keep insertion/replacement anchored even after the file chooser takes focus.
  const [position] = useState(() => {
    const selection = editor.state.selection;
    // Body images are top-level blocks: insert after the current paragraph/list.
    return selected || selection.$from.depth === 0
      ? selection.from
      : selection.$from.after(1);
  });
  useEffect(() => () => onBusyChange(false), [onBusyChange]);
  async function apply() {
    if (!alt.trim()) {
      setError("Describe the image for people who cannot see it.");
      return;
    }
    if (!selected && !file) {
      setError("Choose an image first.");
      return;
    }
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      let attrs: NonNullable<RichNode["attrs"]> = { ...initial, alt, caption };
      if (file) {
        const prepared = await prepareShopImage(file, true);
        const response = await fetch("/api/v1/admin/about/images", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": prepared.contentType },
          body: prepared.bytes,
        });
        const value = await readAdminResponse(response, true);
        if (!response.ok)
          throw Error(
            response.status === 401 || response.status === 403
              ? "Your admin access changed. Sign in again before uploading."
              : response.status === 429
                ? "The image upload limit has been reached."
                : "This image could not be saved. Try a smaller PNG or JPEG, then retry.",
          );
        if (
          typeof value.id !== "string" ||
          !/^[0-9a-f-]{36}$/i.test(value.id) ||
          !Number.isInteger(value.width) ||
          !Number.isInteger(value.height)
        )
          throw Error("Could not confirm the upload. Try again.");
        attrs = {
          imageId: value.id,
          width: value.width,
          height: value.height,
          alt,
          caption,
        };
      }
      if (editor.isDestroyed) return;
      const node: RichNode = { type: "aboutImage", attrs };
      if (selected)
        editor
          .chain()
          .focus()
          .setNodeSelection(position)
          .updateAttributes("aboutImage", attrs)
          .run();
      else
        editor
          .chain()
          .focus()
          .insertContentAt(position, [node, { type: "paragraph" }])
          .run();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the image.");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <div className={styles.linkEdit}>
      <p>{selected ? "Edit or replace image" : "Insert image"}</p>
      <label>
        {selected ? "Replacement image (optional)" : "Image file"}
        <input
          type="file"
          accept="image/png,image/jpeg,.png,.jpg,.jpeg"
          disabled={busy}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError("");
          }}
        />
      </label>
      <p className={styles.help}>
        PNG or JPEG, up to 5 MiB. Images are resized for the page and remain
        private until Publish.
      </p>
      <label>
        Image description (alt text)
        <input
          maxLength={500}
          value={alt}
          disabled={busy}
          onChange={(e) => setAlt(e.target.value)}
        />
      </label>
      <label>
        Caption (optional)
        <input
          maxLength={1000}
          value={caption}
          disabled={busy}
          onChange={(e) => setCaption(e.target.value)}
        />
      </label>
      <div className={styles.actions}>
        <button type="button" disabled={busy} onClick={() => void apply()}>
          {busy
            ? "Uploading image…"
            : selected
              ? "Apply image changes"
              : "Insert image"}
        </button>
        {selected && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              editor
                .chain()
                .focus()
                .setNodeSelection(position)
                .deleteSelection()
                .run();
              close();
            }}
          >
            Remove image
          </button>
        )}
        <button type="button" disabled={busy} onClick={close}>
          Cancel
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
