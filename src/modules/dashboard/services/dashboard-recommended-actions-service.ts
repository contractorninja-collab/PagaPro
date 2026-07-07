import { payrollMonthLabel } from "@/modules/payroll/helpers/month-label";
import type { DashboardOperationalPayload, DocumentsMissingEmployeeRef, RecommendedAction } from "../types/dashboard-types";
import { missingDocsHref } from "./dashboard-missing-docs-routing";

export type RecommendedActionsInput = Omit<DashboardOperationalPayload, "alerts" | "recommendedActions"> & {
  payrollRowExists: boolean;
  documentsMissingEmployees: DocumentsMissingEmployeeRef[];
  registerPdfGenerated: boolean;
};

export function buildRecommendedActions(input: RecommendedActionsInput): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  const periodLabel = payrollMonthLabel(input.filters.year, input.filters.month);
  const payrollHref = input.payroll.payrollId ? `/pagat/${input.payroll.payrollId}` : "/pagat";
  const status = input.payroll.status;

  if (input.documentsMissingEmployees.length > 0) {
    actions.push({
      id: "missing-docs",
      label:
        input.documentsMissingEmployees.length === 1
          ? "Kontrollo dokumentacionin e munguar"
          : "Kontrollo dokumentacionin e munguar të punonjësve",
      href: missingDocsHref(input.documentsMissingEmployees),
    });
  }

  if (!input.payrollRowExists) {
    actions.push({
      id: "create-payroll",
      label: `Krijo payroll-in për ${periodLabel}`,
      href: "/pagat",
    });
  } else if (status === "DRAFT" || status === "REVIEWED") {
    actions.push({
      id: "review-payroll",
      label: `Rishiko payroll-in për ${periodLabel}`,
      href: payrollHref,
    });
  } else if (status === "APPROVED") {
    actions.push({
      id: "finalize-payroll",
      label: `Përfundo miratimin e pagës për ${periodLabel}`,
      href: payrollHref,
    });
  }

  if (
    input.payrollRowExists &&
    input.payroll.payrollId &&
    !input.registerPdfGenerated &&
    status != null &&
    ["REVIEWED", "APPROVED", "LOCKED"].includes(status)
  ) {
    actions.push({
      id: "generate-register",
      label: "Gjenero listën e pagave për financa",
      href: payrollHref,
    });
  }

  if (input.summary.leaveRequestsPending > 0) {
    actions.push({
      id: "approve-leaves",
      label: "Mirato pushimet në pritje",
      href: "#leave-requests",
    });
  }

  if (input.contractExpiries.length > 0) {
    actions.push({
      id: "renew-contracts",
      label: "Rishiko kontratat që skadojnë së shpejti",
      href: "#contracts-expiry",
    });
  }

  if (actions.length === 0 && input.payrollRowExists && status === "LOCKED") {
    actions.push({
      id: "view-payroll",
      label: `Shiko payroll-in e kyçur për ${periodLabel}`,
      href: payrollHref,
    });
  }

  return actions.slice(0, 6);
}
