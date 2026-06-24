import { TimelineEventSeverity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LEAVE_ENGINE_RULE_VERSION } from "@/modules/leaves/constants/rule-versions";
import { LEAVE_TIMELINE } from "@/modules/leaves/constants/timeline";

function rangesOverlapUtcInclusive(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() <= bEnd.getTime() && bStart.getTime() <= aEnd.getTime();
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

/**
 * Art 34.2 — record that approved sick leave interrupted approved annual leave for overlapping days.
 * Payroll uses `interruptedByLeaveRequestId` to avoid double-counting paid annual hours where sick applies.
 */
export async function linkApprovedSickInterruptingAnnualLeave(params: {
  companyId: string;
  annualLeaveId: string;
  sickLeaveId: string;
}): Promise<void> {
  const [annual, sick] = await Promise.all([
    prisma.leaveRequest.findFirst({
      where: { id: params.annualLeaveId, companyId: params.companyId },
    }),
    prisma.leaveRequest.findFirst({
      where: { id: params.sickLeaveId, companyId: params.companyId },
    }),
  ]);

  if (!annual || !sick) throw new Error("Njëra nga kërkesat nuk u gjet.");
  if (annual.status !== "APPROVED" || sick.status !== "APPROVED") {
    throw new Error("Lidhja lejohet vetëm për kërkesa të miratuara.");
  }
  if (annual.type !== "PUSHIM_VJETOR" || sick.type !== "PUSHIM_MJEKESOR") {
    throw new Error("Lidhja kërkon pushim vjetor dhe pushim mjekësor.");
  }
  if (annual.employeeId !== sick.employeeId) {
    throw new Error("Kërkesat duhet të jenë për të njëjtin punonjës.");
  }
  if (!rangesOverlapUtcInclusive(annual.startDate, annual.endDate, sick.startDate, sick.endDate)) {
    throw new Error("Intervallet nuk mbivendosen — nuk ka ndërprerje për t’u lidhur.");
  }
  if (annual.interruptedByLeaveRequestId && annual.interruptedByLeaveRequestId !== sick.id) {
    throw new Error("Ky pushim vjetor është tashmë i lidhur me një pushim tjetër.");
  }

  await prisma.leaveRequest.update({
    where: { id: annual.id },
    data: {
      interruptedByLeaveRequestId: sick.id,
      supersedesWorkingDaysSnapshot: {
        linkedAt: new Date().toISOString(),
        ruleVersion: LEAVE_ENGINE_RULE_VERSION,
        priorWorkingDays: annual.workingDays?.toString() ?? null,
        priorTotalHours: annual.totalHours?.toString() ?? null,
        sickLeaveId: sick.id,
      },
    },
  });

  await appendLeaveTimeline({
    companyId: params.companyId,
    employeeId: annual.employeeId,
    leaveId: annual.id,
    eventType: LEAVE_TIMELINE.INTERRUPT_LINKED,
    title: "Pushim vjetor — lidhur me pushim mjekësor (Art 34.2)",
    body: `Pushimi mjekësor ${sick.id}: mbivendosje me intervalin vjetor.`,
  });

  await appendLeaveTimeline({
    companyId: params.companyId,
    employeeId: sick.employeeId,
    leaveId: sick.id,
    eventType: LEAVE_TIMELINE.INTERRUPT_LINKED,
    title: "Pushim mjekësor — ndërpret pushimin vjetor",
    body: `Pushimi vjetor ${annual.id}: orët e mbivendosjes trajtohen si mjekësor në payroll.`,
  });

  try {
    await prisma.domainActivity.create({
      data: {
        companyId: params.companyId,
        entityType: "LeaveRequest",
        entityId: annual.id,
        verb: "UPDATED",
        summary: "U lidh ndërprerja e pushimit vjetor me pushimin mjekësor (Art 34.2).",
        payload: {
          ruleVersion: LEAVE_ENGINE_RULE_VERSION,
          sickLeaveId: sick.id,
          kosovoRefs: ["Art 34.2"],
        },
      },
    });
  } catch {
    /* non-blocking */
  }
}
