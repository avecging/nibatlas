import type { MarkerState } from "@/src/domain/shops";

/**
 * Marker silhouettes from `BRAND.md`. Status is never carried by colour alone:
 * each state has a distinct shape, and every marker exposes a text label to
 * assistive technology.
 */
export function markerGlyph(state: MarkerState, selected: boolean): string {
  const halo = selected
    ? '<circle cx="22" cy="22" r="19" fill="none" stroke="var(--focus-ring)" stroke-width="3" opacity="0.9" />'
    : "";

  if (state === "visited") {
    return `<svg class="glyph" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true" focusable="false">
      ${halo}
      <circle cx="22" cy="22" r="13" fill="currentColor" stroke="var(--paper-50)" stroke-width="2" />
      <path d="m16.5 22.3 3.7 3.7 7.4-7.6" fill="none" stroke="var(--paper-50)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>`;
  }

  if (state === "saved") {
    return `<svg class="glyph" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true" focusable="false">
      ${halo}
      <path d="M22 35.5c5.6-5.6 8.5-9.9 8.5-13.9a8.5 8.5 0 1 0-17 0c0 4 2.9 8.3 8.5 13.9Z" fill="currentColor" stroke="var(--paper-50)" stroke-width="2" />
      <path d="M19 15.5h6v8l-3-2-3 2v-8Z" fill="var(--paper-50)" />
    </svg>`;
  }

  return `<svg class="glyph" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true" focusable="false">
    ${halo}
    <path d="M22 35.5c5.6-5.6 8.5-9.9 8.5-13.9a8.5 8.5 0 1 0-17 0c0 4 2.9 8.3 8.5 13.9Z" fill="var(--paper-50)" stroke="currentColor" stroke-width="2.4" />
    <path d="M22 14.6v11.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    <circle cx="22" cy="20.4" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8" />
  </svg>`;
}

export function clusterGlyph(count: number): string {
  const radius = count >= 25 ? 19 : count >= 10 ? 17 : 15;

  return `<svg class="glyph" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true" focusable="false">
    <circle cx="22" cy="22" r="${radius}" fill="var(--atlas-900)" stroke="var(--paper-50)" stroke-width="2" />
    <circle cx="22" cy="22" r="${radius - 3.5}" fill="none" stroke="var(--paper-50)" stroke-width="1" opacity="0.55" />
  </svg>`;
}
