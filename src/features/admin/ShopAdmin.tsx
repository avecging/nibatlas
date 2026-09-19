"use client";
import { readAdminResponse } from './read-response';
import { normalizeShopDocument, ShopValidationError, type FieldIssue } from './shop-normalization';
import Link from "next/link";
import { ShopMediaAdmin } from "./ShopMediaAdmin";
import { ShopStampAdmin } from "./ShopStampAdmin";
import { useEffect, useId, useRef, useState } from "react";
import { useAccountSession } from "@/src/features/account/AccountSessionProvider";
import {
  decodeList,
  decodeOptions,
  decodeShop,
  GROUPS,
  HOURS_FIELDS,
  SHOP_FIELDS,
  UUID,
  type Document,
  type Field,
  type Options,
  type Row,
  type ShopRecord,
  type ShopSummary,
  type Value,
} from "./shop-contract";
import styles from "./ShopAdmin.module.css";

const messages: Record<string, string> = {
  publication_incomplete:
    "Publication requirements changed. Reload the saved version to review them.",
  authentication_required:
    "Sign in with your founder or editor account, then return here.",
  forbidden: "This account does not have catalogue access.",
  revision_conflict:
    "This shop changed in another session. Reload the saved version before trying again.",
  duplicate_record:
    "That URL name or item already exists. Check it before trying again.",
  invalid_data_or_transition:
    "Check the values and dates. For closure or archive, publish or discard saved changes first.",
  invalid_fields: "Correct the fields listed below. Your edits have not been saved.",
  invalid_request: "Check all fields and required values before saving.",
  invalid_reference: "A supporting source or catalogue item is missing.",
  shop_not_found: "This shop could not be found.",
  service_unavailable: "Shop administration is unavailable. Try again.",
};
class RequestFailure extends Error {
  constructor(readonly code: string, readonly issues: FieldIssue[] = []) {
    super(
      messages[code] ??
        "The operation could not be completed. Reload before retrying a publication or status change.",
    );
  }
}
async function api(path: string, signal: AbortSignal, body?: unknown) {
  const response = await fetch(`/api/v1/admin/shops${path}`, {
    method: body ? "POST" : "GET",
    cache: "no-store",
    credentials: "same-origin",
    signal,
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const value = await readAdminResponse(response, Boolean(body));
  if (!response.ok) {
    // A support reference only. Never log the request body, account, cookies,
    // tokens, provider messages, or the response document.
    const requestId = response.headers.get("X-Admin-Request-Id");
    const stage = response.headers.get("X-Admin-Failure-Stage");
    if (requestId && UUID.test(requestId) && stage &&
        ["identity", "access", "origin", "validation", "catalogue_rpc", "response"].includes(stage)) {
      const reason = response.headers.get("X-Admin-Database-Reason");
      const databaseReason = ["role_denied", "function_privilege", "table_privilege", "schema_privilege", "row_security", "other_permission"].includes(reason ?? "") ? reason : undefined;
      console.warn(JSON.stringify({ event: "shop_admin_failure", requestId, stage, status: response.status, databaseReason }));
    }
    const issues = Array.isArray(value.fieldErrors) && value.fieldErrors.length <= 100
      ? value.fieldErrors.filter((v: unknown): v is FieldIssue => !!v && typeof v === 'object' && 'path' in v && 'message' in v
        && typeof v.path === 'string' && /^[a-z_]+(?:\.(?:[a-z_]+|[0-9]{1,2}))*$/.test(v.path)
        && typeof v.message === 'string' && v.message.length <= 300) : [];
    throw new RequestFailure(value.error?.code ?? "service_unavailable", issues);
  }
  return value;
}
function Input({
  field,
  value,
  options,
  change,
  prefix,
  path,
  errors,
}: {
  field: Field;
  value: Value | undefined;
  options: Options;
  change: (value: Value) => void;
  prefix: string;
  path: string;
  errors: FieldIssue[];
}) {
  const id = useId();
  const label = `${prefix}${field.label}`;
  const choice = field.vocabulary
    ? (options[field.vocabulary] ?? [])
    : field.choices?.map((v) => ({ id: v, label: v.replaceAll("_", " ") }));
  const error = errors.find(e => e.path === path)?.message;
  const common = {
    id,
    required: field.required,
    "data-field-path": path,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": [field.hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined,
  };
  return (
    <div className={styles.field}>
      <label htmlFor={id}>
        {label}
        {field.required ? " *" : ""}
      </label>
      {field.kind === "boolean" ? (
        <select
          {...common}
          value={value == null ? "" : String(value)}
          onChange={(e) =>
            change(e.target.value === "" ? null : e.target.value === "true")
          }
        >
          <option value="">Unknown</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      ) : choice ? (
        <select
          {...common}
          value={String(value ?? "")}
          onChange={(e) => change(e.target.value || null)}
        >
          <option value="">Choose…</option>
          {choice.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.kind === "long" || field.kind === "claims" ? (
        <textarea
          {...common}
          rows={3}
          value={Array.isArray(value) ? value.join("\n") : String(value ?? "")}
          onChange={(e) =>
            change(
              field.kind === "claims"
                ? e.target.value.split("\n")
                : e.target.value || null,
            )
          }
        />
      ) : (
        <input
          {...common}
          type={
            field.kind === "number"
              ? "number"
              : field.kind === "date"
                ? "date"
                : "text"
          }
          step={field.kind === "number" ? "any" : undefined}
          maxLength={4000}
          value={
            field.kind === "date"
              ? String(value ?? "").slice(0, 10)
              : String(value ?? "")
          }
          onChange={(e) =>
            change(
              e.target.value === ""
                ? null
                : field.kind === "number"
                  ? Number(e.target.value)
                  : field.kind === "date"
                    ? `${e.target.value}T00:00:00Z`
                    : e.target.value,
            )
          }
        />
      )}
      {error && <small id={`${id}-error`}>{error}</small>}
      {field.hint && <small id={`${id}-hint`}>{field.hint}</small>}
    </div>
  );
}
function emptyRow(fields: Field[], id = false): Row {
  const row: Row = id ? { id: crypto.randomUUID() } : {};
  for (const f of fields)
    row[f.key] =
      f.kind === "claims"
        ? []
        : f.kind === "boolean" && f.required
          ? false
          : f.kind === "number" && f.required
            ? 0
            : (f.choices?.[0] ?? null);
  return row;
}
export function ShopAdmin({ id }: { id?: string }) {
  const { session } = useAccountSession();
  return (
    <section className={styles.admin}>
      <h1>Shop administration</h1>
      {session.status === "signed-in" ? (
        <Workspace key={`${session.userId}:${id ?? "list"}`} id={id ?? null} />
      ) : (
        <p role="status">
          {session.status === "loading"
            ? "Checking your account…"
            : "Sign in with your founder or editor account, then return here."}{" "}
          <Link href="/login">Sign in</Link>
        </p>
      )}
    </section>
  );
}
function Workspace({ id }: { id: string | null }) {
  const controller = useRef<AbortController | null>(null),
    feedback = useRef<HTMLParagraphElement>(null);
  const [record, setRecord] = useState<ShopRecord | null>(null),
    [draft, setDraft] = useState<Document | null>(null),
    [options, setOptions] = useState<Options>({}),
    [list, setList] = useState<ShopSummary[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [committedQuery, setCommittedQuery] = useState("");
  const [busy, setBusy] = useState(true),
    [message, setMessage] = useState(""),
    [fieldErrors, setFieldErrors] = useState<FieldIssue[]>([]),
    [denied, setDenied] = useState(false),
    [preview, setPreview] = useState(false),
    [confirmation, setConfirmation] = useState<string | null>(null);
  const dirty =
    !!record && JSON.stringify(draft) !== JSON.stringify(record.document);
  useEffect(() => {
    const c = new AbortController();
    controller.current = c;
    const load = async () => {
      try {
        if (id) {
          const [r, o] = await Promise.all([
            api(`/${id}`, c.signal),
            api("/options", c.signal),
          ]);
          const parsed = decodeShop(r);
          setRecord(parsed);
          setDraft(parsed.document);
          setOptions(decodeOptions(o));
        } else {
          const r = await api("", c.signal);
          setList(decodeList(r.entries));
          setCursor(r.nextCursor);
        }
      } catch (e) {
        if (!c.signal.aborted) {
          setMessage(e instanceof Error ? e.message : "Could not load shops.");
          if (
            e instanceof RequestFailure &&
            ["forbidden", "authentication_required"].includes(e.code)
          )
            setDenied(true);
        }
      } finally {
        if (!c.signal.aborted) setBusy(false);
      }
    };
    void load();
    return () => c.abort();
  }, [id]);
  useEffect(() => {
    if (!dirty) return;
    let leaving = false;
    const warn = (e: BeforeUnloadEvent) => {
      if (leaving) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const guardLink = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const destination = new URL(link.href);
      if (destination.origin === location.origin && destination.pathname === location.pathname && destination.search === location.search) {
        // In-page focus links must not add a same-document history entry.
        if (destination.hash) {
          e.preventDefault();
          const target = document.getElementById(decodeURIComponent(destination.hash.slice(1)));
          target?.focus();
          target?.scrollIntoView();
        }
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      if (window.confirm("Leave without saving your edits?")) {
        leaving = true;
        window.location.assign(link.href);
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guardLink, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guardLink, true);
    };
  }, [dirty]);
  const announce = (text: string) => {
    setMessage(text);
    requestAnimationFrame(() => feedback.current?.focus());
  };
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setFieldErrors([]);
    setConfirmation(null);
    try {
      await action();
    } catch (e) {
      if (controller.current?.signal.aborted) return;
      if (
        e instanceof RequestFailure &&
        ["forbidden", "authentication_required"].includes(e.code)
      ) {
        setDenied(true);
        setRecord(null);
        setDraft(null);
        setList([]);
      }
      if (e instanceof ShopValidationError || e instanceof RequestFailure) setFieldErrors(e.issues);
      announce(
        e instanceof Error ? e.message : "Could not complete operation.",
      );
    } finally {
      if (!controller.current?.signal.aborted) setBusy(false);
    }
  }
  const signal = () => controller.current!.signal;
  async function mutate(action: string) {
    await run(async () => {
      const value = decodeShop(
        await api(`/${id}`, signal(), {
          action,
          revision: record!.revision,
          ...(action === "save" ? { document: normalizeShopDocument(draft!) } : {}),
        }),
      );
      setRecord(value);
      setDraft(value.document);
      setPreview(false);
      announce(
        action === "save"
          ? "Changes saved privately. Preview and publish when ready."
          : action === "publish"
            ? "Shop published."
            : action === "discard"
              ? "Saved changes discarded."
              : action === "archive"
                ? "Shop archived. Collected impressions are preserved."
                : "Operational status updated. Collected impressions are preserved.",
      );
    });
  }
  const viewOptions: Options = {
    ...options,
    sources:
      draft?.sources.map((r) => ({
        id: String(r.id),
        label: String(r.label ?? "Unnamed source"),
      })) ?? [],
  };
  const setShop = (key: string, v: Value) =>
    setDraft((d) => (d ? { ...d, shop: { ...d.shop, [key]: v } } : d));
  return (
    <>
      <p
        ref={feedback}
        tabIndex={-1}
        role={message ? "alert" : "status"}
        className={styles.feedback}
      >
        {message ||
          (busy
            ? "Loading shops…"
            : "Maintain sourced records; leave unknown information blank.")}
      </p>
      {!denied && fieldErrors.length > 0 && <ul className={styles.fieldErrors} aria-label="Fields to correct">
        {fieldErrors.map((error, index) => <li key={index}>
          <button type="button" onClick={() => {
            const target = [...window.document.querySelectorAll<HTMLElement>('[data-field-path]')]
              .find(el => el.dataset.fieldPath === error.path || el.dataset.fieldPath?.startsWith(`${error.path}.`));
            let section = target?.closest('details');
            while (section) { section.open = true; section = section.parentElement?.closest('details') ?? null; }
            target?.focus(); target?.scrollIntoView({ block: 'center' });
          }}>{fieldLabel(error.path)}: {error.message}</button>
        </li>)}
      </ul>}
      {denied ? null : !id ? (
        <>
          <form
            className={styles.toolbar}
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const result = await api(
                  `?q=${encodeURIComponent(query)}`,
                  signal(),
                );
                setList(decodeList(result.entries));
                setCursor(result.nextCursor);
                setCommittedQuery(query);
              });
            }}
          >
            <label>
              Find a shop
              <input
                value={query}
                maxLength={120}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button disabled={busy}>Search</button>
          </form>
          <ul className={styles.list}>
            {list.map((s) => (
              <li key={s.id}>
                <a href={`/admin/shops/${s.id}`}>{s.name}</a>
                <span>
                  {s.publicationStatus} ·{" "}
                  {s.operationalStatus.replaceAll("_", " ")}
                  {s.hasChanges ? " · saved changes" : ""}
                </span>
              </li>
            ))}
          </ul>
          {!busy && !list.length && <p>No shops found.</p>}
          {cursor && (
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const result = await api(
                    `?after=${cursor}&q=${encodeURIComponent(committedQuery)}`,
                    signal(),
                  );
                  setList((l) => [...l, ...decodeList(result.entries)]);
                  setCursor(result.nextCursor);
                })
              }
            >
              Load more shops
            </button>
          )}
          <details>
            <summary>Create a draft shop</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                void run(async () => {
                  const result = decodeShop(
                    await api("", signal(), {
                      action: "create",
                      id: crypto.randomUUID(),
                      document: {
                        name: form.get("name"),
                        slug: form.get("slug"),
                      },
                    }),
                  );
                  // Native entry gives browser Back a document boundary for beforeunload.
                  window.location.assign(`/admin/shops/${result.id}`);
                });
              }}
            >
              <fieldset disabled={busy}>
                <legend>New shop</legend>
                <label>
                  Shop name
                  <input name="name" data-field-path="name" required maxLength={300} />
                </label>
                <label>
                  URL name (optional)
                  <input
                    name="slug"
                    data-field-path="slug"
                    maxLength={120}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  />
                </label>
                <p>
                  A draft is private and includes a generated Atlas Stamp. Add
                  researched shop details before publication.
                </p>
                <button>Create draft</button>
              </fieldset>
            </form>
          </details>
        </>
      ) : record && draft ? (
        <>
          <div className={styles.toolbar}>
            <Link
              href="/admin/shops"
              prefetch={false}
              onNavigate={(e) => {
                e.preventDefault();
                window.location.assign("/admin/shops");
              }}
            >
              All shops
            </Link>
            <strong>
              {record.publicationStatus}
              {record.hasChanges ? " · saved changes" : ""}
              {dirty ? " · unsaved edits" : ""}
            </strong>
            <button
              disabled={busy || dirty}
              onClick={() => {
                setPreview((v) => !v);
                setConfirmation(null);
              }}
            >
              {preview ? "Back to editing" : "Preview saved version"}
            </button>
          </div>
          {preview ? (
            <Preview document={record.document} options={options} />
          ) : (
            <form
              onInvalid={(e) => {
                let section = (e.target as HTMLElement).closest("details");
                while (section) {
                  section.open = true;
                  section = section.parentElement?.closest("details") ?? null;
                }
              }}
              onSubmit={(e) => {
                e.preventDefault();
                void mutate("save");
              }}
            >
              <fieldset
                disabled={busy || record.publicationStatus === "archived"}
              >
                <legend>Catalogue details</legend>
                <div className={styles.grid}>
                  {SHOP_FIELDS.map((field) => (
                    <Input
                      key={field.key}
                      field={field}
                      path={`shop.${field.key}`} errors={fieldErrors}
                      value={draft.shop[field.key]}
                      options={viewOptions}
                      prefix=""
                      change={(v) => setShop(field.key, v)}
                    />
                  ))}
                </div>
                <details>
                  <summary>Opening hours</summary>
                  <p>
                    Record only sourced hours. Missing days stay unknown; no
                    “open now” calculation.
                  </p>
                  <label>
                    Hours summary
                    <input data-field-path="shop.opening_hours.note"
                      value={String(
                        (draft.shop.opening_hours as Row | null)?.note ?? "",
                      )}
                      onChange={(e) =>
                        setShop("opening_hours", {
                          ...((draft.shop.opening_hours as Row | null) ?? {}),
                          note: e.target.value || null,
                        })
                      }
                    />
                  </label>
                  {(
                    ((draft.shop.opening_hours as Row | null)?.entries ??
                      []) as Row[]
                  ).map((r, i) => (
                    <fieldset key={i}>
                      <legend>Hours {i + 1}</legend>
                      <div className={styles.grid}>
                        {HOURS_FIELDS.map((field) => (
                          <Input
                            key={field.key}
                            field={field}
                            path={`shop.opening_hours.entries.${i}.${field.key}`} errors={fieldErrors}
                            value={r[field.key]}
                            options={viewOptions}
                            prefix=""
                            change={(v) => {
                              const h = draft.shop.opening_hours as Row;
                              setShop("opening_hours", {
                                ...h,
                                entries: (h.entries as Row[]).map((x, n) =>
                                  n === i ? { ...x, [field.key]: v } : x,
                                ),
                              });
                            }}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const h = draft.shop.opening_hours as Row;
                          setShop("opening_hours", {
                            ...h,
                            entries: (h.entries as Row[]).filter(
                              (_, n) => n !== i,
                            ),
                          });
                        }}
                      >
                        Remove hours {i + 1}
                      </button>
                    </fieldset>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const h = (draft.shop.opening_hours as Row | null) ?? {};
                      setShop("opening_hours", {
                        ...h,
                        entries: [
                          ...((h.entries ?? []) as Row[]),
                          emptyRow(HOURS_FIELDS),
                        ],
                      });
                    }}
                  >
                    Add hours
                  </button>
                </details>
                {GROUPS.map((g) => (
                  <details key={g.key}>
                    <summary>
                      {g.label} ({draft[g.key].length})
                    </summary>
                    {draft[g.key].map((r, i) => (
                      <fieldset key={String(r.id ?? i)}>
                        <legend>
                          {g.label} {i + 1}
                        </legend>
                        <div className={styles.grid}>
                          {g.fields.map((field) => (
                            <Input
                              key={field.key}
                              field={field}
                              path={`${g.key}.${i}.${field.key}`} errors={fieldErrors}
                              value={r[field.key]}
                              options={viewOptions}
                              prefix=""
                              change={(v) =>
                                setDraft({
                                  ...draft,
                                  [g.key]: draft[g.key].map((x, n) =>
                                    n === i ? { ...x, [field.key]: v } : x,
                                  ),
                                })
                              }
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              [g.key]: draft[g.key].filter((_, n) => n !== i),
                            })
                          }
                        >
                          Remove {g.label.toLowerCase()} {i + 1}
                        </button>
                      </fieldset>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          [g.key]: [
                            ...draft[g.key],
                            emptyRow(
                              g.fields,
                              ["sources", "aliases", "links"].includes(g.key),
                            ),
                          ],
                        })
                      }
                    >
                      Add {g.label.toLowerCase()}
                    </button>
                  </details>
                ))}
                <button disabled={!dirty} type="submit">
                  Save changes privately
                </button>
              </fieldset>
            </form>
          )}
          <ShopMediaAdmin key={`media-${record.id}`} shopId={record.id} shopName={String(record.document.shop.name)} archived={record.publicationStatus === "archived"} />
          <ShopStampAdmin key={`stamp-${record.id}`} shopId={record.id} shopName={String(record.document.shop.name)}
            localityName={options.localities?.find(o=>o.id===record.document.shop.locality_id)?.label.replace(/ \([A-Z]{2}\)$/, '') ?? ''}
            countryCode={String(record.document.shop.country_code ?? '')} archived={record.publicationStatus === "archived"}
            onPrepared={async()=>{
              const current=decodeShop(await api(`/${id}`,signal()));
              // Preparing art changes no catalogue document. Refresh blockers only
              // for this saved revision, never replace unsaved or concurrent edits.
              setRecord(previous=>previous?.revision===current.revision
                ? {...previous,publicationErrors:current.publicationErrors}:previous);
            }} />
          <section className={styles.operations}>
            <h2>Publication and status</h2>
            {record.publicationErrors.length > 0 && (
              <>
                <p>Before publishing:</p>
                <ul>
                  {record.publicationErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </>
            )}
            <p>
              Publication controls public visibility. Operational status records
              whether the shop is open or closed. Archiving is permanent in this
              interface. Existing impressions keep their original names, places
              and artwork.
            </p>
            <div className={styles.toolbar}>
              {record.publicationStatus !== "archived" && (
                <>
                  <button
                    disabled={
                      busy ||
                      dirty ||
                      record.publicationErrors.length > 0 ||
                      (!record.hasChanges &&
                        record.publicationStatus === "published")
                    }
                    onClick={() => setConfirmation("publish")}
                  >
                    Publish saved version
                  </button>
                  {record.hasChanges && (
                    <button
                      disabled={busy || dirty}
                      onClick={() => setConfirmation("discard")}
                    >
                      Discard saved changes
                    </button>
                  )}
                  {record.publicationStatus === "published" &&
                    [
                      "temporarily_closed",
                      "permanently_closed",
                      "open",
                      "unknown",
                    ]
                      .filter(
                        (s) => s !== record.document.shop.operational_status,
                      )
                      .map((s) => (
                        <button
                          key={s}
                          disabled={busy || dirty || record.hasChanges}
                          onClick={() => setConfirmation(s)}
                        >
                          Mark {s.replaceAll("_", " ")}
                        </button>
                      ))}
                  <button
                    disabled={busy || dirty || record.hasChanges}
                    onClick={() => setConfirmation("archive")}
                  >
                    Archive shop
                  </button>
                </>
              )}
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    !dirty ||
                    window.confirm("Discard your unsaved edits and reload?")
                  )
                    void run(async () => {
                      const r = decodeShop(await api(`/${id}`, signal()));
                      setRecord(r);
                      setDraft(r.document);
                      announce("Loaded the saved version.");
                    });
                }}
              >
                Reload saved version
              </button>
            </div>
            {confirmation && (
              <div
                className={styles.confirmation}
                role="group"
                aria-label="Confirm shop operation"
              >
                <p>
                  Confirm {confirmation.replaceAll("_", " ")}?{" "}
                  {confirmation === "publish"
                    ? "The saved version will become public."
                    : confirmation === "archive"
                      ? "The shop will leave public discovery and its public page."
                      : confirmation === "discard"
                        ? "The private saved changes will be removed."
                        : "Use this only when supported by your source or visit."}
                </p>
                <button autoFocus onClick={() => void mutate(confirmation)}>
                  Confirm {confirmation.replaceAll("_", " ")}
                </button>
                <button onClick={() => setConfirmation(null)}>Cancel</button>
              </div>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
function Preview({
  document: d,
  options,
}: {
  document: Document;
  options: Options;
}) {
  const name = (group: string, id: Value | undefined) =>
    options[group]?.find((o) => o.id === id)?.label;
  return (
    <article className={styles.preview}>
      <p>
        <strong>Private catalogue preview</strong> · Unpublished changes are
        visible only to editors and admins.
      </p>
      <h2>{String(d.shop.name)}</h2>
      <p>{String(d.shop.operational_status).replaceAll("_", " ")}</p>
      {d.aliases
        .filter((a) => a.alias_type === "local_name")
        .map((a) => (
          <p key={String(a.id)} lang={String(a.language_tag)}>
            {String(a.alias)}
          </p>
        ))}
      {d.shop.short_description && <p>{String(d.shop.short_description)}</p>}
      <p>
        {name("localities", d.shop.locality_id) ??
          String(
            d.shop.city_display ??
              d.shop.country_code ??
              "Place not yet recorded",
          )}
      </p>
      {[d.shop.address_line_1, d.shop.address_line_2]
        .filter(Boolean)
        .map((a, i) => (
          <p key={i}>{String(a)}</p>
        ))}
      <dl>
        {["types", "specialties", "brands"].map((k) => {
          const key = k as "types" | "specialties" | "brands",
            idKey = {
              types: "shop_type_id",
              specialties: "specialty_id",
              brands: "brand_id",
            }[key];
          return d[key].length ? (
            <div key={k}>
              <dt>{k === "types" ? "Shop types" : k}</dt>
              <dd>{d[key].map((r) => name(k, r[idKey])).join(", ")}</dd>
            </div>
          ) : null;
        })}
      </dl>
      {d.services
        .filter((r) => r.source_id)
        .map((r) => (
          <p key={String(r.service_id)}>
            {name("services", r.service_id)}
            {r.note ? ` — ${r.note}` : ""}
          </p>
        ))}
      {d.shop.website_url && <p>{String(d.shop.website_url)}</p>}
      {d.links
        .filter((r) => r.is_official)
        .map((r) => (
          <p key={String(r.id)}>
            {String(r.label ?? r.link_type)}: {String(r.url)}
          </p>
        ))}
      {d.shop.opening_hours && (
        <section>
          <h3>Recorded hours</h3>
          {(((d.shop.opening_hours as Row).entries as Row[]) ?? []).map(
            (r, i) => (
              <p key={i}>
                {String(r.day)}:{" "}
                {r.closed
                  ? "Closed"
                  : r.opens
                    ? `${r.opens}–${r.closes}`
                    : "Hours not recorded"}
                {r.note ? ` · ${r.note}` : ""}
              </p>
            ),
          )}
          {(d.shop.opening_hours as Row).note && (
            <p>{String((d.shop.opening_hours as Row).note)}</p>
          )}
        </section>
      )}
      <h3>Sources</h3>
      {d.sources.map((r) => (
        <section key={String(r.id)}>
          <h4>{String(r.label)}</h4>
          <p>
            {String(r.source_type).replaceAll("_", " ")} · Checked{" "}
            {String(r.checked_at).slice(0, 10)}
          </p>
          {r.source_url && <p>{String(r.source_url)}</p>}
          <p>{((r.claims as string[]) ?? []).join(" · ")}</p>
        </section>
      ))}
      {d.shop.source_quality === "demo" && (
        <p>Demo data — not a verified shop listing.</p>
      )}
      <p>
        Phone, postal code, record review date, appointment and accessibility
        notes remain internal. Private evidence notes are omitted here. Artwork
        versions are managed separately. Photos and logos have their own publication controls below.
      </p>
    </article>
  );
}

function fieldLabel(path: string): string {
  const parts = path.split('.');
  if (parts[0] === 'shop' && parts[1] !== 'opening_hours') return SHOP_FIELDS.find(f => f.key === parts[1])?.label ?? 'Shop';
  if (parts[1] === 'opening_hours') return parts[2] === 'entries' ? `Hours ${Number(parts[3]) + 1} · ${HOURS_FIELDS.find(f => f.key === parts[4])?.label ?? 'entry'}` : 'Hours summary';
  const g = GROUPS.find(g => g.key === parts[0]);
  return g ? `${g.label}${parts[1] ? ` ${Number(parts[1]) + 1}` : ''}${parts[2] ? ` · ${g.fields.find(f => f.key === parts[2])?.label ?? 'item'}` : ''}` : parts[0] === 'name' ? 'Shop name' : parts[0] === 'slug' ? 'URL name' : 'Record';
}
