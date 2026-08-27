export type IconName =
  | "search"
  | "locate"
  | "filter"
  | "bookmark"
  | "bookmark-filled"
  | "seal"
  | "directions"
  | "close"
  | "chevron-left"
  | "chevron-right"
  | "chevron-up"
  | "check"
  | "clock"
  | "alert"
  | "link"
  | "accessibility"
  | "map"
  | "passport"
  | "person"
  | "shield"
  | "download"
  | "help"
  | "settings"
  | "logout"
  | "login"
  | "mail"
  | "trash"
  | "pen";

const PATHS: Record<IconName, readonly string[]> = {
  map: ["M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z", "M9 4v14", "M15 6v14"],
  passport: [
    "M5 3.5h12.5a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5Z",
    "M5 3.5v17",
    "M11.8 8.5a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z",
  ],
  person: ["M12 4.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z", "M4.8 20a7.2 7.2 0 0 1 14.4 0"],
  shield: ["M12 3.2 20 6v6.2c0 4.6-3.2 7.3-8 8.6-4.8-1.3-8-4-8-8.6V6l8-2.8Z", "m8.6 12.2 2.5 2.5 4.4-4.7"],
  download: ["M12 4v10.5", "m7.5 10.5 4.5 4.5 4.5-4.5", "M4.5 19.5h15"],
  help: ["M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z", "M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.7", "M12 17h.01"],
  settings: ["M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Z", "M4 12h1.6", "M18.4 12H20", "M12 4v1.6", "M12 18.4V20", "m6.7 6.7 1.1 1.1", "m16.2 16.2 1.1 1.1", "m17.3 6.7-1.1 1.1", "m7.8 16.2-1.1 1.1"],
  logout: ["M14.5 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h8.5", "M18.5 12H10", "m15.5 9 3 3-3 3"],
  login: ["M9.5 4.5H18a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H9.5", "M14 12H4.5", "m7.5 9-3 3 3 3"],
  mail: ["M3.5 6.5h17v11h-17Z", "m3.5 7 8.5 6.2L20.5 7"],
  trash: ["M4.5 6.5h15", "M9.5 6.5V4.8h5v1.7", "M6.8 6.5 7.7 20h8.6l.9-13.5", "M10.4 10v6", "M13.6 10v6"],
  pen: ["M4.5 19.5 5.4 16 16.1 5.3a2 2 0 0 1 2.8 2.8L8.2 18.8Z", "m14.4 7 2.8 2.8"],
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
  "chevron-left": ["m14.5 5.5-7 6.5 7 6.5"],
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
