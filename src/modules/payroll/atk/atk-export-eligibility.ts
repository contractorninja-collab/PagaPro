import type { PayrollPeriodStatus } from "@prisma/client";

/**
 * When the official ATK workbook may be produced.
 *
 * This rule was written out three times — in the service, in the page shell and
 * in the ATK tab — and they drifted: the service and the UI both stopped at
 * LOCKED, so archiving a month locked you out of producing the filing that
 * closing the month exists for. One function now, three callers.
 */

/** Figures are final: the export is produced once and never regenerated. */
export function isPayrollFrozen(status: PayrollPeriodStatus): boolean {
  return status === "LOCKED" || status === "ARCHIVED";
}

/** Any state from which an ATK export may exist at all. */
export function isAtkStatusEligible(status: PayrollPeriodStatus): boolean {
  return status === "APPROVED" || isPayrollFrozen(status);
}

export type AtkGenerationBlock = "STATUS" | "ALREADY_GENERATED";

export function atkGenerationBlock(params: {
  status: PayrollPeriodStatus;
  hasActiveExport: boolean;
}): AtkGenerationBlock | null {
  if (!isAtkStatusEligible(params.status)) return "STATUS";
  // Only an approved payroll can be regenerated; once frozen, ATK gets one file
  // for the month and a second would contradict the first.
  if (isPayrollFrozen(params.status) && params.hasActiveExport) return "ALREADY_GENERATED";
  return null;
}

export function canGenerateAtkExport(params: {
  status: PayrollPeriodStatus;
  hasActiveExport: boolean;
}): boolean {
  return atkGenerationBlock(params) === null;
}

export const ATK_BLOCK_MESSAGES: Record<AtkGenerationBlock, string> = {
  STATUS: "Eksporti ATK lejohet vetëm pasi payroll-i të jetë miratuar, kyçur ose arkivuar.",
  ALREADY_GENERATED:
    "Payroll i ngrirë: eksporti ATK gjenerohet një herë — përdorni shkarkimin nga historia.",
};
