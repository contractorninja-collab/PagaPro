import type { LeaveSubtype, LeaveType } from "@prisma/client";
import { TimelineEventSeverity } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LEAVE_TIMELINE } from "@/modules/leaves/constants/timeline";
import { LEAVE_ENGINE_RULE_VERSION } from "@/modules/leaves/constants/rule-versions";
import { defaultPaidAndPayrollFlags } from "@/modules/leaves/helpers/leave-type-metadata";
import { computeLeaveMetrics } from "@/modules/leaves/services/leave-calculation-service";
import { syncLeaveBalancesForEmployeeYear } from "@/modules/leaves/services/leave-balance-service";
import {
  findOverlappingLeaveRequest,
  payrollLockedOverlapBlock,
  validateLeaveRequestForWorkflow,
} from "@/modules/leaves/services/leave-validation-service";
import { syncDraftPayrollsForLeaveChange } from "@/modules/payroll/services/payroll-leave-sync-service";

/**
 * Best-effort: pas një ndryshimi të pushimit të miratuar, ripërllogarit rreshtat
 * përkatës në payroll-et DRAFT të muajve të mbivendosur. Dështimi nuk e bllokon
 * veprimin e pushimit — regjistrohet në timeline që HR ta rifreskojë manualisht.
 */
async function syncDraftPayrollsAfterLeaveChange(params: {
  companyId: string;
  employeeId: string;
  leaveId: string;
  startDate: Date;
  endDate: Date;
  actorUserId?: string | null;
}): Promise<void> {
  let sync: Awaited<ReturnType<typeof syncDraftPayrollsForLeaveChange>>;
  try {
    sync = await syncDraftPayrollsForLeaveChange({
      companyId: params.companyId,
      employeeId: params.employeeId,
      startDate: params.startDate,
      endDate: params.endDate,
      actorUserId: params.actorUserId,
    });
  } catch (err) {
    // Sinkronizimi dështoi tërësisht — lëre gjurmë të dukshme, jo vetëm në konsolë.
    console.error("[pagapro] syncDraftPayrollsAfterLeaveChange failed", err);
    await appendLeaveTimeline({
      companyId: params.companyId,
      employeeId: params.employeeId,
      leaveId: params.leaveId,
      eventType: "LEAVE_PAYROLL_SYNC_SKIPPED",
      title: "Payroll (DRAFT) nuk u sinkronizua automatikisht",
      body: "Sinkronizimi dështoi — rifreskoni orët e pushimit manualisht në payroll.",
      severity: TimelineEventSeverity.WARNING,
    });
    return;
  }

  if (sync.synced.length > 0) {
    await appendLeaveTimeline({
      companyId: params.companyId,
      employeeId: params.employeeId,
      leaveId: params.leaveId,
      eventType: "LEAVE_PAYROLL_SYNCED",
      title: "Payroll (DRAFT) u sinkronizua me pushimin",
      body: sync.synced.map((s) => `${s.month}/${s.year}`).join(", "),
    });
  }
  for (const s of sync.skipped) {
    await appendLeaveTimeline({
      companyId: params.companyId,
      employeeId: params.employeeId,
      leaveId: params.leaveId,
      eventType: "LEAVE_PAYROLL_SYNC_SKIPPED",
      title: `Payroll ${s.month}/${s.year} nuk u sinkronizua automatikisht`,
      body: s.reason,
      severity: TimelineEventSeverity.WARNING,
    });
  }
}
async function appendLeaveTimeline(params: {
  companyId: string;
  employeeId: string;
  leaveId: string;
  eventType: string;
  title: string;
  body?: string;
  severity?: TimelineEventSeverity;
}): Promise<void> {
  try {
    await prisma.employeeTimelineEvent.create({
      data: {
        companyId: params.companyId,
        employeeId: params.employeeId,
        eventType: params.eventType,
        severity: params.severity ?? TimelineEventSeverity.INFO,
        subjectKind: "LeaveRequest",
        subjectId: params.leaveId,
        title: params.title,
        body: params.body,
      },
    });
  } catch {
    /* non-blocking */
  }
}

