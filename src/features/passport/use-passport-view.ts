"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useCollection } from "@/src/features/collection/collection-store";
import { useReviewerModeStore } from "@/src/features/reviewer/ReviewerModeProvider";
import {
  EMPTY_PASSPORT_VIEW,
  mergePassportView,
  parsePassportView,
  passportViewStorageKey,
  resolvePassportMode,
  serializePassportView,
  type PassportMode,
  type PassportPlace,
  type PassportViewRecord,
} from "@/src/features/passport/passport-view-state";

export interface PassportViewStore {
  /** The mode to render: the reader's choice, or the audience default. */
  readonly mode: PassportMode;
  /** True once the device's own record has been read. */
  readonly hydrated: boolean;
  /** Whether this device has already opened the cover once. */
  readonly coverSeen: boolean;
  /** The last spread read, or `null` before the book has been opened. */
  readonly place: PassportPlace | null;
  readonly listScrollTop: number;
  /** Records an explicit toggle. The only thing that writes `mode`. */
  chooseMode(mode: PassportMode): void;
  markCoverSeen(): void;
  rememberPlace(place: PassportPlace | null): void;
  rememberListScrollTop(offset: number): void;
}

/**
 * The Passport's remembered view state, for one device and one audience.
 *
 * Held as a hook rather than a provider because exactly one screen needs it and
 * a second reader would mean two copies of the same storage. It resolves after
 * mount for the same reason the collection store does: local storage cannot be
 * read during the server render, and reviewer mode has not settled on the first
 * client paint.
 *
 * Nothing is written on mount. A device that has never used the toggle keeps
 * `mode: null` on disk, so the audience default stays a default rather than
 * becoming a choice the reader never made.
 *
 * ## Two tabs, one record
 *
 * `localStorage` is shared, so a second tab is not a hypothetical. Two rules
 * keep them honest, and both are needed:
 *
 * - **Every write is a patch against what is stored**, re-read immediately
 *   beforehand. A tab that wrote its whole in-memory snapshot would undo
 *   whatever another tab had changed since it last looked — the classic case is
 *   a tab that has been open since before the reader chose Book, whose next
 *   scroll would write `mode: null` back over that choice.
 * - **Changes made elsewhere are adopted.** Without this the *stale* tab wins
 *   the moment the reader touches it: it would keep rendering List after the
 *   other tab chose Book, and show the cover again after the other tab opened
 *   it. `storage` fires only in the tabs that did not make the change, so this
 *   never runs against its own write, and `lastWrittenRef` absorbs the echo
 *   that comes back when the other tab persists what it adopted.
 *
 * The reviewer and normal records live under different keys, so neither rule
 * can carry one audience's state into the other's.
 */
