"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { toast } from "sonner";
import type { DocumentCategory } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="space-y-8 pb-24 md:pb-8">
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Link
            href="/dokumentet"
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            ← Dokumentet
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{artifact.title}</h1>
          <p className="text-sm text-muted-foreground">{artifact.displayFilename}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 font-medium">
              {DOCUMENT_CATEGORY_LABELS[artifact.documentCategory]}
            </span>
            <span className="rounded-md bg-muted px-2 py-0.5 font-medium uppercase">
              {artifact.kind === "PREVIEW" ? "Parapamje" : "Final"}
            </span>
            {artifact.isArchived ? (
              <span className="rounded-md bg-muted px-2 py-0.5 font-semibold uppercase text-muted-foreground">
                Arkiv
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Shabllon: {artifact.templateName} (v{artifact.templateVersion}) · {artifact.createdAtLabel}
          </p>
          {artifact.employeeLabel ? (
            <p className="text-xs text-muted-foreground">Punonjësi: {artifact.employeeLabel}</p>
          ) : null}
          {artifact.payrollLabel ? (
            <p className="text-xs text-muted-foreground">Pasqyra: {artifact.payrollLabel}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <div className="flex flex-wrap gap-2 justify-end">
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
        </div>
      </div>

      {missingOrEmpty.length > 0 ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-amber-950">Placeholderë që mungojnë ose janë bosh</CardTitle>
            <CardDescription>
              Këto çelësa u zbuluan në shabllon por vlera është bosh në snapshot-in e gjeneruar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc text-sm text-amber-950">
              {missingOrEmpty.map((k) => (
                <li key={k} className="font-mono text-xs">
                  {k}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Snapshot i placeholderëve</CardTitle>
          <CardDescription>Të dhënat e përça për dokumentin (readonly).</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm md:grid-cols-2">
            {Object.entries(artifact.mergedPayload).map(([k, v]) => (
              <div key={k} className="border-b border-border/60 pb-2">
                <dt className="font-mono text-xs text-muted-foreground">{k}</dt>
                <dd className="mt-0.5 break-words">{v || "—"}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

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
  );
}
