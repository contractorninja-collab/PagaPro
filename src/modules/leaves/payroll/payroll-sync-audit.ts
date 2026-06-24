import type { DomainActivityVerb } from "@prisma/client";
import { appendPayrollDomainActivity } from "@/modules/payroll/services/payroll-audit-service";
import { PAYROLL_TIMELINE } from "@/modules/payroll/constants/timeline";
import { LEAVE_ENGINE_RULE_VERSION } from "@/modules/leaves/constants/rule-versions";
import { LEAVE_TIMELINE } from "@/modules/leaves/constants/timeline";

/** Audit payload when payroll regeneration consumes leave rows (same engine as requests). */
export async function recordLeavePayrollRegenerationLeaveAudit(params: {
  companyId: string;
  payrollId: string;
  actorUserId?: string | null;
  headcount: number;
  payrollYear: number;
  payrollMonth: number;
  leaveTotals: {
    paidLeaveHours: number;
    sickLeaveHours: number;
    unpaidLeaveHours: number;
  };
  verb?: DomainActivityVerb;
}): Promise<void> {
  await appendPayrollDomainActivity({
    companyId: params.companyId,
    payrollId: params.payrollId,
    verb: params.verb ?? "UPDATED",
    summary: `Payroll u ripëllogarit (${params.headcount} punonjës); pushimet në payroll sipas motorit ${LEAVE_ENGINE_RULE_VERSION}.`,
    actorUserId: params.actorUserId,
    payload: {
      event: PAYROLL_TIMELINE.RECALCULATED,
      headcount: params.headcount,
      leavePayrollSync: {
        code: LEAVE_TIMELINE.PAYROLL_SYNCED,
        ruleVersion: LEAVE_ENGINE_RULE_VERSION,
        payrollYear: params.payrollYear,
        payrollMonth: params.payrollMonth,
        aggregatedHours: params.leaveTotals,
      },
    },
  });
}
