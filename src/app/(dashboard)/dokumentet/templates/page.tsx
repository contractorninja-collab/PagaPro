import type { Metadata } from "next";
import Link from "next/link";
import { TemplatesLibraryClient } from "@/modules/documents/components/templates-library-client";
import { listDocumentTemplatesWithVersions } from "@/modules/documents/services/document-queries";
import { requireCompanyContextPage } from "@/server/company-context";

export const metadata: Metadata = {
  title: "Shabllonet — Dokumentet",
};

function placeholderCountFromJson(value: unknown): number {
  if (value == null) return 0;
  if (Array.isArray(value)) return value.length;
  return 0;
}

export default async function DokumentetTemplatesPage() {
  const { companyId } = await requireCompanyContextPage();

  let templates;
  try {
    templates = await listDocumentTemplatesWithVersions(companyId);
  } catch (err) {
    console.error("[pagapro] DokumentetTemplatesPage failed", err);
    return (
      <div className="mx-auto max-w-xl py-12">
        <p className="text-sm text-destructive">Nuk mund të lexohen shabllonet.</p>
      </div>
    );
  }

  const rows = templates.map((t) => ({
    id: t.id,
    name: t.name,
    documentCategory: t.documentCategory,
    isActive: t.isActive,
    terminationWorkflowKey: t.terminationWorkflowKey ?? null,
    versions: t.versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      isPublished: v.isPublished,
      isMapped: v.isMapped,
      detectionMode: v.detectionMode,
      uploadedAt: v.uploadedAt.toISOString(),
      originalFilename: v.originalFilename,
      placeholderCount: placeholderCountFromJson(v.detectedPlaceholders),
      blankCount: placeholderCountFromJson(v.detectedBlankFields),
    })),
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/dokumentet"
        className="inline-flex text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        ← Kthehu te dokumentet
      </Link>
      <TemplatesLibraryClient templates={rows} />
    </div>
  );
}
