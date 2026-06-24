import type { LeaveType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  LeaveValidationCode,
  emptyValidationResult,
  mergeValidationResults,
  type LeaveValidationResult,
} from "@/modules/leaves/engine/validation-result";
import { annualSplitLeaveCompliant } from "@/modules/leaves/engine/split-leave-analyzer";
import { computeLeaveMetrics } from "@/modules/leaves/services/leave-calculation-service";
import { syncLeaveBalancesForEmployeeYear } from "@/modules/leaves/services/leave-balance-service";
import { resolveLeavePolicyParameterSet } from "@/modules/leaves/services/leave-policy-service";

const OVERLAP_STATUSES = ["PENDING", "APPROVED"] as const;

export async function findOverlappingLeaveRequest(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    employeeId: string;
    startDate: Date;
    endDate: Date;
    excludeId?: string;
  },
) {
  const rows = await tx.leaveRequest.findMany({
    where: {
      companyId: params.companyId,
      employeeId: params.employeeId,
      status: { in: [...OVERLAP_STATUSES] },
      AND: [{ startDate: { lte: params.endDate } }, { endDate: { gte: params.startDate } }],
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
    },
    select: { id: true, status: true, startDate: true, endDate: true, type: true },
    take: 5,
  });
  return rows[0] ?? null;
}

async function payrollLockedOverlapBlock(params: {
  companyId: string;
  startDate: Date;
  endDate: Date;
}): Promise<LeaveValidationResult> {
  const start = params.startDate;
  const end = params.endDate;
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endM = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cur.getTime() <= endM.getTime()) {
    const y = cur.getUTCFullYear();
    const m = cur.getUTCMonth() + 1;
    const locked = await prisma.payroll.findFirst({
      where: {
        companyId: params.companyId,
        year: y,
        month: m,
        status: { in: ["LOCKED", "APPROVED"] },
      },
      select: { id: true },
    });
    if (locked) {
      return {
        blocks: [
          {
            code: LeaveValidationCode.PAYROLL_LOCKED_BLOCK,
            message:
              "Ekziston një payroll i kyçur ose i miratuar për një muaj që përputhet me këtë pushim. Revokoni kyçjen ose përdorni një datë jashtë periudhës së kyçur.",
            metadata: { payrollMonth: m, payrollYear: y },
          },
        ],
        warnings: [],
      };
    }
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return emptyValidationResult();
}

async function balanceGateForAnnual(params: {
  companyId: string;
  employeeId: string;
  leaveType: LeaveType;
  requestedWorkingDays: number;
  yearUtc: number;
}): Promise<LeaveValidationResult> {
  if (params.leaveType !== "PUSHIM_VJETOR") return emptyValidationResult();

  await syncLeaveBalancesForEmployeeYear(params.companyId, params.employeeId, params.yearUtc);

  const policy = await resolveLeavePolicyParameterSet(
    params.companyId,
    new Date(Date.UTC(params.yearUtc, 11, 31, 12, 0, 0, 0)),
  );

  const row = await prisma.leaveBalance.findUnique({
    where: {
      companyId_employeeId_leaveType_year: {
        companyId: params.companyId,
        employeeId: params.employeeId,
        leaveType: "PUSHIM_VJETOR",
        year: params.yearUtc,
      },
    },
    select: { remainingDays: true },
  });

  const remaining = row?.remainingDays?.toNumber() ?? 0;

  const blocks = [];
  const warnings = [];

  if (policy.blockNegativeBalance && params.requestedWorkingDays > remaining + 1e-9) {
    blocks.push({
      code: LeaveValidationCode.INSUFFICIENT_BALANCE_BLOCK,
      message: `Për pushimin vjetor nuk ka ditë të mjaftueshme (mbeten ~${remaining.toFixed(2)}, kërkohen ${params.requestedWorkingDays.toFixed(2)} ditë pune).`,
      metadata: { remaining, requestedWorkingDays: params.requestedWorkingDays },
    });
  } else if (policy.warnInsufficientBalance && params.requestedWorkingDays > remaining + 1e-9) {
    warnings.push({
      code: LeaveValidationCode.INSUFFICIENT_BALANCE_WARN,
      message: `Balanca e pushimit vjetor është nën kërkesën (mbeten ~${remaining.toFixed(2)} ditë pune).`,
      metadata: { remaining, requestedWorkingDays: params.requestedWorkingDays },
    });
  }

  return { blocks, warnings };
}

