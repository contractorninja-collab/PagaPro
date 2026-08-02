import type { Metadata } from "next";
import { DocumentGenerateWizardClient } from "@/modules/documents/components/document-generate-wizard-client";
import {
  listDocumentTemplatesWithVersions,
  listEmployeesForDocumentFilters,
  listLeaveRequestsForGeneration,
  listTerminationsForGeneration,
  listWarningsForGeneration,
} from "@/modules/documents/services/document-queries";
import { requireCompanyContextPage } from "@/server/company-context";
import { LEAVE_TYPE_LABELS_SQ } from "@/modules/leaves/helpers/leave-type-metadata";

const LEAVE_STATUS_LABELS_SQ: Record<string, string> = {
  DRAFT: "Draft",
  PENDING: "Në pritje",
  APPROVED: "Miratuar",
  REJECTED: "Refuzuar",
  CANCELLED: "Anuluar",
};

const TERMINATION_STATUS_LABELS_SQ: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Në shqyrtim",
  APPROVED: "Miratuar",
  COMPLETED: "Përfunduar",
  CANCELLED: "Anuluar",
};

const WARNING_STATUS_LABELS_SQ: Record<string, string> = {
  DRAFT: "Draft",
  ISSUED: "E lëshuar",
  VOID: "E anuluar",
};

function sqDate(d: Date): string {
  return d.toLocaleDateString("sq-AL", { timeZone: "UTC" });
}

export const metadata: Metadata = {
  title: "Gjenero dokument — Dokumentet",
};

function first(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function DokumentetGeneratePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { companyId } = await requireCompanyContextPage();

  const sp = await searchParams;
  const initialEmployeeId = first(sp, "employeeId");
  const initialCategory = first(sp, "category");

  const [templates, employees, leaves, terminations, warnings] = await Promise.all([
    listDocumentTemplatesWithVersions(companyId),
    listEmployeesForDocumentFilters(companyId),
    listLeaveRequestsForGeneration(companyId),
    listTerminationsForGeneration(companyId),
    listWarningsForGeneration(companyId),
  ]);

  const templateOptions = templates.flatMap((t) => {
    const published = t.versions.find((v) => v.isPublished && v.isMapped);
    if (!published) return [];
    return [
      {
        templateId: t.id,
        templateName: t.name,
        documentCategory: t.documentCategory,
        templateSubtype: t.templateSubtype,
        versionId: published.id,
        versionNumber: published.versionNumber,
        isMapped: published.isMapped,
      },
    ];
  });

  return (
    <DocumentGenerateWizardClient
      templates={templateOptions}
      employees={employees.map((e) => ({
        id: e.id,
        label: `${e.lastName} ${e.firstName}`.trim(),
      }))}
      leaves={[
        // The subject of a leave document is the leave case (its dates and type
        // fill the template), but the list reads as an employee list: one row
        // per request labelled by person, plus greyed-out rows for employees
        // who have no request yet — so nobody wonders where their staff went.
        ...leaves.map((r) => ({
          id: r.id,
          label: `${r.employee.lastName} ${r.employee.firstName} — ${
            LEAVE_TYPE_LABELS_SQ[r.type] ?? r.type
          } · ${sqDate(r.startDate)}–${sqDate(r.endDate)} (${
            LEAVE_STATUS_LABELS_SQ[r.status] ?? r.status
          })`,
        })),
        ...employees
          .filter((e) => !leaves.some((r) => r.employeeId === e.id))
          .map((e) => ({
            id: `no-leave-${e.id}`,
            label: `${e.lastName} ${e.firstName}`.trim(),
            disabled: true,
            disabledHint: "pa kërkesë pushimi — regjistrojeni te Pushimet",
          })),
      ]}
      terminations={[
        ...terminations.map((r) => ({
          id: r.id,
          label: `${r.employee.lastName} ${r.employee.firstName} — dita e fundit ${sqDate(
            r.lastWorkingDay,
          )} (${TERMINATION_STATUS_LABELS_SQ[r.status] ?? r.status})`,
        })),
        ...employees
          .filter((e) => !terminations.some((r) => r.employeeId === e.id))
          .map((e) => ({
            id: `no-termination-${e.id}`,
            label: `${e.lastName} ${e.firstName}`.trim(),
            disabled: true,
            disabledHint: "pa largim të regjistruar — hapeni te Largimet",
          })),
      ]}
      warnings={[
        ...warnings.map((r) => ({
          id: r.id,
          label: `${r.employee.lastName} ${r.employee.firstName} — ${r.summary.slice(0, 56)} · ${sqDate(
            r.issuedAt,
          )} (${WARNING_STATUS_LABELS_SQ[r.status] ?? r.status})`,
        })),
        ...employees
          .filter((e) => !warnings.some((r) => r.employeeId === e.id))
          .map((e) => ({
            id: `no-warning-${e.id}`,
            label: `${e.lastName} ${e.firstName}`.trim(),
            disabled: true,
            disabledHint: "pa vërejtje — lëshojeni te «Lësho vërejtje»",
          })),
      ]}
      initialEmployeeId={initialEmployeeId || undefined}
      initialCategory={initialCategory || undefined}
    />
  );
}