export function usePassportView(): PassportViewStore {
  const { reviewer, resolved } = useReviewerModeStore();
  const { scope, source } = useCollection();
  const accountMode = source === 'account';

  const [record, setRecord] = useState<PassportViewRecord>(EMPTY_PASSPORT_VIEW);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  /**
   * The record as last written, for the callbacks.
   *
   * Kept in step at every place the record changes — hydration, `commit`, and an
   * adopted change from another tab — rather than during render, so a second
   * update in the same tick still reads what the first one wrote.
   */
  const recordRef = useRef(record);
  /**
   * The exact bytes this tab last wrote.
   *
   * Writing to `localStorage` notifies every *other* tab, and each of those will
   * write the adopted value back. Without this the two would answer each other
   * indefinitely; with it, a tab ignores a value it already holds.
   */
  const lastWrittenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!resolved || hydratedFor === scope) {
      return;
    }

    let stored = EMPTY_PASSPORT_VIEW;

    try {
      stored = parsePassportView(
        window.localStorage.getItem(passportViewStorageKey(scope)),
      );
    } catch {
      // Blocked site data. A device that cannot remember has not chosen, which
      // is the safe direction: the audience default applies.
    }

    // A UI mode is a device preference; an account's last visited place is
    // private history. Keep the latter in this owner-scoped mounted tree only.
    if (accountMode) stored = { ...stored, place:null, listScrollTop:0 };

    /* eslint-disable react-hooks/set-state-in-effect --
       Local storage is an external system that can only be read after mount;
       this is the documented "subscribe to an external store" case. */
    recordRef.current = stored;
    setRecord(stored);
    setHydratedFor(scope);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [accountMode, hydratedFor, resolved, scope]);

  const commit = useCallback(
    (patch: Partial<PassportViewRecord>) => {
      const key = passportViewStorageKey(scope);
      let stored = recordRef.current;

      try {
        // Re-read rather than trusting this tab's copy: another tab may have
        // changed a field this patch does not name.
        stored = parsePassportView(window.localStorage.getItem(key));
        if (accountMode) stored = { ...stored, place:recordRef.current.place, listScrollTop:recordRef.current.listScrollTop };
      } catch {
        // Storage is unreadable; the in-memory record is the best base there is.
      }

      const next = mergePassportView(stored, {
        ...patch,
        /*
         * An opened cover is durable in both directions.
         *
         * `mergePassportView` keeps a stored `true` against a patch that says
         * otherwise; this keeps it against *storage* that says otherwise. The
         * application itself cannot produce that state — every write merges —
         * but a rewritten or partially restored record can, and showing the
         * first-run ceremony a second time is the one outcome worth ruling out.
         */
        ...(recordRef.current.coverSeen ? { coverSeen: true } : {}),
      });
      const serialized = serializePassportView(accountMode ? {...next,place:null,listScrollTop:0} : next);

      recordRef.current = next;
      setRecord(next);

      try {
        window.localStorage.setItem(key, serialized);
        lastWrittenRef.current = serialized;
      } catch {
        // Best effort: the choice still applies for this page view.
      }
    },
    [accountMode, scope],
  );

  /**
   * Adopt what another tab did to this record.
   *
   * Scoped to this audience's key. A `null` key is `localStorage.clear()` — the
   * whole area went, this record with it — and resolves to "nothing remembered",
   * which is the same as a device that has never chosen.
   */
  useEffect(() => {
    if (hydratedFor !== scope || typeof window === "undefined") {
      return;
    }

    const key = passportViewStorageKey(scope);

    function onStorage(event: StorageEvent) {
      if (event.key !== null && event.key !== key) {
        return;
      }

      if (event.storageArea && event.storageArea !== window.localStorage) {
        return;
      }

      let next = EMPTY_PASSPORT_VIEW;

      try {
        next = parsePassportView(window.localStorage.getItem(key));
      } catch {
        // Unreadable storage resolves to nothing remembered.
      }

      if (accountMode) next = {...next,place:recordRef.current.place,listScrollTop:recordRef.current.listScrollTop};
      const serialized = serializePassportView(accountMode ? {...next,place:null,listScrollTop:0} : next);

      // Already held — usually the echo of a value this tab wrote, or of one it
      // has already adopted. Writing it back would bounce the event home.
      if (serialized === lastWrittenRef.current) {
        return;
      }

      lastWrittenRef.current = serialized;
      recordRef.current = next;
      setRecord(next);
    }

    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [accountMode, hydratedFor, scope]);

  const chooseMode = useCallback(
    (mode: PassportMode) => commit({ mode }),
    [commit],
  );

  const markCoverSeen = useCallback(() => {
    if (recordRef.current.coverSeen) {
      return;
    }

    commit({ coverSeen: true });
  }, [commit]);

  const rememberPlace = useCallback(
    (place: PassportPlace | null) => {
      const current = recordRef.current.place;

      // Skip a write that changes nothing, so paging back and forth over the
      // same spread does not hammer storage.
      if (JSON.stringify(current) === JSON.stringify(place)) {
        return;
      }

      commit({ place });
    },
    [commit],
  );

  const rememberListScrollTop = useCallback(
    (offset: number) => {
      const rounded = Math.max(0, Math.round(offset));

      if (recordRef.current.listScrollTop === rounded) {
        return;
      }

      commit({ listScrollTop: rounded });
    },
    [commit],
  );

  const hydrated = hydratedFor === scope;

  return useMemo<PassportViewStore>(
    () => ({
      mode: resolvePassportMode({ stored: record.mode, reviewer }),
      hydrated,
      coverSeen: record.coverSeen,
      place: record.place,
      listScrollTop: record.listScrollTop,
      chooseMode,
      markCoverSeen,
      rememberPlace,
      rememberListScrollTop,
    }),
    [
      chooseMode,
      hydrated,
      markCoverSeen,
      record.coverSeen,
      record.listScrollTop,
      record.mode,
      record.place,
      rememberListScrollTop,
      rememberPlace,
      reviewer,
    ],
  );
}
