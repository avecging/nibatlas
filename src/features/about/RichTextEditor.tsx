"use client";
import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { aboutUrl, richDocument, type RichNode } from "./content";
import styles from "./AboutAdmin.module.css";

export function RichTextEditor({
  initial,
  onChange,
  disabled,
}: {
  initial: RichNode;
  disabled: boolean;
  onChange: (value: RichNode) => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        italic: false,
        strike: false,
        underline: false,
        hardBreak: { keepMarks: false },
        trailingNode: false,
        link: {
          openOnClick: false,
          autolink: false,
          linkOnPaste: false,
          protocols: ["http", "https"],
        },
      }),
    ],
    content: initial,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Main body",
        "aria-multiline": "true",
        class: styles.richText ?? "",
      },
    },
    onUpdate: ({ editor }) => {
      // Keep the current edit, even if it exceeds a limit. Save/preview report the error.
      onChange(editor.getJSON() as RichNode);
    },
  });
  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);
  if (!editor) return <p role="status">Loading text editor…</p>;
  const button = (label: string, action: () => void, active = false) => (
    <button type="button" key={label} aria-pressed={active} onClick={action}>
      {label}
    </button>
  );
  return (
    <div className={styles.editor}>
      <div className={styles.toolbar} role="group" aria-label="Text formatting">
        {button(
          "Paragraph",
          () => editor.chain().focus().setParagraph().run(),
          editor.isActive("paragraph"),
        )}
        {button(
          "Heading",
          () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          editor.isActive("heading", { level: 2 }),
        )}
        {button(
          "Subheading",
          () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          editor.isActive("heading", { level: 3 }),
        )}
        {button(
          "Bold",
          () => editor.chain().focus().toggleBold().run(),
          editor.isActive("bold"),
        )}
        {button(
          "Bullet list",
          () => editor.chain().focus().toggleBulletList().run(),
          editor.isActive("bulletList"),
        )}
        {button(
          "Numbered list",
          () => editor.chain().focus().toggleOrderedList().run(),
          editor.isActive("orderedList"),
        )}
        {button(
          "Link",
          () => {
            setUrl(editor.getAttributes("link").href ?? "");
            setLinkOpen((v) => !v);
            setError("");
          },
          editor.isActive("link"),
        )}
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          Undo
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          Redo
        </button>
      </div>
      {linkOpen && (
        <div className={styles.linkEdit}>
          <label>
            Link destination
            <input
              autoFocus
              value={url}
              placeholder="https://… or /privacy"
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => {
                try {
                  const href = aboutUrl(url);
                  if (!href) throw Error("Enter a link destination.");
                  editor
                    .chain()
                    .focus()
                    .extendMarkRange("link")
                    .setLink({ href })
                    .run();
                  richDocument(editor.getJSON());
                  setLinkOpen(false);
                  setError("");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Check the link.");
                }
              }}
            >
              Apply link
            </button>
            <button
              type="button"
              onClick={() => {
                editor
                  .chain()
                  .focus()
                  .extendMarkRange("link")
                  .unsetLink()
                  .run();
                setLinkOpen(false);
              }}
            >
              Remove link
            </button>
            <button
              type="button"
              onClick={() => {
                setLinkOpen(false);
                editor.commands.focus();
              }}
            >
              Cancel
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
