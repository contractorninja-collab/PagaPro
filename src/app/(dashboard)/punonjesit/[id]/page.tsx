import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  EmployeeProfileShell,
  type EmployeeProfileDocumentsBundle,
} from "@/modules/employees/components/employee-profile-shell";
import {
  getEmployeeById,
  listDepartmentsForCompany,
  listTimelineForEmployee,
} from "@/modules/employees/services/employee-service";
import {
  listArtifactsForEmployee,
  listContractsForEmployee,
  listPayrollGeneratedDocsForEmployee,
} from "@/modules/documents/services/document-queries";
import {
  listLeaveBalancesForEmployee,
  listLeaveHistoryForEmployee,
} from "@/modules/leaves/services/leave-query-service";
import type { EmployeeLeaveBundle } from "@/modules/leaves/helpers/employee-leave-view";
import { listActiveJobTitleOptions } from "@/modules/job-titles/services/job-title-service";
import { isTimeClockEnabled } from "@/modules/timeclock/services/timeclock-entitlement";
import { getCompanyContext, requireCompanyContextPage } from "@/server/company-context";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params;
    const result = await getCompanyContext();
    if (!result.ok) return { title: "Punonjësi" };
    const e = await getEmployeeById(result.context.companyId, id);
    if (!e) return { title: "Punonjësi" };
    return { title: `${e.firstName} ${e.lastName}` };
  } catch {
    return { title: "Punonjësi" };
  }
}

export default async function EmployeeProfilePage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const openEditDocuments = first(sp.edit) === "documents";
  const { companyId } = await requireCompanyContextPage();

  const balanceYear = new Date().getUTCFullYear();

  let employee;
  let departments;
  let genDocs;
  let contracts;
  let payrollDocs;
  let jobTitles;
  let leaveRequests;
  let leaveBalances;
  let timelineRows;
  try {
    [employee, departments, genDocs, contracts, payrollDocs, jobTitles, leaveRequests, leaveBalances, timelineRows] =
      await Promise.all([
        getEmployeeById(companyId, id),
        listDepartmentsForCompany(companyId),
        listArtifactsForEmployee(companyId, id),
        listContractsForEmployee(companyId, id),
        listPayrollGeneratedDocsForEmployee(companyId, id),
        listActiveJobTitleOptions(companyId),
        listLeaveHistoryForEmployee(companyId, id),
        listLeaveBalancesForEmployee(companyId, id, balanceYear),
        listTimelineForEmployee(companyId, id),
      ]);
  } catch (err) {
    console.error("[pagapro] EmployeeProfilePage: load failed", err);
    return (
      <div className="mx-auto max-w-xl py-12">
        <p className="text-sm font-medium text-destructive">
          Nuk mund të ngarkohet profili. Verifikoni databazën dhe migrimet{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npx prisma migrate deploy</code>.
        </p>
      </div>
    );
  }

  if (!employee) notFound();

  const documentCenter: EmployeeProfileDocumentsBundle = {
    generatedDocuments: genDocs.map((a) => ({
      id: a.id,
      title: a.title,
      documentCategory: a.documentCategory,
      kind: a.kind,
      createdAtIso: a.createdAt.toISOString(),
      createdAtLabel: a.createdAt.toLocaleString("sq-AL", { dateStyle: "short", timeStyle: "short" }),
      isArchived: a.isArchived,
      templateName: a.templateVersion.template.name,
      templateVersionNumber: a.templateVersion.versionNumber,
      hasPdf: Boolean(a.generatedPdfStorageKey),
    })),
    payrollPdfs: payrollDocs.map((p) => ({
      id: p.id,
      filename: p.filename,
      generatedAtIso: p.generatedAt.toISOString(),
      periodLabel: `${p.payroll.year}-${String(p.payroll.month).padStart(2, "0")}`,
    })),
    contracts: contracts.map((c) => ({
      id: c.id,
      status: c.status,
      referenceCode: c.referenceCode,
      effectiveDateIso: c.effectiveDate.toISOString(),
    })),
  };

  const leaveCenter: EmployeeLeaveBundle = {
    year: balanceYear,
    balances: leaveBalances.map((b) => ({
      leaveType: b.leaveType,
      quota: b.yearlyQuota.toFixed(2),
      used: b.usedDays.toFixed(2),
      pending: b.pendingDays.toFixed(2),
      remaining: b.remainingDays.toFixed(2),
      carryIn: b.carryIn.toFixed(2),
      carryExpiresAtIso: b.carryExpiresAt?.toISOString() ?? null,
    })),
    requests: leaveRequests.map((r) => ({
      id: r.id,
      type: r.type,
      subtype: r.subtype,
      status: r.status,
      startIso: r.startDate.toISOString(),
      endIso: r.endDate.toISOString(),
      days: r.workingDays?.toFixed(2) ?? r.totalDays?.toFixed(2) ?? null,
    })),
  };

  const timelineEntries = timelineRows.map((t) => ({
    id: t.id,
    occurredAtIso: t.occurredAt.toISOString(),
    occurredAtLabel: t.occurredAt.toLocaleString("sq-AL", { dateStyle: "medium", timeStyle: "short" }),
    eventType: t.eventType,
    title: t.title,
    body: t.body,
    severity: t.severity,
    actorName:
      t.actor?.displayName ??
      t.actor?.email ??
      t.actorMembership?.user.displayName ??
      t.actorMembership?.user.email ??
      null,
  }));

  return (
    <EmployeeProfileShell
      employee={employee}
      departments={departments}
      jobTitles={jobTitles}
      documentCenter={documentCenter}
      leaveCenter={leaveCenter}
      timelineEntries={timelineEntries}
      openEditDocuments={openEditDocuments}
      timeClockEnabled={await isTimeClockEnabled(companyId)}
    />
  );
}
