import type { Metadata } from "next";
import type { DocumentTemplateSubtype } from "@prisma/client";
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
  listContractDocumentsForEmployee,
  listPayrollGeneratedDocsForEmployee,
} from "@/modules/documents/services/document-queries";
import {
  listLeaveBalancesForEmployee,
  listLeaveHistoryForEmployee,
} from "@/modules/leaves/services/leave-query-service";
import type { EmployeeLeaveBundle } from "@/modules/leaves/helpers/employee-leave-view";
import { listEmployeeDocumentsForEmployee } from "@/modules/employee-documents/services/employee-document-service";
import { isInlinePreviewable } from "@/modules/employee-documents/services/employee-document-file";
import { formatSqDate } from "@/modules/employees/components/employees-labels";
import type { EmployeeDossierBundle } from "@/modules/employee-documents/types/employee-document-types";
import { can } from "@/server/permissions";
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

/** Contract subtype → the wording used on the contract itself. */
const CONTRACT_SUBTYPE_LABELS: Record<DocumentTemplateSubtype, string> = {
  AFAT_I_CAKTUAR: "Në kohë të caktuar",
  AFAT_I_PACAKTUAR: "Në kohë të pacaktuar",
  KONTRATE_SPECIFIKE: "Kontratë specifike",
  PRAKTIKANT: "Praktikant",
};

function contractSubtypeLabel(subtype: DocumentTemplateSubtype | null): string | null {
  return subtype ? CONTRACT_SUBTYPE_LABELS[subtype] : null;
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
  const { companyId, user, role } = await requireCompanyContextPage();
  const viewerSeesSensitive = can(
    { role, isPlatformAdmin: user.isPlatformAdmin },
    "documents.sensitive",
  );

  const balanceYear = new Date().getUTCFullYear();

  let employee;
  let departments;
  let genDocs;
  let contractDocs;
  let payrollDocs;
  let jobTitles;
  let leaveRequests;
  let leaveBalances;
  let timelineRows;
  let uploadedDocs;
  try {
    [employee, departments, genDocs, contractDocs, payrollDocs, jobTitles, leaveRequests, leaveBalances, timelineRows, uploadedDocs] =
      await Promise.all([
        getEmployeeById(companyId, id),
        listDepartmentsForCompany(companyId),
        listArtifactsForEmployee(companyId, id),
        listContractDocumentsForEmployee(companyId, id),
        listPayrollGeneratedDocsForEmployee(companyId, id),
        listActiveJobTitleOptions(companyId),
        listLeaveHistoryForEmployee(companyId, id),
        listLeaveBalancesForEmployee(companyId, id, balanceYear),
        listTimelineForEmployee(companyId, id),
        listEmployeeDocumentsForEmployee({
          companyId,
          employeeId: id,
          includeSensitive: viewerSeesSensitive,
          includeArchived: true,
        }),
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
    /**
     * The generated contract documents — not rows of the `contracts` table,
     * which nothing in the app writes, so this register was empty for every
     * employee while their contract sat one tab over under Dokumentet.
     */
    contracts: contractDocs.map((a) => ({
      id: a.id,
      title: a.title,
      kind: a.kind,
      subtypeLabel: contractSubtypeLabel(a.templateVersion.template.templateSubtype),
      createdAtIso: a.createdAt.toISOString(),
      hasPdf: Boolean(a.generatedPdfStorageKey),
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

  const dossier: EmployeeDossierBundle = {
    employeeId: id,
    viewerSeesSensitive,
    documents: uploadedDocs.map((d) => ({
      id: d.id,
      category: d.category,
      title: d.title,
      note: d.note,
      displayFilename: d.displayFilename,
      contentType: d.contentType,
      sizeBytes: d.sizeBytes,
      issuedAtIso: d.issuedAt?.toISOString() ?? null,
      expiresAtIso: d.expiresAt?.toISOString() ?? null,
      isArchived: d.isArchived,
      createdAtIso: d.createdAt.toISOString(),
      createdAtLabel: formatSqDate(d.createdAt.toISOString()),
      uploadedByName: d.uploadedBy?.displayName ?? d.uploadedBy?.email ?? null,
      inlinePreviewable: isInlinePreviewable(d.contentType),
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
      dossier={dossier}
      todayIso={new Date().toISOString()}
      leaveCenter={leaveCenter}
      timelineEntries={timelineEntries}
      openEditDocuments={openEditDocuments}
      timeClockEnabled={await isTimeClockEnabled(companyId)}
    />
  );
}
