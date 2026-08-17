import type { Metadata } from "next";
import Link from "next/link";
import type { DocumentCategory } from "@prisma/client";
import { AppSubBar } from "@/components/layout/app-sub-bar";
import { Button } from "@/components/ui/button";
import { DocumentsDashboardClient } from "@/modules/documents/components/documents-dashboard-client";
import { DocumentsListFilters } from "@/modules/documents/components/documents-list-filters";
import { WarningIssueTrigger } from "@/modules/documents/components/warning-issue-trigger";
import {
  getDocumentRegisterCounts,
  listArtifactAuthorsForFilter,
  listDocumentArtifactsPage,
  listDocumentTemplatesWithVersions,
  listEmployeesForDocumentFilters,
} from "@/modules/documents/services/document-queries";
import { WarningIssuePanel } from "@/modules/warnings/components/warning-issue-panel";
import { requireCompanyContextPage } from "@/server/company-context";
import { can } from "@/server/permissions";

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
  const { companyId, role, user } = await requireCompanyContextPage();
  // A server component cannot use the client hook, so it asks the same matrix.
  const canWriteDocuments = can({ role, isPlatformAdmin: user.isPlatformAdmin }, "documents.write");

  const sp = await searchParams;
  const q = first(sp, "q");
  const employeeId = first(sp, "employeeId");
  const catRaw = first(sp, "documentCategory");
  const documentCategory = CATEGORIES.has(catRaw as DocumentCategory)
    ? (catRaw as DocumentCategory)
    : undefined;
  const month = first(sp, "month");
  const archivedRaw = first(sp, "archived");
  const archived = archivedRaw === "yes" || archivedRaw === "no" ? archivedRaw : "all";
  const authorId = first(sp, "authorId");
  const pageNumber = Number(first(sp, "page")) || 1;

  const filters = {
    q: q || undefined,
    employeeId: employeeId || undefined,
    documentCategory,
    month: month || undefined,
    archived,
    createdByUserId: authorId || undefined,
  } as const;

  let artifactPage;
  let counts;
  let templates;
  let employees;
  let authors;

  try {
    [artifactPage, counts, templates, employees, authors] = await Promise.all([
      listDocumentArtifactsPage(companyId, filters, pageNumber),
      getDocumentRegisterCounts(companyId),
      listDocumentTemplatesWithVersions(companyId),
      listEmployeesForDocumentFilters(companyId),
      listArtifactAuthorsForFilter(companyId),
    ]);
  } catch (err) {
    console.error("[pagapro] DokumentetPage load failed", err);
    return (
      <>
        <AppSubBar
          eyebrow="Menaxhimi i dokumenteve"
          title="Dokumentet"
          description="Regjistri i dokumenteve të lëshuara nga kompania."
        />
        <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-5 py-6">
          <p className="text-sm font-semibold text-[#7f1d1d]">
            Dokumentet nuk mund të lexohen për momentin.
          </p>
          <p className="mt-1 text-[13px] text-[#991b1b]">
            Rifreskoni faqen. Nëse problemi vazhdon, njoftoni mbështetjen.
          </p>
        </div>
      </>
    );
  }

  const artifactRows = artifactPage.rows.map((a) => ({
    id: a.id,
    title: a.title,
    displayFilename: a.displayFilename,
    documentCategory: a.documentCategory,
    kind: a.kind,
    generationStatus: a.generationStatus,
    createdAt: a.createdAt.toISOString(),
    createdAtLabel: a.createdAt.toLocaleString("sq-AL", { dateStyle: "short", timeStyle: "short" }),
    isArchived: a.isArchived,
    employeeLabel: a.employee ? `${a.employee.firstName} ${a.employee.lastName}`.trim() : null,
    templateName: a.templateVersion.template.name,
    authorLabel: a.createdBy ? a.createdBy.displayName?.trim() || a.createdBy.email || null : null,
    hasPdf: Boolean(a.generatedPdfStorageKey),
  }));

  const templateSummary = {
    total: templates.length,
    ready: templates.filter((t) => t.versions.some((v) => v.isPublished && v.isMapped)).length,
    needsMapping: templates.filter((t) => t.versions.some((v) => !v.isMapped)).length,
    missingPublished: templates.filter((t) => !t.versions.some((v) => v.isPublished)).length,
  };

  const authorOptions = authors.filter(
    (a): a is NonNullable<typeof a> & { id: string } => Boolean(a?.id),
  );

  const filtersActive = Boolean(q || employeeId || catRaw || month || archivedRaw || authorId);

  return (
    <>
      <AppSubBar
        eyebrow="Menaxhimi i dokumenteve"
        title="Dokumentet"
        description="Regjistri i çdo dokumenti të lëshuar — kontrata, pushime, largime, aneks dhe vërejtje."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/dokumentet/templates">Shabllonet</Link>
            </Button>
            <WarningIssueTrigger>
              <WarningIssuePanel
                employees={employees.map((e) => ({
                  id: e.id,
                  label: `${e.lastName} ${e.firstName}`.trim(),
                }))}
              />
            </WarningIssueTrigger>
            {canWriteDocuments ? (
              <Button asChild>
                <Link href="/dokumentet/generate">Gjenero dokumente</Link>
              </Button>
            ) : null}
          </div>
        }
      />
      <DocumentsDashboardClient
        artifacts={artifactRows}
        counts={counts}
        page={{
          page: artifactPage.page,
          pageCount: artifactPage.pageCount,
          total: artifactPage.total,
          pageSize: artifactPage.pageSize,
        }}
        filtersActive={filtersActive}
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
