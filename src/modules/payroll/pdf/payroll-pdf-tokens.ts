import { rgb, type PDFPage, type RGB } from "pdf-lib";

/**
 * Palette shared by every payroll document, matching the PagaPRO identity system.
 * No builder declares its own colour — a document that needs a new shade adds it
 * here so the three documents cannot drift apart.
 */
export const PP = {
  navy: rgb(0.043, 0.071, 0.125), // #0B1220
  blue: rgb(0.145, 0.388, 0.922), // #2563EB
  slate800: rgb(0.118, 0.161, 0.231), // #1E293B
  text: rgb(0.043, 0.071, 0.125),
  muted: rgb(0.42, 0.447, 0.502), // #6B7280
  faint: rgb(0.58, 0.639, 0.722), // #94A3B8
  line: rgb(0.898, 0.906, 0.922), // #E5E7EB
  hairline: rgb(0.933, 0.949, 0.968), // #EEF2F7
  wash: rgb(0.957, 0.969, 0.984), // #F4F7FB
  blueWash: rgb(0.937, 0.957, 0.996), // #EFF4FE
  onNavy: rgb(0.561, 0.639, 0.784), // #8FA3C8
  white: rgb(1, 1, 1),
} as const;

export const RADIUS = { card: 10, pill: 999, band: 12 } as const;
export const RULE = { hair: 0.5, thin: 1, heavy: 2 } as const;

/** Page geometries the documents are drawn on. */
export const PAGE = {
  a4Portrait: { width: 595.28, height: 841.89 },
  a4Landscape: { width: 841.89, height: 595.28 },
  a3Landscape: { width: 1190.55, height: 841.89 },
} as const;

export interface RoundedRectOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  color?: RGB;
  borderColor?: RGB;
  borderWidth?: number;
  opacity?: number;
}

/**
 * Builds the SVG path for a rounded rectangle in pdf-lib's coordinate space.
 *
 * `drawSvgPath` treats the given (x, y) as the origin with y running downward,
 * so the path is authored from the box's top-left corner.
 */
export function roundedRectPath(w: number, h: number, r: number): string {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  if (radius === 0) return `M 0 0 H ${w} V ${h} H 0 Z`;
  return [
    `M ${radius} 0`,
    `H ${w - radius}`,
    `A ${radius} ${radius} 0 0 1 ${w} ${radius}`,
    `V ${h - radius}`,
    `A ${radius} ${radius} 0 0 1 ${w - radius} ${h}`,
    `H ${radius}`,
    `A ${radius} ${radius} 0 0 1 0 ${h - radius}`,
    `V ${radius}`,
    `A ${radius} ${radius} 0 0 1 ${radius} 0`,
    "Z",
  ].join(" ");
}

/**
 * Rounded rectangle — pdf-lib has no primitive for one. `y` is the bottom edge,
 * matching every other pdf-lib draw call.
 */
export function drawRoundedRect(page: PDFPage, opts: RoundedRectOptions): void {
  const path = roundedRectPath(opts.w, opts.h, opts.r);
  page.drawSvgPath(path, {
    x: opts.x,
    y: opts.y + opts.h,
    color: opts.color,
    borderColor: opts.borderColor,
    borderWidth: opts.borderWidth ?? (opts.borderColor ? RULE.thin : 0),
    opacity: opts.opacity,
  });
}

/** Pill — a fully rounded rect, sized to its own height. */
export function drawPill(
  page: PDFPage,
  opts: Omit<RoundedRectOptions, "r">,
): void {
  drawRoundedRect(page, { ...opts, r: opts.h / 2 });
}
