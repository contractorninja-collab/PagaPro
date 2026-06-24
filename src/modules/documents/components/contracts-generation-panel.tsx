"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { DocumentTemplateSubtype } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { generateContractDocumentsAction } from "@/modules/documents/actions/documents-actions";
import type { SubjectOption } from "@/modules/documents/components/documents-dashboard-client";

export interface ContractTemplatePick {
  id: string;
  name: string;
  publishedVersionId: string | null;
}

function addYears(isoDate: string, years: number): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export function ContractsGenerationPanel({
  employees,
  caktuarTemplate,
  pacaktuarTemplate,
}: {
  employees: SubjectOption[];
  caktuarTemplate: ContractTemplatePick | null;
  pacaktuarTemplate: ContractTemplatePick | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [subtype, setSubtype] = useState<DocumentTemplateSubtype | "">("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contractStartDate, setContractStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [contractEndDate, setContractEndDate] = useState(() =>
    addYears(new Date().toISOString().slice(0, 10), 1),
  );
  const [documentDate, setDocumentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lastArtifactIds, setLastArtifactIds] = useState<string[]>([]);

  const isCaktuar = subtype === "AFAT_I_CAKTUAR";
  const allSelected = employees.length > 0 && selectedIds.size === employees.length;
  const activeTemplate = isCaktuar ? caktuarTemplate : subtype === "AFAT_I_PACAKTUAR" ? pacaktuarTemplate : null;

  const missingTemplate = Boolean(subtype && !activeTemplate?.publishedVersionId);

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(employees.map((e) => e.id)));
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setEndFromStartYears(years: number) {
    setContractEndDate(addYears(contractStartDate, years));
  }

  function runGenerate() {
    if (!subtype) {
      toast.error("Zgjidhni llojin e kontratës.");
      return;
    }
    if (!activeTemplate?.publishedVersionId) {
      toast.error("Shablloni nuk është i disponueshëm — ekzekutoni seed ose publikoni versionin te Shabllonet.");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("Zgjidhni të paktën një punonjës.");
      return;
    }
    if (isCaktuar && !contractEndDate) {
      toast.error("Zgjidhni datën e mbarimit të kontratës.");
      return;
    }

    startTransition(async () => {
      const res = await generateContractDocumentsAction({
        templateSubtype: subtype,
        employeeIds: Array.from(selectedIds),
        contractStartDateIso: contractStartDate,
        contractEndDateIso: isCaktuar ? contractEndDate : null,
        documentDateIso: documentDate,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const { generated, failed, artifactIds, artifactId } = res.data!;
      setLastArtifactIds(artifactIds);

      if (failed.length === 0) {
        toast.success(`U gjeneruan ${generated} kontrata PDF.`);
      } else {
        toast.warning(
          `U gjeneruan ${generated}; ${failed.length} dështuan: ${failed
            .map((f) => f.employeeLabel)
            .slice(0, 5)
            .join(", ")}${failed.length > 5 ? "…" : ""}`,
        );
      }

      router.refresh();

      if (artifactId) {
        router.push(`/dokumentet/${artifactId}`);
      }
    });
  }

  function downloadZip() {
    if (lastArtifactIds.length === 0) {
      toast.error("Gjeneroni kontratat fillimisht.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/dokumentet/contracts/bulk-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifactIds: lastArtifactIds }),
      });
      if (!res.ok) {
        toast.error("Shkarkimi i ZIP dështoi.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kontratat.zip";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const subtypeCards = useMemo(
    () =>
      [
        {
          id: "AFAT_I_CAKTUAR" as const,
          title: "Kontrate me Afat te Caktuar",
          description: "Datë fillimi dhe mbarimi (p.sh. 1 vit ose më shumë).",
          template: caktuarTemplate,
        },
        {
          id: "AFAT_I_PACAKTUAR" as const,
          title: "Kontrate me Afat te Pacaktuar",
          description: "Vetëm datë fillimi — pa datë mbarimi.",
          template: pacaktuarTemplate,
        },
      ] as const,
    [caktuarTemplate, pacaktuarTemplate],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kontratat</CardTitle>
        <CardDescription>
          Zgjidhni llojin e kontratës, punonjësit dhe datat — gjenerohet një PDF i plotësuar për secilin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {subtypeCards.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubtype(item.id)}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                subtype === item.id
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border hover:bg-muted/50",
                !item.template?.publishedVersionId && "opacity-60",
              )}
            >
              <p className="font-medium text-foreground">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
              {!item.template?.publishedVersionId ? (
                <p className="mt-2 text-xs text-amber-800">Shablloni nuk është i publikuar.</p>
              ) : null}
            </button>
          ))}
        </div>

        {subtype ? (
          <>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Punonjësit ({selectedIds.size}/{employees.length})</Label>
                <Button type="button" variant="ghost" size="sm" onClick={toggleAll} disabled={employees.length === 0}>
                  {allSelected ? "Hiq të gjithë" : "Zgjidh të gjithë"}
                </Button>
              </div>
              {employees.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nuk ka punonjës aktivë.</p>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {employees.map((e) => (
                    <label
                      key={e.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input"
                        checked={selectedIds.has(e.id)}
                        onChange={() => toggleOne(e.id)}
                      />
                      <span>{e.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="contract-start">Data e fillimit të kontratës</Label>
                <Input
                  id="contract-start"
                  type="date"
                  value={contractStartDate}
                  onChange={(e) => setContractStartDate(e.target.value)}
                />
              </div>
              {isCaktuar ? (
                <div className="grid gap-2">
                  <Label htmlFor="contract-end">Data e mbarimit të kontratës</Label>
                  <Input
                    id="contract-end"
                    type="date"
                    value={contractEndDate}
                    onChange={(e) => setContractEndDate(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-1">
                    <Button type="button" variant="secondary" size="sm" onClick={() => setEndFromStartYears(1)}>
                      +1 vit
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setEndFromStartYears(2)}>
                      +2 vite
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setEndFromStartYears(3)}>
                      +3 vite
                    </Button>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="doc-date">Data e nënshkrimit</Label>
                <Input
                  id="doc-date"
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                />
              </div>
            </div>

            {missingTemplate ? (
              <p className="text-sm text-amber-800">
                Shablloni për këtë lloj kontrate nuk është i publikuar. Ngarkoni/publikoni te Shabllonet ose ekzekutoni{" "}
                <code className="rounded bg-muted px-1 text-xs">npm run db:seed</code>.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending || missingTemplate} onClick={runGenerate}>
                {pending
                  ? "Duke gjeneruar…"
                  : selectedIds.size > 1
                    ? `Gjenero PDF (${selectedIds.size})`
                    : "Gjenero PDF"}
              </Button>
              {lastArtifactIds.length > 1 ? (
                <Button type="button" variant="secondary" disabled={pending} onClick={downloadZip}>
                  Shkarko ZIP ({lastArtifactIds.length})
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
