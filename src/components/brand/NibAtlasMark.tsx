interface NibAtlasMarkProps {
  readonly size?: number;
  readonly title?: string;
  readonly className?: string | undefined;
  /**
   * `duotone` is the primary lockup: the nib half in Atlas Navy, the atlas half
   * in the teal exploratory accent. `single` collapses both halves onto
   * `currentColor` for one-colour imprint contexts — the foil cover treatment,
   * a stamp, a favicon.
   */
  readonly tone?: "duotone" | "single";
}

/**
 * The half-nib / half-atlas mark supplied by the founder.
 *
 * This is the drawn artwork from the founder's own prototype, not a
 * reconstruction: the circle reads as globe, seal, and stamp boundary at once,
 * the nib occupies the left half, and the latitude/longitude grid the right.
 *
 * `BRAND.md` still asks for a production SVG master with simplified small-size
 * artwork before public launch. Below roughly 20 px the grid detail closes up,
 * so `single` tone and a larger size are preferred in imprint contexts.
 */
export function NibAtlasMark({
  size = 28,
  title,
  className,
  tone = "duotone",
}: NibAtlasMarkProps) {
  const nib = tone === "single" ? "currentColor" : "var(--brand-mark-nib)";
  const atlas = tone === "single" ? "currentColor" : "var(--brand-mark-atlas)";

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 203 206"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M92.5 15V93.2297C87.8831 94.7749 84.5835 99.164 84.6508 104.293C84.7166 109.316 87.9917 113.545 92.5 115.055V163H70.5C63.8971 137.075 59.5484 123.106 44 105C65.3982 78.1064 86.5 53 92.5 15Z"
        fill={nib}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M100.5 202.5C45.2715 202.5 2 158.281 2 102.5C2 46.7192 45.2715 3 100.5 3C102.401 3 104.29 3.05064 106.166 3.1507V9.62921V86.5955C106.448 86.719 106.726 86.854 107 87C111.66 89.4846 115.068 95.1759 115.595 102C115.635 102.529 115.659 103.065 115.664 103.607C115.674 104.591 115.624 105.557 115.519 106.5C114.754 113.332 111.075 118.949 106.165 121.096V195.361V202.341C104.29 202.446 102.401 202.5 100.5 202.5ZM10.5 102.5C10.5 143.261 34.4196 177.896 70.5 190.476C70.9981 190.649 71.4981 190.819 72 190.984V180.261C68.4101 180.261 65.5 177.143 65.5 173.296C65.5 169.449 68.4101 166.33 72 166.33H92.5V195.188C94.9114 195.398 97.3494 195.514 99.8103 195.532V115.055C104.427 113.51 107.727 109.121 107.66 103.991C107.597 99.2284 104.649 95.1793 100.5 93.4856C100.274 93.3932 100.044 93.3078 99.8106 93.2297V9.45822C49.3177 9.83299 10.5 51.3484 10.5 102.5Z"
        fill={nib}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M119 102.014V106.519H154.5C154.381 124.042 152.506 133.753 148 151.002L109 151.019V155.019H146.5C140.431 175.316 123.5 195.551 109 195.359V202.341C161.435 199.207 201 155.266 201 101.519C201 47.7733 161.435 6.1532 109 3.18851V9.6698C125.49 15.291 140 34.5194 145.5 52.0194H109V56.0194H147C152.747 73.9845 154.673 84.0144 154.5 101.783L119 102.014ZM194.995 101.519C194.823 84.9562 190.372 69.4305 182.706 56.0194H151.5C156.982 74.2235 158.907 84.2604 159.5 101.75L194.995 101.519ZM181.543 150.987C189.435 137.937 194.236 122.767 194.916 106.519H159.5C159.162 124.494 157.483 134.189 152.601 151L181.543 150.987ZM124.179 192.424C145.738 186.633 166.688 173.144 178.961 155.019H151.5C145.663 171.297 138 180 124.179 192.424ZM150 52.0194H180.285C167.1 31.4236 143.584 16.4129 119 11.3374C132.34 22.0295 141.314 30.4038 150 52.0194Z"
        fill={atlas}
      />
    </svg>
  );
}
