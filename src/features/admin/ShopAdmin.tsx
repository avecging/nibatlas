"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useAccountSession } from "@/src/features/account/AccountSessionProvider";
import {
  decodeList,
  decodeOptions,
  decodeShop,
  GROUPS,
  HOURS_FIELDS,
  SHOP_FIELDS,
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
  authentication_required:
    "Sign in with your founder or editor account, then return here.",
  forbidden: "This account does not have catalogue access.",
  revision_conflict:
    "This shop changed in another session. Reload the saved version before trying again.",
  duplicate_record:
    "That URL name or item already exists. Check it before trying again.",
  invalid_data_or_transition:
    "Check the values and dates. For closure or archive, publish or discard saved changes first.",
  invalid_request: "Check all fields and required values before saving.",
  invalid_reference: "A supporting source or catalogue item is missing.",
  shop_not_found: "This shop could not be found.",
  service_unavailable: "Shop administration is unavailable. Try again.",
};
class RequestFailure extends Error {
  constructor(readonly code: string) {
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
  const value = await response.json();
  if (!response.ok)
    throw new RequestFailure(value.error?.code ?? "service_unavailable");
  return value;
}
function Input({
  field,
  value,
  options,
  change,
  prefix,
}: {
  field: Field;
  value: Value | undefined;
  options: Options;
  change: (value: Value) => void;
  prefix: string;
}) {
  const id = useId();
  const label = `${prefix}${field.label}`;
  const choice = field.vocabulary
    ? (options[field.vocabulary] ?? [])
    : field.choices?.map((v) => ({ id: v, label: v.replaceAll("_", " ") }));
  const common = {
    id,
    required: field.required,
    "aria-describedby": field.hint ? `${id}-hint` : undefined,
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
  const router = useRouter(),
    controller = useRef<AbortController | null>(null),
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
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const announce = (text: string) => {
    setMessage(text);
    requestAnimationFrame(() => feedback.current?.focus());
  };
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
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
          ...(action === "save" ? { document: clean(draft!) } : {}),
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
                <Link href={`/admin/shops/${s.id}`}>{s.name}</Link>
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
                  router.push(`/admin/shops/${result.id}`);
                });
              }}
            >
              <fieldset disabled={busy}>
                <legend>New shop</legend>
                <label>
                  Shop name
                  <input name="name" required maxLength={300} />
                </label>
                <label>
                  URL name
                  <input
                    name="slug"
                    required
                    maxLength={120}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  />
                </label>
                <p>
                  A draft is private. Add researched facts and an approved Atlas
                  Stamp before publication.
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
              onClick={(e) => {
                if (
                  dirty &&
                  !window.confirm("Leave without saving your edits?")
                )
                  e.preventDefault();
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
                    <input
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
function clean(d: Document): Document {
  const result = structuredClone(d);
  for (const s of result.sources)
    s.claims = ((s.claims as string[]) ?? [])
      .map((v) => v.trim())
      .filter(Boolean);
  return result;
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
        and media are managed in the next package.
      </p>
    </article>
  );
}
