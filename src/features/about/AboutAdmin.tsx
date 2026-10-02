"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccountSession } from "@/src/features/account/AccountSessionProvider";
import { readAdminResponse } from "@/src/features/admin/read-response";
import {
  AboutValidationError,
  aboutContent,
  aboutState,
  type AboutContent,
  type AboutPerson,
  type AboutState,
} from "./content";
import { AboutView } from "./AboutView";
import { RichTextEditor } from "./RichTextEditor";
import base from "@/src/features/admin/ShopAdmin.module.css";
import styles from "./AboutAdmin.module.css";

async function request(
  body?: unknown,
  signal?: AbortSignal,
): Promise<AboutState> {
  const response = await fetch("/api/v1/admin/about", {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal: signal ?? null,
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await readAdminResponse(response, Boolean(body));
  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      throw new AccessError("About editing requires an admin account.");
    const messages: Record<string, string> = {
      content_changed:
        "Someone saved a newer version. Your edits are still here. Copy anything you want to keep, then load the latest saved content.",
      invalid_content:
        "Check your content before saving or publishing. Complete names and descriptions, and all visible support fields.",
      invalid_request:
        "This change could not be saved. Check the fields and try again.",
      service_unavailable:
        "We couldn’t confirm that action. Your edits are still here. Load the latest saved content to check whether it completed.",
    };
    throw new Error(messages[data.error?.code] ?? messages.service_unavailable);
  }
  return aboutState(data);
}
class AccessError extends Error {}
export function AboutAdmin() {
  const { session } = useAccountSession();
  if (session.status !== "signed-in")
    return (
      <section className={base.admin}>
        <h1 className="type-h1">About page</h1>
        <p role="status">
          {session.status === "loading"
            ? "Checking your account…"
            : "Sign in with your admin account to edit About."}
        </p>
        <Link href="/login">Sign in</Link>
      </section>
    );
  return <Workspace key={session.userId} />;
}
function Workspace() {
  const [saved, setSaved] = useState<AboutState | null>(null),
    [draft, setDraft] = useState<AboutContent | null>(null);
  const [working, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [denied, setDenied] = useState(false),
    [reload, setReload] = useState(0),
    [editorKey, setEditorKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const busy = working || uploading;
  const [preview, setPreview] = useState<AboutContent | null>(null);
  const dirty = Boolean(
    draft && saved && JSON.stringify(draft) !== JSON.stringify(saved.draft),
  );
  useEffect(() => {
    const controller = new AbortController();
    request(undefined, controller.signal)
      .then((data) => {
        setSaved(data);
        setDraft(data.draft);
        setEditorKey((v) => v + 1);
        setError("");
        setDenied(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Could not load About.");
          if (e instanceof AccessError) {
            setDenied(true);
            setDraft(null);
            setSaved(null);
            setPreview(null);
          }
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    if (!dirty && !uploading) return;
    let leaving = false;
    const warn = (event: BeforeUnloadEvent) => {
      if (!leaving) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const guard = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (
        event.target instanceof Element ? event.target.closest("a[href]") : null
      ) as HTMLAnchorElement | null;
      if (
        !link ||
        link.hasAttribute("download") ||
        (link.target && link.target !== "_self")
      )
        return;
      const target = new URL(link.href);
      if (
        target.pathname === location.pathname &&
        target.search === location.search &&
        target.origin === location.origin
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (window.confirm("Leave without saving your edits?")) {
        leaving = true;
        window.location.assign(link.href);
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guard, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guard, true);
    };
  }, [dirty, uploading]);
  const change = (next: AboutContent) => {
    setDraft(next);
    setNotice("");
  };
  async function mutate(action: "save" | "publish") {
    if (!draft || !saved) return;
    setError("");
    setNotice("");
    try {
      const document = aboutContent(draft, action === "publish");
      setBusy(true);
      const result = await request({
        action,
        revision: saved.revision,
        ...(action === "save" ? { document } : {}),
      });
      setSaved(result);
      setDraft(result.draft);
      setEditorKey((v) => v + 1);
      setNotice(
        action === "save"
          ? "Draft saved privately. The public page has not changed."
          : "About published. Visitors can now see this version.",
      );
    } catch (e) {
      setError(
        e instanceof AboutValidationError
          ? `${e.field}: ${e.message}`
          : e instanceof Error
            ? e.message
            : "Could not save About.",
      );
      if (e instanceof AccessError) {
        setDenied(true);
        setDraft(null);
        setSaved(null);
        setPreview(null);
      }
    } finally {
      setBusy(false);
    }
  }
  const setPerson = (id: string, update: Partial<AboutPerson>) => {
    if (draft)
      change({
        ...draft,
        people: draft.people.map((p) =>
          p.id === id ? { ...p, ...update } : p,
        ),
      });
  };
  const move = (id: string, direction: number) => {
    if (!draft) return;
    const people = [...draft.people],
      index = people.findIndex((p) => p.id === id),
      person = people[index];
    if (!person) return;
    const group = person.group;
    const siblings = people
        .map((p, i) => (p.group === group ? i : -1))
        .filter((i) => i >= 0),
      to = siblings[siblings.indexOf(index) + direction];
    if (to === undefined) return;
    const other = people[to];
    if (!other) return;
    people[index] = other;
    people[to] = person;
    change({ ...draft, people });
  };
  return (
    <>
      <div className={`${base.admin} ${preview ? styles.previewing : ""}`}>
        <nav aria-label="Administration">
          <Link href="/admin/shops">← Shops and administration</Link>
        </nav>
        <h1 className="type-h1">About page</h1>
        <p>
          Edit the story, people and optional support section. Only Publish
          changes the public page.
        </p>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <p role="status" aria-live="polite">
          {notice ||
            (saved
              ? dirty
                ? "Unsaved changes"
                : saved.revision === saved.publishedRevision && saved.revision
                  ? "Saved version is published."
                  : "Private draft"
              : denied
                ? "Admin access required."
                : "Loading About…")}
        </p>
        {error && !denied && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setNotice("");
              setPreview(null);
              setReload((v) => v + 1);
            }}
          >
            Load latest saved content (replaces edits)
          </button>
        )}
        {draft && saved && !denied && (
          <>
            <div className={styles.actions}>
              <button
                type="button"
                disabled={busy || (!dirty && saved.revision !== null)}
                onClick={() => void mutate("save")}
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  try {
                    setPreview(aboutContent(draft));
                    setError("");
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Check your content.",
                    );
                  }
                }}
              >
                Preview
              </button>
              <button
                className={base.primary}
                type="button"
                disabled={
                  busy ||
                  dirty ||
                  !saved.revision ||
                  saved.revision === saved.publishedRevision
                }
                onClick={() => void mutate("publish")}
              >
                Publish
              </button>
              <Link href="/about" target="_blank" rel="noopener noreferrer">
                View public page ↗
              </Link>
            </div>
            <p className={styles.help}>
              Save changes before publishing. Preview includes unsaved edits.
            </p>
            <div hidden={Boolean(preview)}>
              <fieldset disabled={busy} className={styles.fields}>
                <legend>Main content</legend>
                <label>
                  Page title
                  <input
                    maxLength={160}
                    value={draft.title}
                    onChange={(e) =>
                      change({ ...draft, title: e.target.value })
                    }
                  />
                </label>
                <label>
                  Introduction
                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={draft.introduction}
                    onChange={(e) =>
                      change({ ...draft, introduction: e.target.value })
                    }
                  />
                </label>
                <p id="body-label">
                  <strong>Main body</strong>
                </p>
                <RichTextEditor
                  key={editorKey}
                  initial={draft.body}
                  onBusyChange={setUploading}
                  disabled={busy}
                  onChange={(body) => change({ ...draft, body })}
                />
              </fieldset>
              {(["team", "thanks"] as const).map((group) => {
                const people = draft.people.filter((p) => p.group === group),
                  headingKey =
                    group === "team" ? "teamHeading" : "thanksHeading";
                return (
                  <fieldset
                    disabled={busy}
                    key={group}
                    className={styles.fields}
                  >
                    <legend>
                      {group === "team" ? "Our team" : "With thanks"}
                    </legend>
                    <label>
                      {group === "team" ? "Team heading" : "Thanks heading"}
                      <input
                        maxLength={120}
                        value={draft[headingKey]}
                        onChange={(e) =>
                          change({ ...draft, [headingKey]: e.target.value })
                        }
                      />
                    </label>
                    {!people.length && (
                      <p>This group is hidden until you add someone.</p>
                    )}
                    {people.map((person, index) => (
                      <fieldset key={person.id} className={styles.person}>
                        <legend>{person.name || `Entry ${index + 1}`}</legend>
                        <label>
                          Name
                          <input
                            maxLength={120}
                            value={person.name}
                            onChange={(e) =>
                              setPerson(person.id, { name: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Role or contribution
                          <textarea
                            maxLength={500}
                            rows={2}
                            value={person.description}
                            onChange={(e) =>
                              setPerson(person.id, {
                                description: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Website (optional)
                          <input
                            type="url"
                            maxLength={2000}
                            placeholder="https://…"
                            value={person.url}
                            onChange={(e) =>
                              setPerson(person.id, { url: e.target.value })
                            }
                          />
                        </label>
                        {(["linkedin", "instagram"] as const).map(
                          (platform) => (
                            <label key={platform}>
                              {platform === "linkedin"
                                ? "LinkedIn URL (optional)"
                                : "Instagram URL (optional)"}
                              <input
                                type="url"
                                maxLength={2000}
                                placeholder={`https://www.${platform}.com/…`}
                                value={person[platform] ?? ""}
                                onChange={(e) =>
                                  setPerson(person.id, {
                                    [platform]: e.target.value,
                                  })
                                }
                              />
                            </label>
                          ),
                        )}
                        <div className={styles.actions}>
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => move(person.id, -1)}
                          >
                            Move up
                          </button>
                          <button
                            type="button"
                            disabled={index === people.length - 1}
                            onClick={() => move(person.id, 1)}
                          >
                            Move down
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              change({
                                ...draft,
                                people: [
                                  ...draft.people.filter(
                                    (p) => p.id !== person.id,
                                  ),
                                  {
                                    ...person,
                                    group: group === "team" ? "thanks" : "team",
                                  },
                                ],
                              })
                            }
                          >
                            Move to{" "}
                            {group === "team" ? "With thanks" : "Our team"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              change({
                                ...draft,
                                people: draft.people.filter(
                                  (p) => p.id !== person.id,
                                ),
                              })
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </fieldset>
                    ))}
                    <button
                      type="button"
                      disabled={draft.people.length >= 100}
                      onClick={() =>
                        change({
                          ...draft,
                          people: [
                            ...draft.people,
                            {
                              id: crypto.randomUUID(),
                              group,
                              name: "",
                              description: "",
                              url: "",
                            },
                          ],
                        })
                      }
                    >
                      Add {group === "team" ? "team member" : "thanks entry"}
                    </button>
                  </fieldset>
                );
              })}
              <fieldset disabled={busy} className={styles.fields}>
                <legend>Support</legend>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={draft.support.enabled}
                    onChange={(e) =>
                      change({
                        ...draft,
                        support: {
                          ...draft.support,
                          enabled: e.target.checked,
                        },
                      })
                    }
                  />
                  Show support section
                </label>
                <p>
                  Keep hidden until the wording and external destination are
                  agreed. This section is an external link only.
                </p>
                {(
                  [
                    ["heading", "Support heading", 120],
                    ["description", "Short description", 600],
                    ["buttonLabel", "Button label", 80],
                    ["url", "External destination URL", 2000],
                  ] as const
                ).map(([key, label, max]) => (
                  <label key={key}>
                    {label}
                    <input
                      type={key === "url" ? "url" : "text"}
                      maxLength={max}
                      value={draft.support[key]}
                      onChange={(e) =>
                        change({
                          ...draft,
                          support: { ...draft.support, [key]: e.target.value },
                        })
                      }
                    />
                  </label>
                ))}
              </fieldset>
            </div>
          </>
        )}
      </div>
      {preview && (
        <section className={styles.preview} aria-label="Private About preview">
          <div className={styles.previewBar}>
            <p>Private preview · includes unsaved edits</p>
            <button onClick={() => setPreview(null)}>Back to editing</button>
          </div>
          <AboutView content={preview} preview />
        </section>
      )}
    </>
  );
}
