"use client";

import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { toast } from "sonner";
import type { DocumentCategory } from "@prisma/client";
import { AlertTriangle } from "lucide-react";
import { AppSubBar, SubBarStatus } from "@/components/layout/app-sub-bar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { docCard } from "@/modules/documents/components/doc-ui";
import {
  archiveArtifactAction,
  logDocumentDownloadAction,
  regenerateDocumentAction,
} from "@/modules/documents/actions/documents-actions";
import { DOCUMENT_CATEGORY_LABELS } from "@/modules/documents/components/document-labels";

export interface DocumentDetailClientProps {
  artifact: {
    id: string;
    title: string;
    displayFilename: string;
    documentCategory: DocumentCategory;
    kind: string;
    createdAt: string;
    /** Pre-formatted on the server — avoids client locale hydration mismatches. */
    createdAtLabel: string;
    isArchived: boolean;
    mergedPayload: Record<string, string>;
    detectedKeys: string[];
    hasPdf: boolean;
    hasDocx: boolean;
    generationError: string | null;
    templateName: string;
    templateVersion: number;
    employeeLabel: string | null;
    payrollLabel: string | null;
  };
}

export function DocumentDetailClient({ artifact }: DocumentDetailClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const missingOrEmpty = useMemo(() => {
    const missing: string[] = [];
    for (const key of artifact.detectedKeys) {
      const v = artifact.mergedPayload[key];
      if (v === undefined || v === null || String(v).trim() === "") {
        missing.push(key);
      }
    }
    return missing;
  }, [artifact.detectedKeys, artifact.mergedPayload]);

  async function download(kind: "pdf" | "docx") {
    startTransition(async () => {
      const log = await logDocumentDownloadAction({ artifactId: artifact.id });
      if (!log.ok) {
        toast.error(log.error);
        return;
      }
      window.open(`/api/dokumentet/artifacts/${artifact.id}/${kind}?inline=0`, "_blank", "noopener,noreferrer");
    });
  }

  function preview(kind: "pdf" | "docx") {
    window.open(`/api/dokumentet/artifacts/${artifact.id}/${kind}?inline=1`, "_blank", "noopener,noreferrer");
  }

  function toggleArchive(archived: boolean) {
    startTransition(async () => {
      const res = await archiveArtifactAction({ artifactId: artifact.id, archived });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(archived ? "Dokumenti u arkivua." : "Dokumenti u riaktivizua nga arkivi.");
        router.refresh();
      }
    });
  }

  function regenerate() {
    startTransition(async () => {
      const res = await regenerateDocumentAction({ priorArtifactId: artifact.id });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("U krijua dokument i ri.");
        router.push(`/dokumentet/${res.data!.artifactId}`);
        router.refresh();
      }
    });
  }

  return (
    <>
      <AppSubBar
        dense
        backHref="/dokumentet"
        backLabel="Dokumentet"
        title={artifact.title}
        description={artifact.displayFilename}
        status={
          <>
            <SubBarStatus tone="neutral">
              {DOCUMENT_CATEGORY_LABELS[artifact.documentCategory]}
            </SubBarStatus>
            <SubBarStatus tone={artifact.kind === "PREVIEW" ? "warning" : "success"}>
              {artifact.kind === "PREVIEW" ? "Parapamje" : "Final"}
            </SubBarStatus>
            {artifact.isArchived ? <SubBarStatus tone="locked">Arkiv</SubBarStatus> : null}
          </>
        }
        actions={
          <>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              {/* PDF is served lazily from the stored DOCX when not yet converted. */}
              {artifact.hasPdf || artifact.hasDocx ? (
                <>
                  <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => preview("pdf")}>
                    Parapamje PDF
                  </Button>
                  <Button type="button" size="sm" disabled={pending} onClick={() => void download("pdf")}>
                    Shkarko PDF
                  </Button>
                </>
              ) : (
                <p className="max-w-xs text-xs text-amber-800">
                  PDF nuk është disponueshëm
                  {artifact.generationError ? ` (${artifact.generationError})` : "."}
                </p>
              )}
              {artifact.hasDocx ? (
                <>
                  <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => preview("docx")}>
                    Parapamje DOCX
                  </Button>
                  <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => void download("docx")}>
                    Shkarko DOCX
                  </Button>
                </>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending || artifact.isArchived}
                onClick={() => regenerate()}
              >
                Riprovo gjenerimin
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => toggleArchive(!artifact.isArchived)}
              >
                {artifact.isArchived ? "Hiq nga arkivi" : "Arkivo"}
              </Button>
            </div>
          </>
        }
      />
      <div className="space-y-5 pb-24 md:pb-8">
        <div className={cn(docCard, "flex flex-wrap gap-x-8 gap-y-3 px-4 py-3.5")}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#94a3b8]">Shablloni</p>
            <p className="mt-0.5 text-[13px] font-semibold text-[#0f172a]">
              {artifact.templateName}{" "}
              <span className="font-medium text-[#64748b]">v{artifact.templateVersion}</span>
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#94a3b8]">Gjeneruar</p>
            <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-[#0f172a]">
              {artifact.createdAtLabel}
            </p>
          </div>
          {artifact.employeeLabel ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#94a3b8]">Punonjësi</p>
              <p className="mt-0.5 text-[13px] font-semibold text-[#0f172a]">{artifact.employeeLabel}</p>
            </div>
          ) : null}
          {artifact.payrollLabel ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#94a3b8]">Pasqyra</p>
              <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-[#0f172a]">
                {artifact.payrollLabel}
              </p>
            </div>
          ) : null}
        </div>

      {missingOrEmpty.length > 0 ? (
        <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#d97706]" aria-hidden />
            <div>
              <p className="text-[13.5px] font-bold text-[#b45309]">
                Placeholderë që mungojnë ose janë bosh
              </p>
              <p className="mt-0.5 text-[12.5px] text-[#92702a]">
                Këto çelësa u zbuluan në shabllon por vlera është bosh në snapshot-in e gjeneruar.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {missingOrEmpty.map((k) => (
                  <span
                    key={k}
                    className="rounded-md border border-[#fde68a] bg-white px-1.5 py-0.5 font-mono text-[11px] text-[#b45309]"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className={docCard}>
        <div className="border-b border-[#eef2f7] px-4 py-3">
          <h2 className="text-[13.5px] font-bold text-[#0f172a]">Snapshot i placeholderëve</h2>
          <p className="mt-0.5 text-[12px] text-[#94a3b8]">Të dhënat e përça për dokumentin (readonly).</p>
        </div>
        <div className="p-4">
          <dl className="grid gap-x-8 gap-y-2.5 md:grid-cols-2">
            {Object.entries(artifact.mergedPayload).map(([k, v]) => (
              <div key={k} className="border-b border-[#f1f5f9] pb-2.5">
                <dt className="font-mono text-[11px] text-[#94a3b8]">{k}</dt>
                <dd className="m-0 mt-0.5 break-words text-[13px] font-medium text-[#111827]">
                  {v || "—"}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] flex gap-2 border-t border-border bg-brand-canvas/95 py-3 backdrop-blur md:hidden">
        {artifact.hasPdf || artifact.hasDocx ? (
          <Button className="flex-1" size="sm" disabled={pending} onClick={() => void download("pdf")}>
            Shkarko PDF
          </Button>
        ) : null}
        {artifact.hasDocx ? (
          <Button className="flex-1" size="sm" variant="secondary" disabled={pending} onClick={() => void download("docx")}>
            Shkarko DOCX
          </Button>
        ) : null}
      </div>
      </div>
    </>
  );
}
