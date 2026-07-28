/** Domain activity `entityType` for payroll runs */
export const PAYROLL_ENTITY_TYPE = "Payroll";

export const PAYROLL_TIMELINE = {
  CREATED: "PAYROLL_CREATED",
  REVIEWED: "PAYROLL_REVIEWED",
  APPROVED: "PAYROLL_APPROVED",
  LOCKED: "PAYROLL_LOCKED",
  PDF_GENERATED: "PAYROLL_PDF_GENERATED",
  PAYROLL_ATK_GENERATED: "PAYROLL_ATK_GENERATED",
  PAYROLL_ATK_DOWNLOADED: "PAYROLL_ATK_DOWNLOADED",
  PAYROLL_ATK_REGENERATED: "PAYROLL_ATK_REGENERATED",
  PAYROLL_ATK_ARCHIVED: "PAYROLL_ATK_ARCHIVED",
  ARCHIVED: "PAYROLL_ARCHIVED",
  RECALCULATED: "PAYROLL_RECALCULATED",
} as const;

/**
 * Human labels for the feed. Without these the UI printed the raw constants —
 * `PAYROLL_ATK_ARCHIVED` — straight at the user.
 */
export const PAYROLL_TIMELINE_LABELS: Record<string, string> = {
  PAYROLL_CREATED: "Payroll u krijua",
  PAYROLL_RECALCULATED: "Punonjësit u ripëllogaritën",
  PAYROLL_REVIEWED: "U shënua si i shqyrtuar",
  PAYROLL_APPROVED: "U miratua për kyçje",
  PAYROLL_LOCKED: "U kyç dhe u ruajt snapshot",
  PAYROLL_ARCHIVED: "U arkivua",
  PAYROLL_PDF_GENERATED: "U gjeneruan fletëpagesat PDF",
  PAYROLL_ATK_GENERATED: "U gjenerua eksporti ATK",
  PAYROLL_ATK_REGENERATED: "Eksporti ATK u rigjenerua",
  PAYROLL_ATK_DOWNLOADED: "Eksporti ATK u shkarkua",
  PAYROLL_ATK_ARCHIVED: "Eksporti ATK u arkivua",
};

/** Falls back to a readable form of the constant rather than the constant itself. */
export function payrollTimelineLabel(verb: string): string {
  return (
    PAYROLL_TIMELINE_LABELS[verb] ??
    verb.replace(/^PAYROLL_/, "").replaceAll("_", " ").toLocaleLowerCase("sq-AL")
  );
}

/** Drives the icon and rail colour in the feed. */
export type PayrollTimelineTone = "status" | "document" | "atk" | "neutral";

export function payrollTimelineTone(verb: string): PayrollTimelineTone {
  if (verb.includes("ATK")) return "atk";
  if (verb.includes("PDF")) return "document";
  if (
    verb === PAYROLL_TIMELINE.CREATED ||
    verb === PAYROLL_TIMELINE.REVIEWED ||
    verb === PAYROLL_TIMELINE.APPROVED ||
    verb === PAYROLL_TIMELINE.LOCKED ||
    verb === PAYROLL_TIMELINE.ARCHIVED
  ) {
    return "status";
  }
  return "neutral";
}
