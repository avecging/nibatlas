"use client";
import { publicationFix } from "./publication-fix";
import { useHasPendingUploads } from "./use-pending-upload";
import { ShopEditorial } from "@/src/components/shops/ShopEditorial";
import { decodeEditorialContent } from "@/src/api/v1/shop-read";
import { readAdminResponse } from "./read-response";
import {
  normalizeShopDocument,
  ShopValidationError,
  type FieldIssue,
} from "./shop-normalization";
import Link from "next/link";
import { ShopMediaAdmin, type MediaSummary } from "./ShopMediaAdmin";
import { decodeShopMedia, mediaPath } from "./media-contract";
import { ShopStampAdmin } from "./ShopStampAdmin";
import { TimezoneField } from "./TimezoneField";
import { CountryField } from "./CountryField";
import { suggestTimezone } from "./timezones";
import {
  LEGACY_FIELDS,
  LEGACY_GROUPS,
  PRIVATE_FIELDS,
  SECTIONS,
  SECTION_FIELDS,
  SECTION_GROUPS,
  sectionForFix,
  sectionForPath,
  type SectionId,
} from "./editor-sections";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useDialog } from "./use-dialog";
import type { ReactNode, RefObject } from "react";
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
    "Publication requirements changed. The list below is the saved version's current blockers.",
  authentication_required:
    "Sign in with your founder or editor account, then return here.",
  forbidden: "This account does not have catalogue access.",
  revision_conflict:
    "This shop changed in another session. Reload the saved version before trying again. Your edits are still on screen.",
  duplicate_record:
    "That URL name or item already exists. Change it, then save again.",
  invalid_data_or_transition:
    "Check the values and dates. For closure or archive, publish or discard saved changes first.",
  invalid_fields:
    "Nothing was saved. Correct the fields listed below — your edits are still on screen.",
  invalid_request: "Check all fields and required values before saving.",
  invalid_reference: "A supporting source or catalogue item is missing.",
  shop_not_found: "This shop could not be found.",
  service_unavailable:
    "Shop administration is unavailable. Your edits are still on screen; try again.",
};
class RequestFailure extends Error {
  constructor(
    readonly code: string,
    readonly issues: FieldIssue[] = [],
    readonly requirements: string[] = [],
  ) {
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
    if (
      requestId &&
      UUID.test(requestId) &&
      stage &&
      ["identity", "access", "origin", "validation", "catalogue_rpc", "response"].includes(
        stage,
      )
    ) {
      const reason = response.headers.get("X-Admin-Database-Reason");
      const databaseReason = [
        "role_denied",
        "function_privilege",
        "table_privilege",
        "schema_privilege",
        "row_security",
        "other_permission",
      ].includes(reason ?? "")
        ? reason
        : undefined;
      console.warn(
        JSON.stringify({
          event: "shop_admin_failure",
          requestId,
          stage,
          status: response.status,
          databaseReason,
        }),
      );
    }
    const issues =
      Array.isArray(value.fieldErrors) && value.fieldErrors.length <= 100
        ? value.fieldErrors.filter(
            (v: unknown): v is FieldIssue =>
              !!v &&
              typeof v === "object" &&
              "path" in v &&
              "message" in v &&
              typeof v.path === "string" &&
              /^[a-z_]+(?:\.(?:[a-z_]+|[0-9]{1,2}))*$/.test(v.path) &&
              typeof v.message === "string" &&
              v.message.length <= 300,
          )
        : [];
    const requirements =
      Array.isArray(value.requirements) &&
      value.requirements.length <= 10 &&
      value.requirements.every((v: unknown) => typeof v === "string" && v.length <= 300)
        ? (value.requirements as string[])
        : [];
    throw new RequestFailure(value.error?.code ?? "service_unavailable", issues, requirements);
  }
  return value;
}

/** Where a correction link wants to land, resolved after the section renders. */
type FocusTarget = { path?: string; id?: string };

