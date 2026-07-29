"use client";

import { Download, FileWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DOCUMENT_CATEGORY_LABELS } from "@/modules/documents/components/document-labels";
import { DocChip, docBtnPrimaryDense, docBtnSecondaryDense } from "@/modules/documents/components/doc-ui";
import type { ArtifactRow } from "@/modules/documents/components/documents-dashboard-client";

/**
 * The register's "Shiko" action. No new rendering pipeline: the PDF artifact
 * route already supports `?inline=1` (used elsewhere in the app), so this is
 * just an <iframe> against it rather than a raw metadata dump.
 */
export function DocumentPreviewSheet({
  artifact,
  onOpenChange,
}: {
  artifact: ArtifactRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={artifact != null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-2xl">
        {artifact ? (
          <>
            <SheetHeader>
              <SheetTitle className="pr-8">{artifact.title}</SheetTitle>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <DocChip tone="info">{DOCUMENT_CATEGORY_LABELS[artifact.documentCategory]}</DocChip>
                {artifact.employeeLabel ? (
                  <span className="text-[12.5px] text-muted-foreground">{artifact.employeeLabel}</span>
                ) : null}
              </div>
            </SheetHeader>

            <div className="min-h-0 flex-1">
              {artifact.hasPdf ? (
                <iframe
                  key={artifact.id}
                  title={artifact.title}
                  src={`/api/dokumentet/artifacts/${artifact.id}/pdf?inline=1`}
                  className="h-full w-full border-0"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <FileWarning className="h-8 w-8 text-[#cbd5e1]" aria-hidden />
                  <p className="text-[13.5px] font-semibold text-[#0f172a]">
                    Ky dokument s&apos;ka version PDF.
                  </p>
                  <p className="max-w-xs text-[13px] text-muted-foreground">
                    Shkarkoni skedarin DOCX për ta parë.
                  </p>
                  <a
                    className={docBtnPrimaryDense}
                    href={`/api/dokumentet/artifacts/${artifact.id}/docx`}
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Shkarko DOCX
                  </a>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-3">
              <a
                className={docBtnSecondaryDense}
                href={`/api/dokumentet/artifacts/${artifact.id}/${artifact.hasPdf ? "pdf" : "docx"}`}
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                {artifact.hasPdf ? "PDF" : "DOCX"}
              </a>
              <a
                href={`/dokumentet/${artifact.id}`}
                className={cn(docBtnSecondaryDense, "border-transparent bg-transparent hover:bg-[#eef2f7]")}
              >
                Hap faqen e detajeve
              </a>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
