"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { DocumentCategory } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  generateHrDocumentsBatchAction,
  previewPlaceholderValuesAction,
} from "@/modules/documents/actions/documents-actions";
import { DOCUMENT_CATEGORY_LABELS } from "@/modules/documents/components/document-labels";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const workflowCategories: DocumentCategory[] = ["CONTRACT", "LEAVE", "TERMINATION", "WARNING", "OTHER"];

export interface GenerateTemplateOption {
  templateId: string;
  templateName: string;
  documentCategory: DocumentCategory;
  templateSubtype: string | null;
  versionId: string;
  versionNumber: number;
  isMapped: boolean;
}

export interface GenerateSubjectOption {
  id: string;
  label: string;
}

export function DocumentGenerateWizardClient(props: {
  templates: GenerateTemplateOption[];
  employees: GenerateSubjectOption[];
  leaves: GenerateSubjectOption[];
  terminations: GenerateSubjectOption[];
  warnings: GenerateSubjectOption[];
  initialEmployeeId?: string;
  initialCategory?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState<DocumentCategory | "">(
    workflowCategories.includes(props.initialCategory as DocumentCategory)
      ? (props.initialCategory as DocumentCategory)
      : "",
  );
  const [templateId, setTemplateId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    props.initialEmployeeId ? new Set([props.initialEmployeeId]) : new Set(),
  );
  const [documentDate, setDocumentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [contractStart, setContractStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [contractEnd, setContractEnd] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [previewRows, setPreviewRows] = useState<Array<{ subject: string; errors: string[] }>>([]);
  const [artifactIds, setArtifactIds] = useState<string[]>([]);
  const [failures, setFailures] = useState<Array<{ subjectLabel: string; error: string }>>([]);

  const categoryTemplates = useMemo(
    () => props.templates.filter((t) => t.documentCategory === category && t.isMapped),
    [props.templates, category],
  );

  const selectedTemplate = categoryTemplates.find((t) => t.templateId === templateId);

  const subjectOptions = useMemo(() => {
    if (category === "CONTRACT") return props.employees;
    if (category === "LEAVE") return props.leaves;
    if (category === "TERMINATION") return props.terminations;
    if (category === "WARNING") return props.warnings;
    if (category === "OTHER") return props.employees;
    return [];
  }, [category, props]);

  const selectedSubjects = subjectOptions.filter((s) => selectedIds.has(s.id));
  const isEmployeeDriven = category === "CONTRACT" || category === "OTHER";

  function resetForCategory(nextCategory: DocumentCategory | "") {
    setCategory(nextCategory);
    setTemplateId("");
    setSelectedIds(new Set());
    setPreviewRows([]);
    setArtifactIds([]);
    setFailures([]);
  }

  function toggleSubject(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllSubjects() {
    setSelectedIds((prev) => {
      if (prev.size === subjectOptions.length) return new Set();
      return new Set(subjectOptions.map((s) => s.id));
    });
  }

  function buildPayload() {
    if (!selectedTemplate || !category) {
      return { ok: false as const, error: "Zgjidhni llojin dhe shabllonin." };
    }
    if (selectedIds.size === 0) {
      return { ok: false as const, error: "Zgjidhni të paktën një punonjës ose subjekt." };
    }
    return {
      ok: true as const,
      payload: {
        documentTemplateId: selectedTemplate.templateId,
        templateVersionId: selectedTemplate.versionId,
        subjectKind: category,
        subjectIds: Array.from(selectedIds),
        documentDateIso: documentDate,
        contractStartDateIso: category === "CONTRACT" ? contractStart : undefined,
        contractEndDateIso:
          category === "CONTRACT" && selectedTemplate.templateSubtype === "AFAT_I_CAKTUAR"
            ? contractEnd
            : category === "CONTRACT"
              ? null
              : undefined,
      },
    };
  }

  function loadPreview() {
    const built = buildPayload();
    if (!built.ok) {
      toast.error(built.error);
      return;
    }
    startTransition(async () => {
      const rows: Array<{ subject: string; errors: string[] }> = [];
      for (const subject of selectedSubjects) {
        const res = await previewPlaceholderValuesAction({
          templateVersionId: selectedTemplate!.versionId,
          subjectKind: category as DocumentCategory,
          subjectId: subject.id,
          employeeId: isEmployeeDriven ? subject.id : undefined,
          documentDateIso: documentDate,
          contractStartDateIso: category === "CONTRACT" ? contractStart : undefined,
          contractEndDateIso:
            category === "CONTRACT" && selectedTemplate!.templateSubtype === "AFAT_I_CAKTUAR"
              ? contractEnd
              : category === "CONTRACT"
                ? null
                : undefined,
        });
        if (!res.ok) {
          rows.push({ subject: subject.label, errors: [res.error] });
        } else if (!res.data) {
          rows.push({ subject: subject.label, errors: ["Preview dështoi."] });
        } else {
          rows.push({ subject: subject.label, errors: res.data.errors.map((e) => e.message) });
        }
      }
      setPreviewRows(rows);
      toast.success("Kontrolli i të dhënave u përfundua.");
    });
  }

  function generate() {
    const built = buildPayload();
    if (!built.ok) {
      toast.error(built.error);
      return;
    }
    startTransition(async () => {
      const res = await generateHrDocumentsBatchAction(built.payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const data = res.data!;
      setArtifactIds(data.artifactIds);
      setFailures(data.failed);
      toast.success(`U gjeneruan ${data.generated} dokument(e).`);
      if (data.artifactId) router.push(`/dokumentet/${data.artifactId}`);
      router.refresh();
    });
  }

  async function downloadZip() {
    if (artifactIds.length === 0) return;
    const res = await fetch("/api/dokumentet/contracts/bulk-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artifactIds }),
    });
    if (!res.ok) {
      toast.error("ZIP nuk u krijua.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dokumentet.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gjenero dokumente HR</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Një workflow për kontrata, pushime, largime dhe vërejtje, me zgjedhje një nga një ose në grup.
          </p>
        </div>
        <Button variant="secondary" asChild>
          <Link href="/dokumentet">Kthehu</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Lloji i dokumentit</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className={selectClass}
            value={category}
            onChange={(e) => {
              resetForCategory(e.target.value as DocumentCategory | "");
            }}
          >
            <option value="">Zgjidhni…</option>
            {workflowCategories.map((c) => (
              <option key={c} value={c}>
                {DOCUMENT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {category ? (
        <Card>
          <CardHeader>
            <CardTitle>2. Shablloni</CardTitle>
            <CardDescription>Vetëm versione të publikuara dhe të mapuara.</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nuk ka shabllone të gatshëm — ngarkoni dhe maponi te{" "}
                <Link href="/dokumentet/templates" className="underline">
                  Shabllonet
                </Link>
                .
              </p>
            ) : (
              <select className={selectClass} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">Zgjidhni shabllonin</option>
                {categoryTemplates.map((t) => (
                  <option key={t.templateId} value={t.templateId}>
                    {t.templateName} (v{t.versionNumber})
                  </option>
                ))}
              </select>
            )}
          </CardContent>
        </Card>
      ) : null}

      {selectedTemplate ? (
        <Card>
          <CardHeader>
            <CardTitle>3. Zgjedhja {isEmployeeDriven ? "e punonjësve" : "e rasteve"}</CardTitle>
            <CardDescription>Zgjidhni një ose më shumë rreshta për gjenerim masiv.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button type="button" variant="secondary" size="sm" onClick={toggleAllSubjects}>
              {selectedIds.size === subjectOptions.length ? "Hiq të gjitha" : "Zgjidh të gjitha"}
            </Button>
            {subjectOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nuk ka rreshta të disponueshëm për këtë lloj dokumenti.</p>
            ) : null}
            <div className="grid max-h-72 gap-2 overflow-auto rounded-md border border-border p-2">
              {subjectOptions.map((s) => (
                <label key={s.id} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/60">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleSubject(s.id)}
                  />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{selectedIds.size} të zgjedhur.</p>
          </CardContent>
        </Card>
      ) : null}

      {selectedTemplate ? (
        <Card>
          <CardHeader>
            <CardTitle>4. Datat</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Data e dokumentit</Label>
              <Input type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} />
            </div>
            {category === "CONTRACT" ? (
              <>
                <div className="grid gap-2">
                  <Label>Fillimi i kontratës</Label>
                  <Input type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} />
                </div>
                {selectedTemplate.templateSubtype === "AFAT_I_CAKTUAR" ? (
                  <div className="grid gap-2">
                    <Label>Mbarimi i kontratës</Label>
                    <Input type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} />
                  </div>
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {selectedTemplate ? (
        <Card>
          <CardHeader>
            <CardTitle>5. Parapamje e vlerave</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button type="button" variant="secondary" disabled={pending} onClick={loadPreview}>
              Ngarko parapamjen
            </Button>
            {previewRows.length > 0 ? (
              <div className="max-h-64 space-y-2 overflow-auto rounded border p-2 text-sm">
                {previewRows.map((r) => (
                  <div key={r.subject} className="rounded-md bg-muted/40 p-3">
                    <p className="font-medium">{r.subject}</p>
                    {r.errors.length === 0 ? (
                      <p className="mt-1 text-xs text-emerald-700">Gati për gjenerim.</p>
                    ) : (
                      <ul className="mt-1 list-disc pl-5 text-xs text-destructive">
                        {r.errors.map((e) => <li key={e}>{e}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {selectedTemplate ? (
        <Button type="button" disabled={pending} onClick={generate}>
          {pending ? "Duke gjeneruar…" : `Gjenero PDF (${selectedIds.size || 0})`}
        </Button>
      ) : null}
      {artifactIds.length > 0 || failures.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Rezultati i gjenerimit</CardTitle>
            <CardDescription>{artifactIds.length} dokument(e) të krijuara, {failures.length} dështime.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {artifactIds.length > 1 ? (
                <Button type="button" variant="secondary" onClick={downloadZip}>
                  Shkarko ZIP
                </Button>
              ) : null}
              {artifactIds.map((id) => (
                <Button key={id} type="button" variant="secondary" size="sm" asChild>
                  <Link href={`/dokumentet/${id}`}>Hap dokumentin</Link>
                </Button>
              ))}
            </div>
            {failures.length > 0 ? (
              <ul className="list-disc pl-5 text-sm text-destructive">
                {failures.map((f) => <li key={`${f.subjectLabel}-${f.error}`}>{f.subjectLabel}: {f.error}</li>)}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
