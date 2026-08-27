import type { SVGProps } from "react";

/**
 * A small hand-rolled icon set. Twenty-odd glyphs is far less weight than an
 * icon package, and keeping them here means one consistent stroke width.
 */
const paths: Record<string, string> = {
  home: "M3 10.5L12 3l9 7.5M5.5 9.5V20h13V9.5",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
  calendar: "M4 8h16M8 3v3M16 3v3M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z",
  chat: "M4 5h16v10H9l-5 4V5z",
  heart: "M12 20s-7-4.6-7-9.4A4.1 4.1 0 0112 8a4.1 4.1 0 017 2.6C19 15.4 12 20 12 20z",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20a7.5 7.5 0 0115 0",
  bell: "M18 15V10a6 6 0 10-12 0v5l-2 3h16l-2-3zM10 21h4",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  briefcase: "M4 8h16v11H4zM9 8V6a2 2 0 012-2h2a2 2 0 012 2v2M4 13h16",
  chart: "M5 19V11M10 19V5M15 19v-6M20 19v-9",
  settings:
    "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 01-1.6.9l-.3 2h-4l-.3-2a7 7 0 01-1.6-.9l-1.9.7-2-3.4 1.6-1.2a7 7 0 010-1.9L3.4 10.5l2-3.4 1.9.7a7 7 0 011.6-.9l.3-2h4l.3 2c.6.2 1.1.5 1.6.9l1.9-.7 2 3.4-1.6 1.2c.1.6.1 1.3 0 1.9z",
  shield: "M12 3l7 3v5.5c0 4.4-3 8.2-7 9.5-4-1.3-7-5.1-7-9.5V6l7-3z",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3.5 2",
  pin: "M12 21s6.5-6 6.5-10.5A6.5 6.5 0 005.5 10.5C5.5 15 12 21 12 21zM12 12.5a2 2 0 100-4 2 2 0 000 4z",
  money: "M4 6h16v12H4zM12 15a3 3 0 100-6 3 3 0 000 6z",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 18l-6-6 6-6",
  chevronDown: "M6 9l6 6 6-6",
  chevronRight: "M9 6l6 6-6 6",
  send: "M4 12l16-8-6 16-2.5-6.5L4 12z",
  logout: "M15 12H4M8 8l-4 4 4 4M13 4h5a2 2 0 012 2v12a2 2 0 01-2 2h-5",
  flag: "M6 21V4h12l-2.5 4L18 12H6",
  camera: "M4 8h3l1.5-2h7L17 8h3v11H4zM12 16.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  users: "M9 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a6.5 6.5 0 0113 0M16 12.5a5.5 5.5 0 015 4.5",
  filter: "M4 6h16M7 12h10M10 18h4",
  ban: "M12 21a9 9 0 100-18 9 9 0 000 18zM5.6 5.6l12.8 12.8",
  trash: "M5 7h14M9 7V5h6v2M6.5 7l.8 12h9.4l.8-12",
};

export type IconName = keyof typeof paths;

type Props = SVGProps<SVGSVGElement> & { name: IconName; size?: number };

export function Icon({ name, size = 20, className = "", ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  );
}
