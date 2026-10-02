/** Set minimo di icone SVG inline (24x24, stroke currentColor). Niente emoji nella UI:
 *  le icone seguono il colore del testo e si scalano con `size`. */
import type { SVGProps } from "react";

const PATHS = {
  ball: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c-2.5 3-2.5 15 0 18M3.5 9.5c3 1 14 1 17 0M3.5 14.5c3-1 14-1 17 0M5 5.5c4 4 10 9 14 13",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M12 13v4M8 21h8M9 17h6",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2",
  pin: "M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11Zm0-9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4",
  close: "M6 6l12 12M18 6 6 18",
  chevron: "m9 6 6 6-6 6",
  arrowLeft: "M19 12H5m6-6-6 6 6 6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  edit: "M4 20h4l10-10-4-4L4 16v4ZM13 7l4 4",
  trash: "M4 7h16M9 7V4h6v3m-7 0 1 13h6l1-13",
  share: "M15 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-9 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm9 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.5 13.5l7 3.5M15.5 7l-7 3.5",
  dice: "M4 4h16v16H4zM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01",
  ranking: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  flag: "M5 21V4m0 0h12l-2 4 2 4H5",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3Z",
  play: "M7 5v14l11-7L7 5Z",
  video: "M4 6h12v12H4zM16 10l4-2v8l-4-2",
  users: "M16 19v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 19v-2a4 4 0 0 0-3-3.9M15 4.1a3.5 3.5 0 0 1 0 6.8",
  check: "m5 12 5 5L20 7",
  timer: "M10 2h4M12 8v5l3 2M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z",
  download: "M12 3v12m-5-5 5 5 5-5M4 21h16",
  upload: "M12 21V9m-5 5 5-5 5 5M4 3h16",
  live: "M6 8a8 8 0 0 0 0 8M18 8a8 8 0 0 1 0 8M9 10a4 4 0 0 0 0 4M15 10a4 4 0 0 1 0 4M12 12h.01",
} as const;

export type IconName = keyof typeof PATHS;

interface Props extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, ...rest }: Props) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={PATHS[name]} />
    </svg>
  );
}