async function appendLeaveDomainActivity(params: {
  companyId: string;
  leaveId: string;
  verb: "CREATED" | "UPDATED" | "APPROVED" | "REJECTED" | "VOIDED";
  summary: string;
  payload?: Prisma.InputJsonValue | null;
}): Promise<void> {
  try {
    await prisma.domainActivity.create({
      data: {
        companyId: params.companyId,
        entityType: "LeaveRequest",
        entityId: params.leaveId,
        verb: params.verb,
        summary: params.summary,
        payload: params.payload ?? undefined,
      },
    });
  } catch {
    /* non-blocking */
  }
}
export async function createDraftLeaveRequest(params: {
  companyId: string;
  employeeId: string;
  type: LeaveType;
  subtype?: LeaveSubtype | null;
  startDate: Date;
  endDate: Date;
  reason?: string | null;
  createdByUserId?: string | null;
}): Promise<{ id: string }> {
  const flags = defaultPaidAndPayrollFlags(params.type, params.subtype ?? "NONE");
  const metrics = await computeLeaveMetrics(
    params.companyId,
    params.startDate,
    params.endDate,
    LEAVE_ENGINE_RULE_VERSION,
  );

  const row = await prisma.leaveRequest.create({
    data: {
      companyId: params.companyId,
      employeeId: params.employeeId,
      type: params.type,
      subtype: params.subtype ?? "NONE",
      status: "DRAFT",
      startDate: params.startDate,
      endDate: params.endDate,
      totalDays: metrics.calendarDays,
      workingDays: metrics.workingDays,
      totalHours: metrics.totalHours,
      metricsRuleVersion: LEAVE_ENGINE_RULE_VERSION,
      isPaid: flags.isPaid,
      affectsPayroll: false,
      reason: params.reason?.trim() || null,
      createdByUserId: params.createdByUserId ?? undefined,
    },
  });
  await appendLeaveTimeline({
    companyId: params.companyId,
    employeeId: params.employeeId,
    leaveId: row.id,
    eventType: "LEAVE_CREATED",
    title: "Kërkesë pushimi (draft)",
    body: `${params.type}: ${params.startDate.toISOString().slice(0, 10)} / ${params.endDate.toISOString().slice(0, 10)}`,
  });

  await appendLeaveDomainActivity({
    companyId: params.companyId,
    leaveId: row.id,
    verb: "CREATED",
    summary: "U krijua një kërkesë pushimi në draft.",
  });

  return { id: row.id };
}

export async function submitLeaveRequest(params: { companyId: string; leaveId: string }): Promise<void> {
  const lr = await prisma.leaveRequest.findFirst({
    where: { id: params.leaveId, companyId: params.companyId },
  });
  if (!lr) throw new Error("Kërkesa nuk u gjet.");
  if (lr.status !== "DRAFT") throw new Error("Vetëm draft-et mund të dërgohen.");
  if (lr.endDate.getTime() < lr.startDate.getTime()) throw new Error("Data e mbarimit është para fillimit.");

  const validation = await validateLeaveRequestForWorkflow({
    companyId: params.companyId,
    employeeId: lr.employeeId,
    leaveType: lr.type,
    startDate: lr.startDate,
    endDate: lr.endDate,
    excludeLeaveId: lr.id,
    metricsRuleVersion: lr.metricsRuleVersion,
  });
  if (validation.blocks.length > 0) {
    await appendLeaveTimeline({
      companyId: params.companyId,
      employeeId: lr.employeeId,
      leaveId: lr.id,
      eventType: LEAVE_TIMELINE.VALIDATION_BLOCKED,
      title: "Pushimi u bllokua nga validimi",
      body: validation.blocks.map((b) => b.message).join("\n"),
      severity: TimelineEventSeverity.WARNING,
    });
    await appendLeaveDomainActivity({
      companyId: params.companyId,
      leaveId: lr.id,
      verb: "UPDATED",
      summary: "Validimi operativ bllokoi dërgimin e pushimit.",
      payload: JSON.parse(
        JSON.stringify({ blocks: validation.blocks, warnings: validation.warnings }),
      ) as Prisma.InputJsonValue,
    });
    throw new Error(validation.blocks[0]?.message ?? "Validimi dështoi.");
  }

  await prisma.$transaction(async (tx) => {
    const overlap = await findOverlappingLeaveRequest(tx, {
      companyId: params.companyId,
      employeeId: lr.employeeId,
      startDate: lr.startDate,
      endDate: lr.endDate,
      excludeId: lr.id,
    });
    if (overlap) throw new Error("Ekziston një kërkesë e mbivendosur në pritje ose të miratuar.");

    const metrics = await computeLeaveMetrics(
      params.companyId,
      lr.startDate,
      lr.endDate,
      lr.metricsRuleVersion,
    );

    await tx.leaveRequest.update({
      where: { id: lr.id },
      data: {
        status: "PENDING",
        affectsPayroll: false,
        totalDays: metrics.calendarDays,
        workingDays: metrics.workingDays,
        totalHours: metrics.totalHours,
      },
    });
  });

  if (validation.warnings.length > 0) {
    await appendLeaveTimeline({
      companyId: params.companyId,
      employeeId: lr.employeeId,
      leaveId: lr.id,
      eventType: "LEAVE_VALIDATION_WARNINGS",
      title: "Paralajmërime validimi pushimi",
      body: validation.warnings.map((w) => w.message).join("\n"),
      severity: TimelineEventSeverity.INFO,
    });
  }

  await appendLeaveTimeline({
    companyId: params.companyId,
    employeeId: lr.employeeId,
    leaveId: lr.id,
    eventType: "LEAVE_SUBMITTED",
    title: "Pushimi u dërgua për miratim",
  });

  await appendLeaveDomainActivity({
    companyId: params.companyId,
    leaveId: lr.id,
    verb: "UPDATED",
    summary: "Kërkesa e pushimit kaloi në pritje për miratim.",
    payload:
      validation.warnings.length > 0
        ? (JSON.parse(JSON.stringify({ kosovoWarnings: validation.warnings })) as Prisma.InputJsonValue)
        : undefined,
  });
}