async function splitAnnualWarning(params: {
  companyId: string;
  employeeId: string;
  yearUtc: number;
  proposedWorkingDays: number;
  excludeLeaveId?: string;
}): Promise<LeaveValidationResult> {
  const policy = await resolveLeavePolicyParameterSet(
    params.companyId,
    new Date(Date.UTC(params.yearUtc, 11, 31, 12, 0, 0, 0)),
  );
  if (!policy.warnSplitLeaveViolation) return emptyValidationResult();

  const yearStart = new Date(Date.UTC(params.yearUtc, 0, 1));
  const yearEnd = new Date(Date.UTC(params.yearUtc, 11, 31, 23, 59, 59, 999));

  const approved = await prisma.leaveRequest.findMany({
    where: {
      companyId: params.companyId,
      employeeId: params.employeeId,
      type: "PUSHIM_VJETOR",
      status: { in: ["APPROVED", "PENDING"] },
      ...(params.excludeLeaveId ? { id: { not: params.excludeLeaveId } } : {}),
      AND: [{ startDate: { lte: yearEnd } }, { endDate: { gte: yearStart } }],
    },
    select: { workingDays: true },
  });

  const segments = approved
    .map((r) => r.workingDays?.toNumber() ?? 0)
    .filter((d) => d > 0);
  segments.push(params.proposedWorkingDays);

  const ok = annualSplitLeaveCompliant(segments, policy.splitLeaveMinWorkingDays);
  if (ok) return emptyValidationResult();

  const enforce = policy.enforceSplitLeaveRule;
  const issue = {
    code: LeaveValidationCode.SPLIT_LEAVE_WARN,
    message: `Ndarja e pushimit vjetor nuk përmban një segment prej të paktën ${policy.splitLeaveMinWorkingDays} ditësh të pandërprera (Art 37.6).`,
    metadata: { segments, min: policy.splitLeaveMinWorkingDays },
  };

  return enforce
    ? { blocks: [issue], warnings: [] }
    : { blocks: [], warnings: [issue] };
}

async function carryExpiryWarning(params: {
  companyId: string;
  employeeId: string;
  yearUtc: number;
}): Promise<LeaveValidationResult> {
  const policy = await resolveLeavePolicyParameterSet(
    params.companyId,
    new Date(Date.UTC(params.yearUtc, 11, 31, 12, 0, 0, 0)),
  );
  if (!policy.warnCarryOverExpiry) return emptyValidationResult();

  const now = new Date();
  const row = await prisma.leaveBalance.findUnique({
    where: {
      companyId_employeeId_leaveType_year: {
        companyId: params.companyId,
        employeeId: params.employeeId,
        leaveType: "PUSHIM_VJETOR",
        year: params.yearUtc,
      },
    },
    select: { carryOverDays: true, carryExpiresAt: true },
  });

  if (!row?.carryExpiresAt || !row.carryOverDays || row.carryOverDays.toNumber() <= 0) {
    return emptyValidationResult();
  }

  if (row.carryExpiresAt.getTime() < now.getTime()) {
    return {
      blocks: [],
      warnings: [
        {
          code: LeaveValidationCode.CARRY_EXPIRE_WARN,
          message:
            "Ka ditë bartje që kanë kaluar afatin ligjor të përdorimit (30 qershor). Verifikoni manualisht në payroll dhe balancat.",
          metadata: {
            carryExpiresAt: row.carryExpiresAt.toISOString(),
            carryOverDays: row.carryOverDays.toString(),
          },
        },
      ],
    };
  }

  return emptyValidationResult();
}

export async function validateLeaveRequestForWorkflow(params: {
  companyId: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  excludeLeaveId?: string;
}): Promise<LeaveValidationResult> {
  const parts: LeaveValidationResult[] = [];

  if (params.endDate.getTime() < params.startDate.getTime()) {
    return {
      blocks: [
        {
          code: LeaveValidationCode.DATE_RANGE_BLOCK,
          message: "Data e mbarimit është para fillimit.",
        },
      ],
      warnings: [],
    };
  }

  parts.push(await payrollLockedOverlapBlock(params));

  const metrics = await computeLeaveMetrics(params.companyId, params.startDate, params.endDate);
  const yearUtc = params.startDate.getUTCFullYear();

  parts.push(
    await balanceGateForAnnual({
      companyId: params.companyId,
      employeeId: params.employeeId,
      leaveType: params.leaveType,
      requestedWorkingDays: metrics.workingDays,
      yearUtc,
    }),
  );

  if (params.leaveType === "PUSHIM_VJETOR") {
    parts.push(
      await splitAnnualWarning({
        companyId: params.companyId,
        employeeId: params.employeeId,
        yearUtc,
        proposedWorkingDays: metrics.workingDays,
        excludeLeaveId: params.excludeLeaveId,
      }),
    );
    parts.push(
      await carryExpiryWarning({
        companyId: params.companyId,
        employeeId: params.employeeId,
        yearUtc,
      }),
    );
  }

  return mergeValidationResults(...parts);
}
