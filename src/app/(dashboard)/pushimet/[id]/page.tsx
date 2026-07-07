import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getLeaveRequestDetail,
  listLeaveHistoryForEmployee,
  listLeaveTemplatesPicklist,
  listLeaveTimelineForRequest,
  listUpcomingLeaveForEmployee,
} from "@/modules/leaves/services/leave-query-service";
import { listLeaveBalancesForEmployee } from "@/modules/leaves/services/leave-balance-service";
import {
  PushimetDetailClient,
  type PushimetBalanceSerialized,
  type PushimetDetailSerialized,
  type PushimetTimelineSerialized,
} from "@/modules/leaves/components/pushimet-detail-client";
import type { PushimetLeaveRowDto, PushimetTemplateOptionDto } from "@/modules/leaves/types/pushimet";
import type { LeaveRequestStatus, LeaveSubtype, LeaveType } from "@prisma/client";
import { resolveActiveCompanyId } from "@/server/company-scope";

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await props.params;
  return { title: `Pushimi ${id.slice(0, 8)}…` };
}

function serializeLeaveRowDto(lr: {
  id: string;
  employeeId: string;
  type: LeaveType;
  subtype: LeaveSubtype;
  interruptedByLeaveRequestId: string | null;
  status: LeaveRequestStatus;
  startDate: Date;
  endDate: Date;
  totalDays: { toString(): string } | null | undefined;
  workingDays: { toString(): string } | null | undefined;
  totalHours: { toString(): string } | null | undefined;
  isPaid: boolean;
  affectsPayroll: boolean;
  reason: string | null;
  rejectionReason: string | null;
  decidedAt: Date | null;
  employee: { firstName: string; lastName: string; department: { name: string } | null };
  decidedByMembership?:
    | { user: { displayName: string | null; email: string | null } }
    | null;
}): PushimetLeaveRowDto {
  return {
    id: lr.id,
    employeeId: lr.employeeId,
    employeeName: `${lr.employee.firstName} ${lr.employee.lastName}`.trim(),
    departmentName: lr.employee.department?.name ?? null,
    type: lr.type,
    subtype: lr.subtype,
    interruptedByLeaveRequestId: lr.interruptedByLeaveRequestId,
    status: lr.status,
    startDateIso: lr.startDate.toISOString(),
    endDateIso: lr.endDate.toISOString(),
    totalDays: lr.totalDays?.toString() ?? null,
    workingDays: lr.workingDays?.toString() ?? null,
    totalHours: lr.totalHours?.toString() ?? null,
    isPaid: lr.isPaid,
    affectsPayroll: lr.affectsPayroll,
    reason: lr.reason,
    rejectionReason: lr.rejectionReason,
    decidedAtIso: lr.decidedAt?.toISOString() ?? null,
    decidedByLabel:
      lr.decidedByMembership?.user.displayName?.trim() ||
      lr.decidedByMembership?.user.email?.trim() ||
      null,
  };
}

export default async function PushimetDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const companyId = await resolveActiveCompanyId();

  if (!companyId) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <p className="text-sm text-muted-foreground">Nuk ka kompani aktive.</p>
      </div>
    );
  }

  let detail;
  try {
    detail = await getLeaveRequestDetail(companyId, id);
  } catch (err) {
    console.error("[pagapro] PushimetDetailPage", err);
    return (
      <div className="mx-auto max-w-xl py-12">
        <p className="text-sm text-destructive">Gabim leximi nga databaza.</p>
      </div>
    );
  }

  if (!detail) notFound();

  const rowDto = serializeLeaveRowDto(detail);

  const detailPayload: PushimetDetailSerialized = {
    row: rowDto,
    documents: detail.documents.map((d) => ({
      leaveDocumentId: d.id,
      artifactId: d.generatedDocumentId,
      title: d.artifact.title,
      createdAtIso: d.artifact.createdAt.toISOString(),
    })),
    createdByLabel:
      detail.createdBy?.displayName?.trim() || detail.createdBy?.email?.trim() || null,
  };

  const yStart = detail.startDate.getUTCFullYear();
  const yEnd = detail.endDate.getUTCFullYear();
  const years = yEnd !== yStart ? [yStart, yEnd] : [yStart];

  let timelineRaw;
  let upcomingRaw;
  let historyRaw;
  let templatesRaw;
  let balancesGroups: { year: number; rows: PushimetBalanceSerialized[] }[];

  try {
    ;[timelineRaw, upcomingRaw, historyRaw, templatesRaw] = await Promise.all([
      listLeaveTimelineForRequest(companyId, id),
      listUpcomingLeaveForEmployee(companyId, detail.employeeId),
      listLeaveHistoryForEmployee(companyId, detail.employeeId),
      listLeaveTemplatesPicklist(companyId),
    ]);

    balancesGroups = [];
    for (const y of years) {
      const balRows = await listLeaveBalancesForEmployee(companyId, detail.employeeId, y);
      balancesGroups.push({
        year: y,
        rows: balRows.map((b) => ({
          id: b.id,
          leaveType: b.leaveType,
          year: b.year,
          yearlyQuota: b.yearlyQuota.toString(),
          accruedDays: b.accruedYtd.toString(),
          usedDays: b.usedDays.toString(),
          pendingDays: b.pendingDays.toString(),
          remainingDays: b.remainingDays.toString(),
          carryOverDays: b.carryOverDays.toString(),
        })),
      });
    }
  } catch (err) {
    console.error("[pagapro] PushimetDetailPage secondary queries", err);
    return (
      <div className="mx-auto max-w-xl py-12">
        <p className="text-sm text-destructive">Gabim gjatë ngarkimit të detajeve.</p>
      </div>
    );
  }

  const timeline: PushimetTimelineSerialized[] = timelineRaw.map((ev) => ({
    id: ev.id,
    occurredAtIso: ev.occurredAt.toISOString(),
    eventType: ev.eventType,
    title: ev.title,
    body: ev.body,
    actorLabel:
      ev.actor?.displayName?.trim() ||
      ev.actor?.email?.trim() ||
      ev.actorMembership?.user.displayName?.trim() ||
      ev.actorMembership?.user.email?.trim() ||
      null,
    metadataJson:
      ev.metadata == null
        ? null
        : typeof ev.metadata === "object"
          ? JSON.stringify(ev.metadata, null, 2)
          : String(ev.metadata),
  }));

  const upcoming = upcomingRaw.map((r) =>
    serializeLeaveRowDto({
      ...r,
      employee: detail.employee,
      decidedByMembership: null,
    }),
  );

  const history = historyRaw.map((r) =>
    serializeLeaveRowDto({
      ...r,
      employee: detail.employee,
      decidedByMembership: null,
    }),
  );

  const templates: PushimetTemplateOptionDto[] = templatesRaw.map((t) => ({
    id: t.id,
    name: t.name,
  }));

  return (
    <PushimetDetailClient
      detail={detailPayload}
      timeline={timeline}
      balancesByYear={balancesGroups}
      upcoming={upcoming}
      history={history}
      templates={templates}
    />
  );
}