export async function approveLeaveRequest(params: {
  companyId: string;
  leaveId: string;
  decidedByMembershipId?: string | null;
  actorUserId?: string | null;
}): Promise<void> {
  const lr = await prisma.leaveRequest.findFirst({
    where: { id: params.leaveId, companyId: params.companyId },
  });
  if (!lr) throw new Error("Kërkesa nuk u gjet.");
  if (lr.status !== "PENDING") throw new Error("Vetëm kërkesat në pritje mund të miratohen.");

  const validation = await validateLeaveRequestForWorkflow({
    companyId: params.companyId,
    employeeId: lr.employeeId,
    leaveType: lr.type,
    startDate: lr.startDate,
    endDate: lr.endDate,
    excludeLeaveId: lr.id,
    metricsRuleVersion: lr.metricsRuleVersion,
  });
  if (validation.blocks.length > 0) {
    throw new Error(validation.blocks[0]?.message ?? "Miratimi u bllokua nga validimi.");
  }

  await prisma.$transaction(async (tx) => {
    const overlap = await findOverlappingLeaveRequest(tx, {
      companyId: params.companyId,
      employeeId: lr.employeeId,
      startDate: lr.startDate,
      endDate: lr.endDate,
      excludeId: lr.id,
    });
    if (overlap && overlap.id !== lr.id) throw new Error("Konflikt me një kërkesë tjetër aktive.");

    await tx.leaveRequest.update({
      where: { id: lr.id },
      data: {
        status: "APPROVED",
        decidedAt: new Date(),
        decidedByMembershipId: params.decidedByMembershipId ?? undefined,
        affectsPayroll: true,
        rejectionReason: null,
      },
    });
  });

  const y = lr.startDate.getUTCFullYear();
  await syncLeaveBalancesForEmployeeYear(params.companyId, lr.employeeId, y);
  const y2 = lr.endDate.getUTCFullYear();
  if (y2 !== y) await syncLeaveBalancesForEmployeeYear(params.companyId, lr.employeeId, y2);

  await syncDraftPayrollsAfterLeaveChange({
    companyId: params.companyId,
    employeeId: lr.employeeId,
    leaveId: lr.id,
    startDate: lr.startDate,
    endDate: lr.endDate,
    actorUserId: params.actorUserId,
  });

  const yearsSynced = y2 !== y ? [y, y2] : [y];

  await appendLeaveTimeline({
    companyId: params.companyId,
    employeeId: lr.employeeId,
    leaveId: lr.id,
    eventType: LEAVE_TIMELINE.RECOMPUTED,
    title: "Balanca pushimi u rifreskua",
    body: `Vit-et e përfshirë: ${yearsSynced.join(", ")}.`,
    severity: TimelineEventSeverity.INFO,
  });

  await appendLeaveTimeline({
    companyId: params.companyId,
    employeeId: lr.employeeId,
    leaveId: lr.id,
    eventType: "LEAVE_APPROVED",
    title: "Pushimi u miratua",
  });

  await appendLeaveDomainActivity({
    companyId: params.companyId,
    leaveId: lr.id,
    verb: "APPROVED",
    summary: "Kërkesa e pushimit u miratua.",
    payload: JSON.parse(
      JSON.stringify({
        ruleVersion: LEAVE_ENGINE_RULE_VERSION,
        balanceYearsSynced: yearsSynced,
      }),
    ) as Prisma.InputJsonValue,
  });
}

