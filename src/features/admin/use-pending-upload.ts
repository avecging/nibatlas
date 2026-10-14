"use client";
import { useEffect, useSyncExternalStore } from 'react';
// Shared only inside this browser tab; no image bytes or account data are stored.
const pending = new Set<symbol>();
const listeners = new Set<() => void>();
const changed = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useHasPendingUploads() {
  return useSyncExternalStore(subscribe, () => pending.size > 0, () => false);
}
/** A selected file is not durable until attachment succeeds. */
export function usePendingUpload(selected: boolean) {
  useEffect(() => {
    if (!selected) return;
    const token = Symbol(); pending.add(token); changed();
    return () => { pending.delete(token); changed(); };
  }, [selected]);
}
