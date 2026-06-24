import type { Metadata } from "next";
import { DocumentGenerateWizardClient } from "@/modules/documents/components/document-generate-wizard-client";
import {
  listDocumentTemplatesWithVersions,
  listEmployeesForDocumentFilters,
  listLeaveRequestsForGeneration,
  listTerminationsForGeneration,
  listWarningsForGeneration,
} from "@/modules/documents/services/document-queries";
import { resolveActiveCompanyId } from "@/server/company-scope";

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
  const companyId = await resolveActiveCompanyId();
  if (!companyId) {
    return (
      <div className="py-12">
        <p className="text-sm text-muted-foreground">Nuk ka kompani aktive.</p>
      </div>
    );
  }

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
      leaves={leaves.map((r) => ({
        id: r.id,
        label: `${r.employee.firstName} ${r.employee.lastName} — ${r.status}`,
      }))}
      terminations={terminations.map((r) => ({
        id: r.id,
        label: `${r.employee.firstName} ${r.employee.lastName} — ${r.status}`,
      }))}
      warnings={warnings.map((r) => ({
        id: r.id,
        label: `${r.employee.firstName} ${r.employee.lastName} — ${r.summary.slice(0, 56)}`,
      }))}
      initialEmployeeId={initialEmployeeId || undefined}
      initialCategory={initialCategory || undefined}
    />
  );
}