export async function rejectLeaveRequest(params: {
  companyId: string;
  leaveId: string;
  rejectionReason?: string | null;
  decidedByMembershipId?: string | null;
}): Promise<void> {
  const lr = await prisma.leaveRequest.findFirst({
    where: { id: params.leaveId, companyId: params.companyId },
  });
  if (!lr) throw new Error("Kërkesa nuk u gjet.");
  if (lr.status !== "PENDING") throw new Error("Vetëm kërkesat në pritje mund të refuzohen.");

  await prisma.leaveRequest.update({
    where: { id: lr.id },
    data: {
      status: "REJECTED",
      decidedAt: new Date(),
      decidedByMembershipId: params.decidedByMembershipId ?? undefined,
      affectsPayroll: false,
      rejectionReason: params.rejectionReason?.trim() || null,
    },
  });

  await appendLeaveTimeline({
    companyId: params.companyId,
    employeeId: lr.employeeId,
    leaveId: lr.id,
    eventType: "LEAVE_REJECTED",
    title: "Pushimi u refuzua",
    body: params.rejectionReason?.trim() || undefined,
    severity: TimelineEventSeverity.WARNING,
  });

  await appendLeaveDomainActivity({
    companyId: params.companyId,
    leaveId: lr.id,
    verb: "REJECTED",
    summary: "Kërkesa e pushimit u refuzua.",
  });
}

/**
 * Revoke an already-APPROVED leave request (APPROVED → CANCELLED) and restore the
 * consumed balance. Blocked when the leave overlaps a LOCKED/APPROVED payroll month,
 * because those figures already reflect the leave. Balances are recompute-based, so
 * re-syncing the affected year(s) after cancelling naturally releases the days.
 */
export async function revokeApprovedLeaveRequest(params: {
  companyId: string;
  leaveId: string;
  reason?: string | null;
  actorUserId?: string | null;
}): Promise<void> {
  const lr = await prisma.leaveRequest.findFirst({
    where: { id: params.leaveId, companyId: params.companyId },
  });
  if (!lr) throw new Error("Kërkesa nuk u gjet.");
  if (lr.status !== "APPROVED") throw new Error("Vetëm pushimet e miratuara mund të revokohen.");

  const lockBlock = await payrollLockedOverlapBlock({
    companyId: params.companyId,
    startDate: lr.startDate,
    endDate: lr.endDate,
    includeArchived: true,
  });
  if (lockBlock.blocks.length > 0) {
    throw new Error(
      lockBlock.blocks[0]?.message ??
        "Pushimi nuk mund të revokohet sepse përputhet me një payroll të kyçur, të miratuar ose të arkivuar.",
    );
  }

  const reason = params.reason?.trim() || null;

  await prisma.leaveRequest.update({
    where: { id: lr.id },
    data: {
      status: "CANCELLED",
      affectsPayroll: false,
      rejectionReason: reason,
    },
  });

  const y = lr.startDate.getUTCFullYear();
  await syncLeaveBalancesForEmployeeYear(params.companyId, lr.employeeId, y);
  const y2 = lr.endDate.getUTCFullYear();
  if (y2 !== y) await syncLeaveBalancesForEmployeeYear(params.companyId, lr.employeeId, y2);

  await syncDraftPayrollsAfterLeaveChange({
    companyId: params.companyId,
    employeeId: lr.employeeId,
    leaveId: lr.id,
    startDate: lr.startDate,
    endDate: lr.endDate,
    actorUserId: params.actorUserId,
  });

  const yearsSynced = y2 !== y ? [y, y2] : [y];

  await appendLeaveTimeline({
    companyId: params.companyId,
    employeeId: lr.employeeId,
    leaveId: lr.id,
    eventType: "LEAVE_REVOKED",
    title: "Pushimi i miratuar u revokua",
    body: reason ?? undefined,
    severity: TimelineEventSeverity.WARNING,
  });

  await appendLeaveDomainActivity({
    companyId: params.companyId,
    leaveId: lr.id,
    verb: "VOIDED",
    summary: "Pushimi i miratuar u revokua dhe balancat u rikthyen.",
    payload: JSON.parse(
      JSON.stringify({ balanceYearsSynced: yearsSynced, reason }),
    ) as Prisma.InputJsonValue,
  });
}

export async function cancelLeaveRequest(params: { companyId: string; leaveId: string }): Promise<void> {
  const lr = await prisma.leaveRequest.findFirst({
    where: { id: params.leaveId, companyId: params.companyId },
  });
  if (!lr) throw new Error("Kërkesa nuk u gjet.");
  if (lr.status === "APPROVED") throw new Error("Pushimi i miratuar nuk mund të anulohet nga ky rrjedhë.");
  if (lr.status === "CANCELLED") return;

  await prisma.leaveRequest.update({
    where: { id: lr.id },
    data: {
      status: "CANCELLED",
      affectsPayroll: false,
    },
  });

  await appendLeaveTimeline({
    companyId: params.companyId,
    employeeId: lr.employeeId,
    leaveId: lr.id,
    eventType: "LEAVE_CANCELLED",
    title: "Pushimi u anulua",
  });

  await appendLeaveDomainActivity({
    companyId: params.companyId,
    leaveId: lr.id,
    verb: "VOIDED",
    summary: "Kërkesa e pushimit u anulua.",
  });
}
