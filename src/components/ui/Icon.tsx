export type IconName =
  | "search"
  | "locate"
  | "filter"
  | "bookmark"
  | "bookmark-filled"
  | "seal"
  | "directions"
  | "close"
  | "chevron-right"
  | "chevron-up"
  | "check"
  | "clock"
  | "alert"
  | "link"
  | "accessibility";

const PATHS: Record<IconName, readonly string[]> = {
  search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z", "m16.2 16.2 4.3 4.3"],
  locate: [
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
    "M12 2v3",
    "M12 19v3",
    "M2 12h3",
    "M19 12h3",
  ],
  filter: ["M3 5h18", "M6.5 12h11", "M10 19h4"],
  bookmark: ["M6 3.8h12v16.4l-6-4-6 4V3.8Z"],
  "bookmark-filled": ["M6 3.8h12v16.4l-6-4-6 4V3.8Z"],
  seal: ["M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z", "m8.2 12.2 2.6 2.6 5-5.2"],
  directions: ["M12 2.8 21.2 12 12 21.2 2.8 12 12 2.8Z", "m10 14.5v-3h5", "m13 9 2.5 2.5L13 14"],
  close: ["m5.5 5.5 13 13", "m18.5 5.5-13 13"],
  "chevron-right": ["m9.5 5.5 7 6.5-7 6.5"],
  "chevron-up": ["m5.5 15 6.5-7 6.5 7"],
  check: ["m4.5 12.5 5 5 10-11"],
  clock: ["M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z", "M12 7.2V12l3.4 2.2"],
  alert: ["M12 3.6 21.4 20H2.6L12 3.6Z", "M12 10v4.2", "M12 17.2h.01"],
  link: ["M10.5 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7l-1.2 1.2", "M13.5 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.2-1.2"],
  accessibility: [
    "M12 3.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z",
    "M4.8 8.6h14.4",
    "M9.2 8.6 8.4 20.6",
    "M14.8 8.6l.8 12",
    "M12 8.6v4.4",
  ],
};

interface IconProps {
  readonly name: IconName;
  readonly size?: number;
  readonly className?: string;
}

export function Icon({ name, size = 20, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === "bookmark-filled" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
