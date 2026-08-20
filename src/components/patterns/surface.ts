/**
 * THE surface recipes. Every module's card/table chrome points here so a
 * section cannot drift into a different look — the seven independent CARD
 * constants this file replaced had already grown three shadows and two
 * header borders between them.
 */

/** The 1b card: white, 1px line border, 12px radius, flat shadow. */
export const CARD = "rounded-xl border border-line bg-white shadow-card";

/** Card header strip: hairline bottom border, bold 13px title. */
export const CARD_TITLE = "border-b border-line-soft px-5 py-3 text-[13px] font-bold text-ink-900";

/** Uppercase table-header cell label. One tracking, one color. */
export const TH = "px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.04em] text-ink-400";

/** Table header row chrome. */
export const THEAD_ROW = "border-b border-line-soft bg-fill-faint";

/** Data row: hairline separator, calm hover wash. */
export const TR = "border-b border-fill transition-colors last:border-0 hover:bg-fill-faint";
