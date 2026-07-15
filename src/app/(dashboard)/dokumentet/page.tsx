import type { Metadata } from "next";
import Link from "next/link";
import type { DocumentCategory } from "@prisma/client";
import { AppSubBar } from "@/components/layout/app-sub-bar";
import { Button } from "@/components/ui/button";
import { DocumentsDashboardClient } from "@/modules/documents/components/documents-dashboard-client";
import { DocumentsListFilters } from "@/modules/documents/components/documents-list-filters";
import {
  listArtifactAuthorsForFilter,
  listDocumentArtifacts,
  listDocumentTemplatesWithVersions,
  listEmployeesForDocumentFilters,
} from "@/modules/documents/services/document-queries";
import { requireCompanyContextPage } from "@/server/company-context";

export const metadata: Metadata = {
  title: "Dokumentet",
};

const CATEGORIES = new Set<DocumentCategory>([
  "CONTRACT",
  "LEAVE",
  "TERMINATION",
  "WARNING",
  "PAYROLL",
  "OTHER",
]);

function first(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function DokumentetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { companyId } = await requireCompanyContextPage();

  const sp = await searchParams;
  const q = first(sp, "q");
  const employeeId = first(sp, "employeeId");
  const catRaw = first(sp, "documentCategory");
  const documentCategory = CATEGORIES.has(catRaw as DocumentCategory) ? (catRaw as DocumentCategory) : undefined;
  const month = first(sp, "month");
  const archivedRaw = first(sp, "archived");
  const archived = archivedRaw === "yes" || archivedRaw === "no" ? archivedRaw : "all";
  const authorId = first(sp, "authorId");

  let artifacts;
  let templates;
  let employees;
  let authors;

  try {
    ;[
      artifacts,
      templates,
      employees,
      authors,
    ] = await Promise.all([
      listDocumentArtifacts(companyId, {
        q: q || undefined,
        employeeId: employeeId || undefined,
        documentCategory,
        month: month || undefined,
        archived,
        createdByUserId: authorId || undefined,
      }),
      listDocumentTemplatesWithVersions(companyId),
      listEmployeesForDocumentFilters(companyId),
      listArtifactAuthorsForFilter(companyId),
    ]);
  } catch (err) {
    console.error("[pagapro] DokumentetPage load failed", err);
    return (
      <div className="mx-auto max-w-xl py-12">
        <p className="text-sm font-medium text-destructive">
          Nuk mund të lexohen dokumentet. Ekzekutoni{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npx prisma migrate deploy</code>.
        </p>
      </div>
    );
  }

  const artifactRows = artifacts.map((a) => ({
    id: a.id,
    title: a.title,
    displayFilename: a.displayFilename,
    documentCategory: a.documentCategory,
    kind: a.kind,
    createdAt: a.createdAt.toISOString(),
    createdAtLabel: a.createdAt.toLocaleString("sq-AL", { dateStyle: "short", timeStyle: "short" }),
    isArchived: a.isArchived,
    employeeLabel: a.employee ? `${a.employee.firstName} ${a.employee.lastName}`.trim() : null,
    templateName: a.templateVersion.template.name,
    authorLabel: a.createdBy
      ? (a.createdBy.displayName?.trim() || a.createdBy.email || null)
      : null,
    hasPdf: Boolean(a.generatedPdfStorageKey),
  }));

  const templateSummary = {
    total: templates.length,
    ready: templates.filter((t) => t.versions.some((v) => v.isPublished && v.isMapped)).length,
    needsMapping: templates.filter((t) => t.versions.some((v) => !v.isMapped)).length,
    missingPublished: templates.filter((t) => !t.versions.some((v) => v.isPublished)).length,
  };

  const authorOptions = authors.filter((a): a is NonNullable<typeof a> & { id: string } => Boolean(a?.id));

  return (
    <>
      <AppSubBar
        eyebrow="Menaxhimi i dokumenteve"
        title="Dokumentet"
        description="Qendër e strukturuar për printimin e kontratave, pushimeve, largimeve dhe vërejtjeve me shabllone DOCX."
        actions={
          <>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/dokumentet/templates">Konfigurimi i shablloneve</Link>
            </Button>
            <Button asChild>
              <Link href="/dokumentet/generate">Gjenero dokumente</Link>
            </Button>
          </>
        }
      />
      <DocumentsDashboardClient
        artifacts={artifactRows}
        templateSummary={templateSummary}
        filtersSlot={
          <DocumentsListFilters
            defaults={{
              q,
              employeeId,
              documentCategory: catRaw,
              month,
              archived: archivedRaw || "all",
              authorId,
            }}
            employees={employees}
            authors={authorOptions}
          />
        }
      />
    </>
  );
}
