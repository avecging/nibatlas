/**
 * What the Passport remembers about how it was last read.
 *
 * Two modes now present one collection: List is the accessible browsing
 * baseline, Book is the object. Which one a reader gets, where the book was
 * left, and how far the list was scrolled are all device state, so they follow
 * the same rules as the collection stores in
 * `src/features/collection/collection-store.tsx`:
 *
 * - **A default is not a choice.** A device that has never used the toggle has
 *   `mode: null`, and the default is computed from the audience every time.
 *   Writing the default down would make a later change of default silently
 *   ineffective, and would tell a reviewer the reader had picked List when they
 *   had picked nothing.
 * - **Namespaced by audience.** Normal mode defaults to List and reviewer mode
 *   may default to Book, so the two cannot share one record without one
 *   audience's default leaking into the other's choice.
 * - **Stable identifiers, never display strings.** The remembered place is a
 *   country code and a locality slug, not a page number and not "Ginza, Tokyo".
 *   Page numbers move as the collection grows, and a label can be re-worded.
 * - **Anything unparseable is nothing.** A hand-edited value, a record written
 *   by a future version, or a locality that has since been cleared all resolve
 *   to "no memory", which lands the reader on the opening spread rather than on
 *   an error.
 *
 * This module is deliberately pure so all of that is testable without a
 * browser; `PassportViewProvider` owns the storage.
 */
import type { CollectionScope } from "@/src/features/collection/collection-store";

export type PassportMode = "list" | "book";

const MODES = new Set<string>(["list", "book"]);

/**
 * Where the book was left, expressed as content rather than as geometry.
 *
 * `front` is the identity and contents front matter, `seals` the country-seal
 * page, and `locality` a specific locality's pages. Resolving one of these to a
 * page index is `passport-pages.ts`'s job, and a `locality` that no longer
 * exists resolves to nothing.
 */
export type PassportPlace =
  | { readonly kind: "front" }
  | { readonly kind: "seals" }
  | {
      readonly kind: "locality";
      readonly countryCode: string;
      readonly localitySlug: string;
    };

export interface PassportViewRecord {
  /** The reader's explicit toggle choice. `null` means they have never used it. */
  readonly mode: PassportMode | null;
  /** Whether the cover has already been opened once on this device. */
  readonly coverSeen: boolean;
  /** The last spread read, or `null` before the book has been opened. */
  readonly place: PassportPlace | null;
  /** Last List-mode scroll offset in CSS pixels. */
  readonly listScrollTop: number;
}

export const EMPTY_PASSPORT_VIEW: PassportViewRecord = {
  mode: null,
  coverSeen: false,
  place: null,
  listScrollTop: 0,
};

const STORAGE_KEYS: Record<CollectionScope, string> = {
  normal: "nib-atlas.passport-view.v1",
  reviewer: "nib-atlas.passport-view.reviewer.v1",
};

export function passportViewStorageKey(scope: CollectionScope): string {
  return STORAGE_KEYS[scope];
}

/**
 * The default when the reader has never chosen.
 *
 * Reviewer mode gets the Book because the physical interaction is what the
 * founder and Codex are there to review; everyone else gets the List, which is
 * where finding things happens. An explicit choice outranks both.
 */
export function defaultPassportMode(reviewer: boolean): PassportMode {
  return reviewer ? "book" : "list";
}

export function resolvePassportMode({
  stored,
  reviewer,
}: {
  readonly stored: PassportMode | null;
  readonly reviewer: boolean;
}): PassportMode {
  return stored ?? defaultPassportMode(reviewer);
}

function parseMode(value: unknown): PassportMode | null {
  return typeof value === "string" && MODES.has(value) ? (value as PassportMode) : null;
}

function parsePlace(value: unknown): PassportPlace | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (candidate.kind === "front" || candidate.kind === "seals") {
    return { kind: candidate.kind };
  }

  if (
    candidate.kind === "locality" &&
    typeof candidate.countryCode === "string" &&
    candidate.countryCode.length > 0 &&
    typeof candidate.localitySlug === "string" &&
    candidate.localitySlug.length > 0
  ) {
    return {
      kind: "locality",
      // Upper-cased and lower-cased to the canonical forms the domain uses, so
      // a record written by hand still matches.
      countryCode: candidate.countryCode.toUpperCase(),
      localitySlug: candidate.localitySlug.toLowerCase(),
    };
  }

  return null;
}

function parseScrollTop(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.round(value);
}

export function parsePassportView(
  raw: string | null | undefined,
): PassportViewRecord {
  if (!raw) {
    return EMPTY_PASSPORT_VIEW;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null) {
      return EMPTY_PASSPORT_VIEW;
    }

    const candidate = parsed as Record<string, unknown>;

    return {
      mode: parseMode(candidate.mode),
      coverSeen: candidate.coverSeen === true,
      place: parsePlace(candidate.place),
      listScrollTop: parseScrollTop(candidate.listScrollTop),
    };
  } catch {
    return EMPTY_PASSPORT_VIEW;
  }
}

/**
 * One canonical serialisation.
 *
 * `mode` is written as `null` rather than omitted so a record that has a place
 * and no chosen mode is explicit about it: absent and null both parse to "never
 * chose", and neither is ever written as `"list"` on the reader's behalf.
 */
export function serializePassportView(record: PassportViewRecord): string {
  return JSON.stringify({
    mode: record.mode,
    coverSeen: record.coverSeen,
    place: record.place,
    listScrollTop: record.listScrollTop,
  } satisfies PassportViewRecord);
}

export const PASSPORT_VIEW_STORAGE_KEYS = STORAGE_KEYS;