/** Opens every ancestor disclosure of an element and moves focus to it. */
function reveal(target: FocusTarget): boolean {
  const element = target.path
    ? [...window.document.querySelectorAll<HTMLElement>("[data-field-path]")].find(
        (el) =>
          el.dataset.fieldPath === target.path ||
          el.dataset.fieldPath?.startsWith(`${target.path}.`),
      )
    : target.id
      ? window.document.getElementById(target.id)
      : null;
  if (!element) return false;
  if (element instanceof HTMLDetailsElement) element.open = true;
  let group = element.closest("details");
  while (group) {
    group.open = true;
    group = group.parentElement?.closest("details") ?? null;
  }
  // A disabled control cannot take focus — a Fix link for the position
  // confirmation lands on one whenever there are unsaved edits — so bring it
  // into view regardless and only then try to focus it.
  element.scrollIntoView({ block: "center" });
  element.focus();
  return true;
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
  const error = errors.find((e) => e.path === path)?.message;
  const common = {
    id,
    required: field.required,
    "data-field-path": path,
    "aria-invalid": error ? true : undefined,
    "aria-describedby":
      [field.hint ? `${id}-hint` : "", error ? `${id}-error` : ""]
        .filter(Boolean)
        .join(" ") || undefined,
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
          disabled={choice.length === 0}
          value={String(value ?? "")}
          onChange={(e) => change(e.target.value || null)}
        >
          <option value="">{choice.length ? "Choose…" : "No options available"}</option>
          {choice.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.kind === "long" || field.kind === "claims" ? (
        <textarea
          {...common}
          rows={field.key === "field_note_body" ? 8 : 3}
          value={Array.isArray(value) ? value.join("\n") : String(value ?? "")}
          onChange={(e) =>
            change(
              field.kind === "claims" ? e.target.value.split("\n") : e.target.value || null,
            )
          }
        />
      ) : (
        <input
          {...common}
          type={
            field.kind === "number" ? "number" : field.kind === "date" ? "date" : "text"
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
      {error && (
        <small id={`${id}-error`} className={styles.inlineError}>
          {error}
        </small>
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
      {session.status === "signed-in" ? (
        <Workspace key={`${session.userId}:${id ?? "list"}`} id={id ?? null} />
      ) : (
        <>
          <h1>Shop administration</h1>
          <p role="status">
            {session.status === "loading"
              ? "Checking your account…"
              : "Sign in with your founder or editor account, then return here."}{" "}
            <Link href="/login">Sign in</Link>
          </p>
        </>
      )}
    </section>
  );
}

type Notice = { tone: "ok" | "error"; text: string } | null;

function Workspace({ id }: { id: string | null }) {
  const pendingUploads = useHasPendingUploads();
  const controller = useRef<AbortController | null>(null),
    noticeRef = useRef<HTMLDivElement>(null);
  const [record, setRecord] = useState<ShopRecord | null>(null),
    [draft, setDraft] = useState<Document | null>(null),
    [options, setOptions] = useState<Options>({}),
    [list, setList] = useState<ShopSummary[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [committedQuery, setCommittedQuery] = useState("");
  const [busy, setBusy] = useState(true),
    [notice, setNotice] = useState<Notice>(null),
    [fieldErrors, setFieldErrors] = useState<FieldIssue[]>([]),
    [denied, setDenied] = useState(false),
    [section, setSection] = useState<SectionId>("story"),
    [previewWidth, setPreviewWidth] = useState<"desktop" | "mobile">("desktop"),
    [media, setMedia] = useState<MediaSummary | null>(null),
    [mediaCheck, setMediaCheck] = useState<"pending" | "failed">("pending"),
    [role, setRole] = useState<"editor" | "admin" | null>(null),
    [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null),
    [headingFocus, setHeadingFocus] = useState(0),
    [confirmation, setConfirmation] = useState<string | null>(null);
  const dirty = !!record && JSON.stringify(draft) !== JSON.stringify(record.document);

  useEffect(() => {
    const c = new AbortController();
    controller.current = c;
    const load = async () => {
      try {
        if (id) {
          // Showing, hiding and deleting an image are admin-only on the server,
          // so an editor is told that instead of being offered a button that
          // 403s. The role is read with the shop rather than after it, so the
          // controls are never briefly wrong while it is in flight.
          const [r, o, access] = await Promise.all([
            api(`/${id}`, c.signal),
            api("/options", c.signal),
            fetch("/api/v1/admin/access", {
              signal: c.signal,
              cache: "no-store",
              credentials: "same-origin",
            })
              .then((response) => (response.ok ? response.json() : null))
              .catch(() => null),
          ]);
          const parsed = decodeShop(r);
          const actorRole = (access as { role?: unknown } | null)?.role;
          if (actorRole === "admin" || actorRole === "editor") setRole(actorRole);
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
          setNotice({
            tone: "error",
            text: e instanceof Error ? e.message : "Could not load shops.",
          });
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
    if (!dirty && !pendingUploads) return;
    let leaving = false;
    const warn = (e: BeforeUnloadEvent) => {
      if (leaving) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const guardLink = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link =
        e.target instanceof Element
          ? e.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self"))
        return;
      const destination = new URL(link.href);
      if (
        destination.origin === location.origin &&
        destination.pathname === location.pathname &&
        destination.search === location.search
      ) {
        // In-page focus links must not add a same-document history entry.
        if (destination.hash) {
          e.preventDefault();
          const target = window.document.getElementById(
            decodeURIComponent(destination.hash.slice(1)),
          );
          target?.focus();
          target?.scrollIntoView();
        }
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      if (
        window.confirm(
          pendingUploads
            ? "An image has not finished saving. Leave without it or any unsaved edits?"
            : "Leave without saving your edits?",
        )
      ) {
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
  }, [dirty, pendingUploads]);

  // Review must be able to say how many images are public even when the editor
  // has not opened Photos in this visit. A failure here is silent: the Photos
  // section reports media problems, and this is only a summary line.
  useEffect(() => {
    if (!id || section !== "review" || media || mediaCheck === "failed") return;
    const c = new AbortController();
    fetch(mediaPath(id), { signal: c.signal, cache: "no-store", credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error())))
      .then((value) => {
        const rows = decodeShopMedia(value.entries, true);
        setMedia({
          total: rows.length,
          published: rows.filter((row) => row.status === "approved").length,
        });
      })
      .catch(() => {
        // The Photos section owns media errors. Review only has to stop
        // claiming a check is still running when it has given up.
        if (!c.signal.aborted) setMediaCheck("failed");
      });
    return () => c.abort();
  }, [id, section, media, mediaCheck]);

  const updateMediaSummary = useCallback((summary: MediaSummary) => {
    setMedia(summary);
    setMediaCheck("pending");
  }, []);

  // A correction link changes section first; the element only exists after that
  // section renders, so focus is taken here rather than in the click handler.
  useEffect(() => {
    if (!focusTarget) return;
    reveal(focusTarget);
    setFocusTarget(null);
  }, [focusTarget]);

  /** Errors move focus so the problem is found; routine success never does. */
  const announce = useCallback((next: NonNullable<Notice>, focus = false) => {
    setNotice(next);
    if (focus) requestAnimationFrame(() => noticeRef.current?.focus());
  }, []);

  // Switching section moves focus to its heading, so a screen reader and the
  // keyboard both land in the new content. It happens in the commit that
  // renders the section, never in a later frame that could steal focus from
  // something the editor has already reached for.
  const go = useCallback(
    (next: SectionId) => {
      // Leaving Photos unmounts the uploader and aborts an upload in flight,
      // so this gets the same warning as leaving the page by a link.
      if (
        next !== "photos" &&
        pendingUploads &&
        !window.confirm(
          "An image has not finished saving. Leaving this section cancels it. Leave anyway?",
        )
      )
        return;
      setSection(next);
      setHeadingFocus((n) => n + 1);
    },
    [pendingUploads],
  );
  useEffect(() => {
    if (!headingFocus) return;
    window.document.getElementById("shop-section-heading")?.focus();
    window.scrollTo({ top: 0 });
  }, [headingFocus]);

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
      if (e instanceof RequestFailure && e.requirements.length)
        setRecord((current) =>
          current ? { ...current, publicationErrors: e.requirements } : current,
        );
      let target: FieldIssue | undefined;
      if (e instanceof ShopValidationError || e instanceof RequestFailure) {
        setFieldErrors(e.issues);
        target = e.issues[0];
        if (target) {
          // A correction has to be reachable, so this jump is not refusable;
          // the pending-upload warning is raised by `go` for ordinary moves.
          setSection(sectionForPath(target.path));
          setFocusTarget({ path: target.path });
        }
      }
      // Focus goes to the field that has to change when there is one; the
      // announcement must not pull it back to the message.
      announce(
        {
          tone: "error",
          text: e instanceof Error ? e.message : "Could not complete operation.",
        },
        !target,
      );
    } finally {
      if (!controller.current?.signal.aborted) setBusy(false);
    }
  }
  const signal = () => controller.current!.signal;

  async function mutate(action: string, destination: "stay" | "review" = "stay") {
    await run(async () => {
      const value = decodeShop(
        await api(`/${id}`, signal(), {
          action,
          revision: record!.revision,
          ...(action === "save"
            ? { document: normalizeShopDocument(draft!, options) }
            : {}),
        }),
      );
      setRecord(value);
      setDraft(value.document);
      if (action === "save" && destination === "review") go("review");
      announce({
        tone: "ok",
        text:
          action === "save"
            ? destination === "review"
              ? "Saved privately. This is the saved version, ready to review."
              : "Saved privately. Nothing is public until you publish."
            : action === "confirm_position"
              ? "Saved position confirmed."
              : action === "publish"
                ? "Shop published. Its public page is live."
                : action === "discard"
                  ? "Saved changes discarded."
                  : action === "archive"
                    ? "Shop archived. Collected impressions are preserved."
                    : "Operational status updated. Collected impressions are preserved.",
      });
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
  /** Clearing the stale error for a field the editor is fixing right now. */
  const clearError = (path: string) =>
    setFieldErrors((current) =>
      current.length && current.some((e) => e.path === path)
        ? current.filter((e) => e.path !== path)
        : current,
    );
  const setShop = (key: string, v: Value) => {
    clearError(`shop.${key}`);
    setDraft((d) => (d ? { ...d, shop: { ...d.shop, [key]: v } } : d));
  };
  const fieldByKey = useMemo(
    () => new Map(SHOP_FIELDS.map((f) => [f.key, f])),
    [],
  );
  const groupByKey = useMemo(() => new Map(GROUPS.map((g) => [g.key as string, g])), []);

  const shopField = (key: string) => {
    const field = fieldByKey.get(key);
    if (!field || !draft) return null;
    if (key === "country_code")
      return (
        <div className={styles.field} key={key}>
          <CountryField
            value={String(draft.shop.country_code ?? "")}
            disabled={busy || record?.publicationStatus === "archived"}
            error={fieldErrors.find((e) => e.path === "shop.country_code")?.message}
            onChange={(v) => setShop("country_code", v)}
          />
        </div>
      );
    if (key === "locality_id")
      return <div key={key}>
        <Input field={field} path="shop.locality_id" errors={fieldErrors} value={draft.shop[key]}
          options={viewOptions} prefix="" change={v => setShop(key,v)} />
        {role === "admin" && <VocabularyCreator kind="localities" busy={busy || record?.publicationStatus === "archived" || !/^[A-Z]{2}$/.test(String(draft.shop.country_code ?? ""))}
          create={async label => { await run(async () => {
            const result = await api("/options",signal(),{kind:"localities",label,countryCode:draft.shop.country_code,
              adminAreaCode:draft.shop.admin_area_code || null});
            const updated = decodeOptions(result.options);
            const item = updated.localities?.find(o => o.id === result.id);
            if (!item) throw new Error("Could not load the new locality. Reload before retrying.");
            setOptions(updated); setShop("locality_id",item.id);
            announce({tone:"ok",text:`${item.label} selected. Save to keep this selection.`});
          }); }} />}
        <p className={styles.help}>{role === "admin" ? "Choose a country first. New localities use that country and the administrative area code entered here." : "An admin can add a missing locality."}</p>
      </div>;
    if (key === "timezone")
      return (
        <div className={styles.field} key={key}>
          <TimezoneField
            value={String(draft.shop.timezone ?? "")}
            disabled={busy || record?.publicationStatus === "archived"}
            error={fieldErrors.find((e) => e.path === "shop.timezone")?.message}
            suggestion={suggestTimezone(String(draft.shop.country_code ?? ""))}
            onChange={(v) => setShop("timezone", v)}
          />
        </div>
      );
    return (
      <Input
        key={key}
        field={field}
        path={`shop.${key}`}
        errors={fieldErrors}
        value={draft.shop[key]}
        options={viewOptions}
        prefix=""
        change={(v) => setShop(key, v)}
      />
    );
  };

  const groupEditor = (key: string) => {
    const g = groupByKey.get(key);
    if (!g || !draft) return null;
    const vocabulary = g.fields[0]?.vocabulary;
    const empty = !!vocabulary && !options[vocabulary]?.length;
    const creatable = ["brands", "specialties"].includes(g.key) || (g.key === "types" && role === "admin");
    return (
      <fieldset className={styles.group} key={g.key} data-field-path={g.key} tabIndex={-1}>
        <legend>
          {g.label} ({draft[g.key].length})
        </legend>
        {empty && (
          <p className={styles.help}>
            No {g.label.toLowerCase()} exist in the catalogue yet.
            {creatable
              ? " Add one below; it becomes a catalogue choice you can reuse."
              : " Ask an admin to add the missing choice."}
          </p>
        )}
        {creatable && (
          <VocabularyCreator
            kind={g.key as "brands" | "specialties" | "types"}
            busy={busy || record?.publicationStatus === "archived"}
            create={async (label) => {
              await run(async () => {
                const result = await api("/options", signal(), { kind: g.key, label });
                const updated = decodeOptions(result.options);
                const item = updated[g.key]?.find((o) => o.id === result.id);
                if (!item)
                  throw new Error(
                    "Could not load the new catalogue item. Reload before retrying.",
                  );
                setOptions(updated);
                setDraft((current) =>
                  current && current[g.key].some((r) => r[g.fields[0]!.key] === item.id)
                    ? current
                    : current
                      ? {
                          ...current,
                          [g.key]: [
                            ...current[g.key],
                            { ...emptyRow(g.fields), [g.fields[0]!.key]: item.id },
                          ],
                        }
                      : current,
                );
                announce({
                  tone: "ok",
                  text: `${item.label} selected. Save to keep this selection.`,
                });
              });
            }}
          />
        )}
        {draft[g.key].map((r, i) => (
          <div className={styles.card} key={String(r.id ?? i)}>
            <div className={styles.grid}>
              {g.fields
                .filter((field) => !["source_id", "last_verified_at"].includes(field.key))
                .map((field) => (
                  <Input
                    key={field.key}
                    field={field}
                    path={`${g.key}.${i}.${field.key}`}
                    errors={fieldErrors}
                    value={r[field.key]}
                    options={viewOptions}
                    prefix=""
                    change={(v) => {
                      clearError(`${g.key}.${i}.${field.key}`);
                      setDraft({
                        ...draft,
                        [g.key]: draft[g.key].map((x, n) =>
                          n === i ? { ...x, [field.key]: v } : x,
                        ),
                      });
                    }}
                  />
                ))}
            </div>
            {g.fields.some((f) => f.key === "source_id") && (
              <details>
                <summary>Legacy source and review date · optional</summary>
                {g.fields
                  .filter((f) => ["source_id", "last_verified_at"].includes(f.key))
                  .map((field) => (
                    <Input
                      key={field.key}
                      field={field}
                      path={`${g.key}.${i}.${field.key}`}
                      errors={fieldErrors}
                      value={r[field.key]}
                      options={viewOptions}
                      prefix=""
                      change={(v) => {
                        clearError(`${g.key}.${i}.${field.key}`);
                        setDraft({
                          ...draft,
                          [g.key]: draft[g.key].map((row, n) =>
                            n === i ? { ...row, [field.key]: v } : row,
                          ),
                        });
                      }}
                    />
                  ))}
              </details>
            )}
            <button
              type="button"
              className={styles.quiet}
              onClick={() =>
                setDraft({
                  ...draft,
                  [g.key]: draft[g.key].filter((_, n) => n !== i),
                })
              }
            >
              Remove {g.label.toLowerCase()} {i + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.quiet}
          disabled={empty}
          onClick={() =>
            setDraft({
              ...draft,
              [g.key]: [
                ...draft[g.key],
                emptyRow(
                  g.fields,
                  ["sources", "aliases", "links", "experiences"].includes(g.key),
                ),
              ],
            })
          }
        >
          Add {g.label.toLowerCase()}
        </button>
      </fieldset>
    );
  };

  if (denied)
    return (
      <>
        <h1>Shop administration</h1>
        <NoticeBar notice={notice} busy={busy} inner={noticeRef} />
      </>
    );

  if (!id)
    return (
      <>
        <h1>Shop administration</h1>
        <NoticeBar notice={notice} busy={busy} inner={noticeRef} />
        <form
          className={styles.toolbar}
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const result = await api(`?q=${encodeURIComponent(query)}`, signal());
              setList(decodeList(result.entries));
              setCursor(result.nextCursor);
              setCommittedQuery(query);
            });
          }}
        >
          <label>
            Find a shop
            <input value={query} maxLength={120} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <button disabled={busy}>Search</button>
        </form>
        <ul className={styles.list}>
          {list.map((s) => (
            <li key={s.id}>
              <a href={`/admin/shops/${s.id}`}>{s.name}</a>
              <span>
                {s.publicationStatus} · {s.operationalStatus.replaceAll("_", " ")}
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
        <section className={styles.createPanel}>
          <h2>Add a shop</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void run(async () => {
                const result = decodeShop(
                  await api("", signal(), {
                    action: "create",
                    id: crypto.randomUUID(),
                    document: { name: form.get("name"), slug: form.get("slug") },
                  }),
                );
                // Native entry gives browser Back a document boundary for beforeunload.
                window.location.assign(`/admin/shops/${result.id}`);
              });
            }}
          >
            <fieldset disabled={busy}>
              <legend>New shop</legend>
              <div className={styles.field}>
                {/* The hint sits outside the label so it describes the field
                    without becoming part of its accessible name. */}
                <label htmlFor="new-shop-name">Shop name</label>
                <input
                  id="new-shop-name"
                  name="name"
                  data-field-path="name"
                  required
                  maxLength={300}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="new-shop-slug">URL name · optional</label>
                <input
                  id="new-shop-slug"
                  name="slug"
                  data-field-path="slug"
                  maxLength={120}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  aria-describedby="new-shop-slug-hint"
                />
                <small id="new-shop-slug-hint">
                  Left blank, a stable URL name is generated for you.
                </small>
              </div>
              <p>
                A draft is private and includes a generated Atlas Stamp. Add researched
                shop details before publication.
              </p>
              <button className={styles.primary}>
                {busy ? "Creating…" : "Create draft"}
              </button>
            </fieldset>
          </form>
        </section>
      </>
    );

  if (!record || !draft)
    return (
      <>
        <h1>Shop administration</h1>
        <NoticeBar notice={notice} busy={busy} inner={noticeRef} />
      </>
    );

  const archived = record.publicationStatus === "archived";
  const locked = busy || archived;
  const active = SECTIONS.find((s) => s.id === section)!;
  const errorSections = new Set(fieldErrors.map((e) => sectionForPath(e.path)));
  // The checks and this routing both describe the saved version, which is what
  // the Review copy promises; an unsaved edit must not move where Fix lands.
  const blockerSections = new Set(
    record.publicationErrors.map((e) => sectionForFix(publicationFix(e, record.document))),
  );
  const stateLabel = `${record.publicationStatus}${record.hasChanges ? " · saved changes" : ""}${
    dirty ? " · unsaved edits" : ""
  }`;
  const save = (destination: "stay" | "review") => void mutate("save", destination);

  return (
    <>
      <header className={styles.top}>
        <div>
          <p className={styles.crumb}>
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
          </p>
          <h1>{String(draft.shop.name) || "Untitled shop"}</h1>
          <p className={styles.state}>
            <span className={styles.badge}>{stateLabel}</span>
            {record.publicationStatus === "published" && (
              <a href={`/shops/${String(record.document.shop.slug)}`}>View public page</a>
            )}
          </p>
        </div>
      </header>

      <nav className={styles.nav} aria-label="Editor sections">
        {SECTIONS.map((s, index) => (
          <button
            key={s.id}
            type="button"
            className={styles.navItem}
            aria-current={s.id === section ? "step" : undefined}
            onClick={() => go(s.id)}
          >
            <span className={styles.navIndex}>{index + 1}</span>
            <span>{s.title}</span>
            {errorSections.has(s.id) && (
              <span className={styles.flagError} aria-label="has errors to correct">
                !
              </span>
            )}
            {!errorSections.has(s.id) && blockerSections.has(s.id) && (
              <span className={styles.flagBlocker} aria-label="blocks publication">
                •
              </span>
            )}
          </button>
        ))}
      </nav>

      <NoticeBar notice={notice} busy={busy} inner={noticeRef} />

      {fieldErrors.length > 0 && (
        <ul className={styles.fieldErrors} aria-label="Fields to correct">
          {fieldErrors.map((error, index) => (
            <li key={index}>
              <button
                type="button"
                onClick={() => {
                  setSection(sectionForPath(error.path));
                  setFocusTarget({ path: error.path });
                }}
              >
                {fieldLabel(error.path)}: {error.message}
              </button>
            </li>
          ))}
        </ul>
      )}

      <section className={styles.panel} aria-labelledby="shop-section-heading">
        <h2 id="shop-section-heading" tabIndex={-1}>
          {active.title}
        </h2>
        <p className={styles.sectionIntro}>{active.intro}</p>

        {archived && (
          <p className={styles.archived} role="status">
            This shop is archived and read-only. Collected impressions are preserved.
          </p>
        )}

        {section === "photos" ? (
          <ShopMediaAdmin
            key={`media-${record.id}`}
            shopId={record.id}
            shopName={String(record.document.shop.name)}
            published={record.publicationStatus === "published"}
            archived={archived}
            role={role}
            onSummary={updateMediaSummary}
          />
        ) : section === "stamp" ? (
          <ShopStampAdmin
            key={`stamp-${record.id}`}
            shopId={record.id}
            shopName={String(record.document.shop.name)}
            localityName={
              options.localities
                ?.find((o) => o.id === record.document.shop.locality_id)
                ?.label.replace(/ \([A-Z]{2}\)$/, "") ?? ""
            }
            countryCode={String(record.document.shop.country_code ?? "")}
            archived={archived}
            onPrepared={async () => {
              const current = decodeShop(await api(`/${id}`, signal()));
              // Preparing art changes no catalogue document. Refresh blockers only
              // for this saved revision, never replace unsaved or concurrent edits.
              setRecord((previous) =>
                previous?.revision === current.revision
                  ? { ...previous, publicationErrors: current.publicationErrors }
                  : previous,
              );
            }}
          />
        ) : section === "review" ? (
          <ReviewSection
            record={record}
            options={options}
            media={media}
            mediaCheck={mediaCheck}
            busy={busy}
            dirty={dirty}
            previewWidth={previewWidth}
            setPreviewWidth={setPreviewWidth}
            onFix={(requirement) => {
              const fix = publicationFix(requirement, record.document);
              setSection(sectionForFix(fix));
              setFocusTarget(fix);
            }}
            onConfirm={setConfirmation}
            onOpenPhotos={() => go("photos")}
            onRecheckMedia={() => setMediaCheck("pending")}
            onReload={() => {
              if (!dirty || window.confirm("Discard your unsaved edits and reload?"))
                void run(async () => {
                  const r = decodeShop(await api(`/${id}`, signal()));
                  setRecord(r);
                  setDraft(r.document);
                  announce({ tone: "ok", text: "Loaded the saved version." });
                });
            }}
            legacy={
              <fieldset disabled={locked} className={styles.plain}>
                <legend className={styles.hidden}>Legacy provenance</legend>
                {LEGACY_FIELDS.map((key) => shopField(key))}
                {LEGACY_GROUPS.map((key) => groupEditor(key))}
              </fieldset>
            }
          />
        ) : (
          <form
            id="shop-editor"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              save("stay");
            }}
          >
            <fieldset disabled={locked} className={styles.plain}>
              <legend className={styles.hidden}>{active.title}</legend>
              <div className={styles.grid}>
                {SECTION_FIELDS[section]
                  .filter((key) => !["latitude", "longitude", "position_precision"].includes(key))
                  .map((key) => shopField(key))}
              </div>

              {section === "location" && (
                <div className={styles.box}>
                  <h3>Map position</h3>
                  <p className={styles.help}>
                    Zero is a valid coordinate. Decimal precision is not proof of
                    accuracy — say whether this is the shop itself or the surrounding
                    area.
                  </p>
                  <div className={styles.grid}>
                    {["latitude", "longitude", "position_precision"].map((key) =>
                      shopField(key),
                    )}
                  </div>
                  <p className={styles.help}>
                    {record.positionConfirmed
                      ? "The saved position is confirmed."
                      : "The saved position is not confirmed yet."}{" "}
                    Changing the address, coordinates or accuracy clears the previous
                    confirmation, so confirm again after a correction.
                  </p>
                  <button
                    id="confirm-shop-position"
                    type="button"
                    disabled={
                      busy ||
                      dirty ||
                      archived ||
                      record.document.shop.latitude == null ||
                      record.document.shop.longitude == null
                    }
                    onClick={() => setConfirmation("confirm_position")}
                  >
                    Confirm saved shop position
                  </button>
                  {dirty && (
                    <small>
                      Save your edits first — confirmation applies to the saved position.
                    </small>
                  )}
                </div>
              )}

              {section === "visit" && <HoursEditor draft={draft} errors={fieldErrors} setShop={setShop} />}

              {SECTION_GROUPS[section].map((key) => groupEditor(key))}

              {section === "story" && (
                <details className={styles.private}>
                  <summary>Internal admin notes · private</summary>
                  <p>
                    Only editors and admins can read these. They never appear in the
                    public page, its HTML or any visitor API response. One reference link
                    per line. All optional.
                  </p>
                  {PRIVATE_FIELDS.map((key) => shopField(key))}
                </details>
              )}
            </fieldset>
          </form>
        )}
      </section>

      <div className={styles.actionBar}>
        <p className={styles.actionState} role="status">
          {busy
            ? "Working…"
            : dirty
              ? "Unsaved changes"
              : record.hasChanges
                ? "Saved privately"
                : "All details saved"}
        </p>
        <div className={styles.actionButtons}>
          {dirty && !archived && (
            <button
              type="button"
              aria-busy={busy || undefined}
              disabled={busy}
              onClick={() => save("stay")}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          )}
          {(dirty || section !== "review") && (
            <button
              type="button"
              className={styles.primary}
              aria-busy={busy || undefined}
              disabled={busy || (dirty && archived)}
              onClick={() => (dirty ? save("review") : go("review"))}
            >
              {busy ? "Saving…" : dirty ? "Save and review" : "Review and publish"}
            </button>
          )}
        </div>
      </div>

      {confirmation && (
        <ConfirmDialog
          action={confirmation}
          busy={busy}
          fallback={noticeRef}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void mutate(confirmation)}
        />
      )}
    </>
  );
}

function NoticeBar({
  notice,
  busy,
  inner,
}: {
  notice: Notice;
  busy: boolean;
  inner: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={inner}
      tabIndex={-1}
      className={`${styles.notice} ${notice?.tone === "error" ? styles.noticeError : notice ? styles.noticeOk : styles.noticeIdle}`}
    >
      <p role={notice?.tone === "error" ? "alert" : "status"} aria-live="polite">
        {notice?.text ||
          (busy ? "Working…" : "Enter what you know. Leave unknown information blank.")}
      </p>
    </div>
  );
}

function HoursEditor({
  draft,
  errors,
  setShop,
}: {
  draft: Document;
  errors: FieldIssue[];
  setShop: (key: string, value: Value) => void;
}) {
  const hours = (draft.shop.opening_hours as Row | null) ?? {};
  const entries = (hours.entries ?? []) as Row[];
  return (
    <div className={styles.box} data-field-path="shop.opening_hours" tabIndex={-1}>
      <h3>Opening hours</h3>
      <p className={styles.help}>
        Record only hours you have checked. A day with no entry stays unknown, which is
        different from closed. Split and overnight spans are kept: add more than one
        entry for the same day.
      </p>
      <div className={styles.field}>
        <label htmlFor="hours-summary">Hours summary · optional</label>
        <input
          id="hours-summary"
          data-field-path="shop.opening_hours.note"
          value={String(hours.note ?? "")}
          onChange={(e) =>
            setShop("opening_hours", { ...hours, note: e.target.value || null })
          }
        />
      </div>
      {entries.map((r, i) => (
        <div className={styles.card} key={i}>
          <div className={styles.grid}>
            {HOURS_FIELDS.map((field) => (
              <Input
                key={field.key}
                field={field}
                path={`shop.opening_hours.entries.${i}.${field.key}`}
                errors={errors}
                value={r[field.key]}
                options={{}}
                prefix=""
                change={(v) =>
                  setShop("opening_hours", {
                    ...hours,
                    entries: entries.map((x, n) => (n === i ? { ...x, [field.key]: v } : x)),
                  })
                }
              />
            ))}
          </div>
          <button
            type="button"
            className={styles.quiet}
            onClick={() =>
              setShop("opening_hours", {
                ...hours,
                entries: entries.filter((_, n) => n !== i),
              })
            }
          >
            Remove hours {i + 1}
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.quiet}
        onClick={() =>
          setShop("opening_hours", {
            ...hours,
            entries: [...entries, emptyRow(HOURS_FIELDS)],
          })
        }
      >
        Add hours
      </button>
    </div>
  );
}

function ReviewSection({
  record,
  options,
  media,
  mediaCheck,
  busy,
  dirty,
  previewWidth,
  setPreviewWidth,
  onFix,
  onConfirm,
  onReload,
  onOpenPhotos,
  onRecheckMedia,
  legacy,
}: {
  record: ShopRecord;
  options: Options;
  media: MediaSummary | null;
  mediaCheck: "pending" | "failed";
  busy: boolean;
  dirty: boolean;
  previewWidth: "desktop" | "mobile";
  setPreviewWidth: (v: "desktop" | "mobile") => void;
  onFix: (requirement: string) => void;
  onConfirm: (action: string) => void;
  onReload: () => void;
  onOpenPhotos: () => void;
  onRecheckMedia: () => void;
  legacy: ReactNode;
}) {
  const archived = record.publicationStatus === "archived";
  const ready = record.publicationErrors.length === 0;
  return (
    <>
      {dirty && (
        <p className={styles.pending} role="status">
          You have unsaved edits. This preview and the checks below describe the{" "}
          <strong>saved</strong> version. Use <strong>Save and review</strong> to include
          your edits.
        </p>
      )}

      <div className={styles.box}>
        <h3>Before publishing</h3>
        {ready ? (
          <p className={styles.ready}>
            Nothing is blocking publication of the saved version.
          </p>
        ) : (
          <ul className={styles.blockers}>
            {record.publicationErrors.map((e) => (
              <li key={e}>
                <span>{e}</span>
                <button type="button" onClick={() => onFix(e)}>
                  Fix
                </button>
              </li>
            ))}
          </ul>
        )}
        {media && (
          <p className={styles.mediaSummary}>
            Images: {media.total} saved · {media.published} shown on the public page
            {media.total > media.published ? (
              <>
                {" "}· {media.total - media.published} private. Optional — photos never
                block publication, and a private image is never published by saving or
                publishing the shop.
              </>
            ) : null}
          </p>
        )}
        {!media && mediaCheck === "pending" && (
          <p className={styles.mediaSummary}>
            Checking which images are visible on the public page…
          </p>
        )}
        {!media && mediaCheck === "failed" && (
          <p className={styles.mediaSummary} role="status">
            Could not check which images are on the public page.{" "}
            <button type="button" className={styles.quiet} onClick={onRecheckMedia}>
              Check again
            </button>
          </p>
        )}
        <button type="button" className={styles.quiet} onClick={onOpenPhotos}>
          Go to Photos &amp; logo
        </button>
      </div>

      <div className={styles.previewHead}>
        <h3>Public page preview</h3>
        <div className={styles.toggle} role="group" aria-label="Preview width">
          {(["desktop", "mobile"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={previewWidth === v}
              onClick={() => setPreviewWidth(v)}
            >
              {v === "desktop" ? "Desktop" : "Mobile"}
            </button>
          ))}
        </div>
      </div>
      <div className={previewWidth === "mobile" ? styles.previewMobile : undefined}>
        <Preview document={record.document} options={options} />
      </div>

      <section className={styles.operations} id="shop-publication" tabIndex={-1}>
        <h3>Publish</h3>
        <p>
          Publication controls public visibility. Operational status records whether the
          shop is open or closed. Archiving is permanent in this interface. Existing
          impressions keep their original names, places and artwork. Your account and the
          actual review time are recorded; that is an editorial review, not independent
          verification of every field.
        </p>
        <div className={styles.toolbar}>
          {!archived && (
            <>
              <button
                className={styles.primary}
                disabled={
                  busy ||
                  dirty ||
                  !ready ||
                  (!record.hasChanges && record.publicationStatus === "published")
                }
                onClick={() => onConfirm("publish")}
              >
                {record.publicationStatus === "published"
                  ? "Publish saved changes"
                  : "Publish shop"}
              </button>
              {record.hasChanges && (
                <button disabled={busy || dirty} onClick={() => onConfirm("discard")}>
                  Discard saved changes
                </button>
              )}
              {record.publicationStatus === "published" &&
                ["temporarily_closed", "permanently_closed", "open", "unknown"]
                  .filter((s) => s !== record.document.shop.operational_status)
                  .map((s) => (
                    <button
                      key={s}
                      disabled={busy || dirty || record.hasChanges}
                      onClick={() => onConfirm(s)}
                    >
                      Mark {s.replaceAll("_", " ")}
                    </button>
                  ))}
              <button
                disabled={busy || dirty || record.hasChanges}
                onClick={() => onConfirm("archive")}
              >
                Archive shop
              </button>
            </>
          )}
          <button disabled={busy} onClick={onReload}>
            Reload saved version
          </button>
        </div>
      </section>

      <details className={styles.private}>
        <summary>Legacy provenance · retained, not required</summary>
        <p>
          Preserved for existing records. No classification, source or evidence token is
          required to publish. Nothing here is created or backfilled for you.
        </p>
        {legacy}
      </details>
    </>
  );
}

const CONFIRMATIONS: Record<string, { title: string; body: string; verb: string }> = {
  publish: {
    title: "Publish this shop?",
    body: "The saved listing becomes public. Your account and the actual review time are recorded. This does not certify every field independently.",
    verb: "Publish",
  },
  confirm_position: {
    title: "Confirm the saved position?",
    body: "You are attesting that you checked the saved address, coordinates and stated accuracy against the shop's location.",
    verb: "Confirm position",
  },
  discard: {
    title: "Discard saved changes?",
    body: "The private saved changes are removed and the shop returns to its last published content. This cannot be undone.",
    verb: "Discard changes",
  },
  archive: {
    title: "Archive this shop?",
    body: "The shop leaves public discovery and its public page. Archiving is permanent in this interface. Collected impressions are preserved.",
    verb: "Archive shop",
  },
};

function ConfirmDialog({
  action,
  busy,
  fallback,
  onCancel,
  onConfirm,
}: {
  action: string;
  busy: boolean;
  /** Where focus goes when the trigger is gone, rather than the document top. */
  fallback: RefObject<HTMLElement | null>;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = CONFIRMATIONS[action] ?? {
    title: `Mark ${action.replaceAll("_", " ")}?`,
    body: "Use this only when supported by your source or visit. Collected impressions are preserved.",
    verb: `Mark ${action.replaceAll("_", " ")}`,
  };
  const box = useRef<HTMLDivElement>(null);
  // Confirming closes the dialog and the outcome is announced in the notice
  // region, so the dialog never sits open over a request it cannot report on.
  useDialog(box, onCancel, fallback);
  return (
    <div className={styles.scrim} onMouseDown={onCancel}>
      <div
        ref={box}
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-label={copy.title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2>{copy.title}</h2>
        <p>{copy.body}</p>
        <div className={styles.dialogActions}>
          <button autoFocus className={styles.primary} disabled={busy} onClick={onConfirm}>
            {copy.verb}
          </button>
          <button disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
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
    <article className={styles.preview} aria-label="Public page preview">
      <p>
        <strong>Private catalogue preview</strong> · Unpublished changes are visible only
        to editors and admins.
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
      <ShopEditorial
        content={decodeEditorialContent({ ...d.shop, experiences: d.experiences })}
        section="story"
      />
      <ShopEditorial
        content={decodeEditorialContent({ ...d.shop, experiences: d.experiences })}
        section="visit"
      />
      {d.shop.phone && <p>Phone: {String(d.shop.phone)}</p>}
      {d.shop.postal_code && <p>Postal code: {String(d.shop.postal_code)}</p>}
      {d.shop.position_precision === "locality" && (
        <p>Approximate area only. Check the shop’s address before travelling.</p>
      )}
      <p>
        {name("localities", d.shop.locality_id) ??
          String(d.shop.city_display ?? d.shop.country_code ?? "Place not yet recorded")}
      </p>
      {[d.shop.address_line_1, d.shop.address_line_2].filter(Boolean).map((a, i) => (
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
      {d.services.map((r) => (
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
          {(((d.shop.opening_hours as Row).entries as Row[]) ?? []).map((r, i) => (
            <p key={i}>
              {String(r.day)}:{" "}
              {r.closed ? "Closed" : r.opens ? `${r.opens}–${r.closes}` : "Hours not recorded"}
              {r.note ? ` · ${r.note}` : ""}
            </p>
          ))}
          {(d.shop.opening_hours as Row).note && (
            <p>{String((d.shop.opening_hours as Row).note)}</p>
          )}
        </section>
      )}
      {d.sources.length > 0 && (
        <>
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
        </>
      )}
      {d.shop.source_quality === "demo" && <p>Demo data — not a verified shop listing.</p>}
      <p>
        Private notes and references are omitted here. Publication records an editorial
        review, not independent verification of every field. Photos, logo and stamp
        artwork have their own controls and are not published by saving this page.
      </p>
    </article>
  );
}

function fieldLabel(path: string): string {
  const parts = path.split(".");
  if (parts[0] === "shop" && parts[1] !== "opening_hours")
    return SHOP_FIELDS.find((f) => f.key === parts[1])?.label ?? "Shop";
  if (parts[1] === "opening_hours")
    return parts[2] === "entries"
      ? `Hours ${Number(parts[3]) + 1} · ${HOURS_FIELDS.find((f) => f.key === parts[4])?.label ?? "entry"}`
      : "Hours summary";
  const g = GROUPS.find((g) => g.key === parts[0]);
  return g
    ? `${g.label}${parts[1] ? ` ${Number(parts[1]) + 1}` : ""}${parts[2] ? ` · ${g.fields.find((f) => f.key === parts[2])?.label ?? "item"}` : ""}`
    : parts[0] === "name"
      ? "Shop name"
      : parts[0] === "slug"
        ? "URL name"
        : "Record";
}

function VocabularyCreator({
  kind,
  busy,
  create,
}: {
  kind: "brands" | "specialties" | "types" | "localities";
  busy: boolean;
  create: (label: string) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const name = {brands:"brand",specialties:"specialty",types:"shop type",localities:"locality"}[kind];
  return (
    <div className={styles.vocabulary}>
      <label>
        New {name} name
        <input
          value={label}
          maxLength={300}
          disabled={busy}
          onChange={(e) => setLabel(e.target.value)}
        />
      </label>
      <button
        type="button"
        className={styles.quiet}
        disabled={busy || !label.trim()}
        onClick={() => void create(label)}
      >
        Add or reuse {name}
      </button>
      <small>
        Existing names are reused. New names become catalogue choices; the shop selection
        stays private until you save and publish.
      </small>
    </div>
  );
}
