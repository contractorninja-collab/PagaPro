import Link from "next/link";
import { notFound } from "next/navigation";
import { AppSubBar } from "@/components/layout/app-sub-bar";
import { cn } from "@/lib/utils";
import { DOCUMENT_CATEGORY_LABELS } from "@/modules/documents/components/document-labels";
import {
  DocChip,
  docBtnSecondaryDense,
  docCard,
  docTableCell,
  docTableHead,
} from "@/modules/documents/components/doc-ui";
import { getDocumentTemplateDetail } from "@/modules/documents/services/document-queries";
import { requireCompanyContextPage } from "@/server/company-context";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { companyId } = await requireCompanyContextPage();

  const { id } = await params;
  const template = await getDocumentTemplateDetail(companyId, id);
  if (!template) notFound();

  return (
    <>
      <AppSubBar
        dense
        backHref="/dokumentet/templates"
        backLabel="Shabllonet"
        title={template.name}
        description={`${DOCUMENT_CATEGORY_LABELS[template.documentCategory]}${
          template.templateSubtype ? ` · ${template.templateSubtype}` : ""
        }`}
      />
      <div className="space-y-5">
        <div className={cn(docCard, "overflow-hidden")}>
          <div className="border-b border-[#eef2f7] px-4 py-3">
            <h2 className="text-[13.5px] font-bold text-[#0f172a]">Versionet</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#eef2f7] bg-[#f8fafc]">
                  <th className={docTableHead}>Versioni</th>
                  <th className={docTableHead}>Detektimi</th>
                  <th className={docTableHead}>Mapuar</th>
                  <th className={docTableHead}>Publikuar</th>
                  <th className={cn(docTableHead, "text-right")}>Veprime</th>
                </tr>
              </thead>
              <tbody>
                {template.versions.map((v) => {
                  const blankCount = Array.isArray(v.detectedBlankFields)
                    ? v.detectedBlankFields.length
                    : 0;
                  return (
                    <tr
                      key={v.id}
                      className="border-b border-[#f1f5f9] transition-colors last:border-0 hover:bg-[#f8fafc]"
                    >
                      <td className={cn(docTableCell, "text-[13px] font-semibold tabular-nums text-[#0f172a]")}>
                        v{v.versionNumber}
                      </td>
                      <td className={cn(docTableCell, "text-[13px] text-[#334155]")}>
                        {v.detectionMode ?? "—"}
                        <span className="mt-0.5 block text-[12px] text-[#94a3b8]">
                          {blankCount} bosh ·{" "}
                          {Array.isArray(v.detectedPlaceholders) ? v.detectedPlaceholders.length : 0}{" "}
                          tags
                        </span>
                      </td>
                      <td className={docTableCell}>
                        <DocChip tone={v.isMapped ? "success" : "neutral"}>
                          {v.isMapped ? "Po" : "Jo"}
                        </DocChip>
                      </td>
                      <td className={docTableCell}>
                        <DocChip tone={v.isPublished ? "success" : "neutral"}>
                          {v.isPublished ? "Po" : "Jo"}
                        </DocChip>
                      </td>
                      <td className={cn(docTableCell, "text-right")}>
                        {blankCount > 0 || v.detectionMode === "MIXED" ? (
                          <Link
                            href={`/dokumentet/templates/${template.id}/mapping?versionId=${v.id}`}
                            className={docBtnSecondaryDense}
                          >
                            Mapo fushat
                          </Link>
                        ) : (
                          <span className="text-[12px] text-[#94a3b8]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
