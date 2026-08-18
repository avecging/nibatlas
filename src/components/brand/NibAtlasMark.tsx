interface NibAtlasMarkProps {
  readonly size?: number;
  readonly title?: string;
  readonly className?: string;
}

/**
 * Provisional half-nib / half-atlas mark.
 *
 * `BRAND.md` requires a commissioned custom SVG master before public launch;
 * this is a construction-accurate placeholder for Milestone 1 layout work only.
 */
export function NibAtlasMark({ size = 28, title, className }: NibAtlasMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2.5" />
      {/* Nib half */}
      <path
        d="M24 3.2 A20.8 20.8 0 0 0 24 44.8 Z"
        fill="currentColor"
        opacity="0.12"
      />
      <path
        d="M24 4.5 L12.5 20.5 A14 14 0 0 0 24 43.5 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Atlas half: restrained latitude / longitude grid */}
      <path
        d="M24 3.2 A20.8 20.8 0 0 1 24 44.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M24 10.5 A12 20.8 0 0 1 24 37.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M24.5 13.4 H41.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M24.5 24 H45.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M24.5 34.6 H41.6" stroke="currentColor" strokeWidth="1.4" />
      {/* Breather hole and slit form the join */}
      <circle cx="24" cy="24" r="2.6" fill="var(--bg-canvas, #fbf8f1)" stroke="currentColor" strokeWidth="2" />
      <path d="M24 26.6 V44.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
