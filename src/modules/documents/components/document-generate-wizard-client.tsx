"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { DocumentCategory } from "@prisma/client";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Printer,
  Search,
} from "lucide-react";
import { AppSubBar } from "@/components/layout/app-sub-bar";
import { cn } from "@/lib/utils";
import {
  generateHrDocumentsBatchAction,
  previewPlaceholderValuesAction,
} from "@/modules/documents/actions/documents-actions";
import { DOCUMENT_CATEGORY_LABELS } from "@/modules/documents/components/document-labels";
import {
  DocChip,
  docBtnPrimary,
  docBtnSecondary,
  docBtnSecondaryDense,
  docCard,
  docInput,
  docSelect,
} from "@/modules/documents/components/doc-ui";
import { openBulkPrintPreview } from "@/modules/documents/components/open-bulk-print-preview";

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

interface PreviewRow {
  subjectId: string;
  subject: string;
  errors: string[];
  values: Record<string, string>;
}

function StepCircle({ state, index }: { state: "done" | "active" | "idle"; index: number }) {
  if (state === "done") {
    return (
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-brand-blue text-white">
        <Check className="h-3.5 w-3.5" aria-hidden />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
        state === "active"
          ? "border-2 border-brand-blue bg-[#eff6ff] text-brand-blue"
          : "bg-[#f1f5f9] text-[#94a3b8]",
      )}
    >
      {index + 1}
    </span>
  );
}

function SectionCard({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={docCard}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef2f7] px-4 py-3">
        <h2 className="text-[13.5px] font-bold text-[#0f172a]">{title}</h2>
        {aside}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
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
  const [subjectSearch, setSubjectSearch] = useState("");
  const [documentDate, setDocumentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [contractStart, setContractStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [contractEnd, setContractEnd] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewFocusId, setPreviewFocusId] = useState("");
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

  const filteredSubjects = useMemo(() => {
    const q = subjectSearch.trim().toLowerCase();
    if (!q) return subjectOptions;
    return subjectOptions.filter((s) => s.label.toLowerCase().includes(q));
  }, [subjectOptions, subjectSearch]);

  const selectedSubjects = subjectOptions.filter((s) => selectedIds.has(s.id));
  const isEmployeeDriven = category === "CONTRACT" || category === "OTHER";

  function resetForCategory(nextCategory: DocumentCategory | "") {
    setCategory(nextCategory);
    setTemplateId("");
    setSelectedIds(new Set());
    setSubjectSearch("");
    setPreviewRows([]);
    setPreviewFocusId("");
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
          category === "CONTRACT" && ["AFAT_I_CAKTUAR", "PRAKTIKANT"].includes(selectedTemplate.templateSubtype ?? "")
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
      const rows: PreviewRow[] = [];
      for (const subject of selectedSubjects) {
        const res = await previewPlaceholderValuesAction({
          templateVersionId: selectedTemplate!.versionId,
          subjectKind: category as DocumentCategory,
          subjectId: subject.id,
          employeeId: isEmployeeDriven ? subject.id : undefined,
          documentDateIso: documentDate,
          contractStartDateIso: category === "CONTRACT" ? contractStart : undefined,
          contractEndDateIso:
            category === "CONTRACT" && ["AFAT_I_CAKTUAR", "PRAKTIKANT"].includes(selectedTemplate!.templateSubtype ?? "")
              ? contractEnd
              : category === "CONTRACT"
                ? null
                : undefined,
        });
        if (!res.ok) {
          rows.push({ subjectId: subject.id, subject: subject.label, errors: [res.error], values: {} });
        } else if (!res.data) {
          rows.push({ subjectId: subject.id, subject: subject.label, errors: ["Preview dështoi."], values: {} });
        } else {
          rows.push({
            subjectId: subject.id,
            subject: subject.label,
            errors: res.data.errors.map((e) => e.message),
            values: res.data.values,
          });
        }
      }
      setPreviewRows(rows);
      setPreviewFocusId((prev) =>
        rows.some((r) => r.subjectId === prev) ? prev : (rows[0]?.subjectId ?? ""),
      );
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

  async function previewBulkPrint() {
    const result = await openBulkPrintPreview(artifactIds);
    if (!result.ok) toast.error(result.error);
  }

  // Step-rail states (presentation only).
  const steps = [
    { label: "Lloji", done: Boolean(category) },
    { label: "Shablloni", done: Boolean(selectedTemplate) },
    { label: "Marrësit & datat", done: selectedIds.size > 0 },
    { label: "Kontrollo & gjenero", done: artifactIds.length > 0 },
  ];
  const firstOpen = steps.findIndex((s) => !s.done);
  const activeStep = firstOpen === -1 ? steps.length - 1 : firstOpen;

  const readyCount = previewRows.filter((r) => r.errors.length === 0).length;
  const blockedCount = previewRows.length - readyCount;
  const focusedPreview =
    previewRows.find((r) => r.subjectId === previewFocusId) ?? previewRows[0] ?? null;

  return (
    <>
      <AppSubBar
        dense
        backHref="/dokumentet"
        backLabel="Dokumentet"
        title="Gjenero dokumente HR"
        description="Një workflow për kontrata, pushime, largime dhe vërejtje, me zgjedhje një nga një ose në grup."
      />

      <div className="grid items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)_330px]">
        {/* Left — step rail */}
        <aside className={cn(docCard, "p-2 lg:sticky lg:top-6")}>
          <ol className="m-0 list-none space-y-0.5 p-0">
            {steps.map((step, i) => {
              const state: "done" | "active" | "idle" = step.done
                ? "done"
                : i === activeStep
                  ? "active"
                  : "idle";
              return (
                <li
                  key={step.label}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5",
                    state === "active" && "bg-[#f8fafc]",
                  )}
                >
                  <StepCircle state={state} index={i} />
                  <span
                    className={cn(
                      "text-[13px]",
                      state === "active"
                        ? "font-semibold text-[#0f172a]"
                        : state === "done"
                          ? "font-medium text-[#334155]"
                          : "font-medium text-[#94a3b8]",
                    )}
                  >
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* Center — work area */}
        <div className="min-w-0 space-y-5">
          <SectionCard title="1. Lloji i dokumentit">
            <div className="flex flex-wrap gap-2">
              {workflowCategories.map((c) => {
                const active = category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      if (c !== category) resetForCategory(c);
                    }}
                    className={cn(
                      "inline-flex h-[34px] items-center rounded-[9px] px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-brand-blue text-white"
                        : "border border-[#e2e8f0] bg-white text-[#334155] hover:bg-[#eef2f7]",
                    )}
                  >
                    {DOCUMENT_CATEGORY_LABELS[c]}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {category ? (
            <SectionCard
              title="2. Shablloni"
              aside={
                <span className="text-[12px] text-[#94a3b8]">
                  Vetëm versione të publikuara dhe të mapuara.
                </span>
              }
            >
              {categoryTemplates.length === 0 ? (
                <p className="text-[13px] text-[#64748b]">
                  Nuk ka shabllone të gatshëm — ngarkoni dhe maponi te{" "}
                  <Link href="/dokumentet/templates" className="font-semibold text-brand-blue hover:underline">
                    Shabllonet
                  </Link>
                  .
                </p>
              ) : (
                <div className="space-y-3">
                  <select
                    className={cn(docSelect, "w-full")}
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                  >
                    <option value="">Zgjidhni shabllonin</option>
                    {categoryTemplates.map((t) => (
                      <option key={t.templateId} value={t.templateId}>
                        {t.templateName} (v{t.versionNumber})
                      </option>
                    ))}
                  </select>
                  {selectedTemplate ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[#dbeafe] bg-[#eff6ff] px-3 py-2.5">
                      <FileText className="h-4 w-4 text-brand-blue" aria-hidden />
                      <span className="text-[13px] font-semibold text-[#0f172a]">
                        {selectedTemplate.templateName}
                      </span>
                      <span className="text-[12px] font-medium text-[#64748b]">
                        v{selectedTemplate.versionNumber}
                        {selectedTemplate.templateSubtype ? ` · ${selectedTemplate.templateSubtype}` : ""}
                      </span>
                      <DocChip tone="success" className="ml-auto">
                        I mapuar
                      </DocChip>
                    </div>
                  ) : null}
                </div>
              )}
            </SectionCard>
          ) : null}

          {selectedTemplate ? (
            <SectionCard
              title={`3. Marrësit & datat ${isEmployeeDriven ? "(punonjësit)" : "(rastet)"}`}
              aside={
                <span className="text-[12px] font-semibold text-brand-blue">
                  {selectedIds.size} të zgjedhur
                </span>
              }
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[180px] flex-1">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]"
                      aria-hidden
                    />
                    <input
                      value={subjectSearch}
                      onChange={(e) => setSubjectSearch(e.target.value)}
                      placeholder={isEmployeeDriven ? "Kërko punonjës…" : "Kërko rast…"}
                      className={cn(docInput, "pl-8")}
                    />
                  </div>
                  <button type="button" className={docBtnSecondaryDense} onClick={toggleAllSubjects}>
                    {selectedIds.size === subjectOptions.length ? "Hiq të gjitha" : "Zgjidh të gjitha"}
                  </button>
                </div>

                {subjectOptions.length === 0 ? (
                  <p className="text-[13px] text-[#64748b]">
                    Nuk ka rreshta të disponueshëm për këtë lloj dokumenti.
                  </p>
                ) : (
                  <div className="max-h-72 overflow-auto rounded-[10px] border border-[#eef2f7]">
                    {filteredSubjects.length === 0 ? (
                      <p className="px-3 py-4 text-[13px] text-[#94a3b8]">Asnjë përputhje për kërkimin.</p>
                    ) : (
                      <ul className="m-0 list-none divide-y divide-[#f1f5f9] p-0">
                        {filteredSubjects.map((s) => {
                          const checked = selectedIds.has(s.id);
                          return (
                            <li key={s.id}>
                              <label
                                className={cn(
                                  "flex cursor-pointer items-center gap-3 px-3 py-2.5 text-[13px] transition-colors",
                                  checked ? "bg-[#eff6ff]/60" : "hover:bg-[#f8fafc]",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-[#2563EB]"
                                  checked={checked}
                                  onChange={() => toggleSubject(s.id)}
                                />
                                <span
                                  className={cn(
                                    checked ? "font-semibold text-[#0f172a]" : "font-medium text-[#334155]",
                                  )}
                                >
                                  {s.label}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}

                <div className="grid gap-3 border-t border-[#eef2f7] pt-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <label className="text-[12px] font-semibold text-[#64748b]">Data e dokumentit</label>
                    <input
                      type="date"
                      className={cn(docInput, "tabular-nums")}
                      value={documentDate}
                      onChange={(e) => setDocumentDate(e.target.value)}
                    />
                  </div>
                  {category === "CONTRACT" ? (
                    <>
                      <div className="grid gap-1.5">
                        <label className="text-[12px] font-semibold text-[#64748b]">Fillimi i kontratës</label>
                        <input
                          type="date"
                          className={cn(docInput, "tabular-nums")}
                          value={contractStart}
                          onChange={(e) => setContractStart(e.target.value)}
                        />
                      </div>
                      {["AFAT_I_CAKTUAR", "PRAKTIKANT"].includes(selectedTemplate.templateSubtype ?? "") ? (
                        <div className="grid gap-1.5">
                          <label className="text-[12px] font-semibold text-[#64748b]">Mbarimi i kontratës</label>
                          <input
                            type="date"
                            className={cn(docInput, "tabular-nums")}
                            value={contractEnd}
                            onChange={(e) => setContractEnd(e.target.value)}
                          />
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            </SectionCard>
          ) : null}

          {artifactIds.length > 0 || failures.length > 0 ? (
            <SectionCard
              title="Rezultati i gjenerimit"
              aside={
                <span className="text-[12px] text-[#94a3b8]">
                  {artifactIds.length} dokument(e) të krijuara · {failures.length} dështime
                </span>
              }
            >
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {artifactIds.length > 1 ? (
                    <>
                      <button
                        type="button"
                        className={docBtnSecondaryDense}
                        onClick={() => void previewBulkPrint()}
                      >
                        <Printer className="h-3.5 w-3.5" aria-hidden />
                        Parapamje për printim
                      </button>
                      <button type="button" className={docBtnSecondaryDense} onClick={downloadZip}>
                        <Download className="h-3.5 w-3.5" aria-hidden />
                        Shkarko ZIP
                      </button>
                    </>
                  ) : null}
                  {artifactIds.map((id) => (
                    <Link key={id} href={`/dokumentet/${id}`} className={docBtnSecondaryDense}>
                      Hap dokumentin
                    </Link>
                  ))}
                </div>
                {failures.length > 0 ? (
                  <ul className="m-0 list-disc space-y-1 pl-5 text-[13px] text-[#dc2626]">
                    {failures.map((f) => (
                      <li key={`${f.subjectLabel}-${f.error}`}>
                        {f.subjectLabel}: {f.error}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </SectionCard>
          ) : null}
        </div>

        {/* Right — live preview + readiness */}
        <div className="min-w-0 space-y-5">
          <section className={docCard}>
            <div className="flex items-center justify-between gap-2 border-b border-[#eef2f7] px-4 py-3">
              <h2 className="text-[13.5px] font-bold text-[#0f172a]">Parapamja e vlerave</h2>
              {focusedPreview ? (
                <DocChip tone={focusedPreview.errors.length === 0 ? "success" : "warning"}>
                  {focusedPreview.errors.length === 0 ? "Gati" : "Me mungesa"}
                </DocChip>
              ) : null}
            </div>
            <div className="p-4">
              {previewRows.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-[10px] border border-dashed border-[#e2e8f0] bg-[#f8fafc] px-4 py-8 text-center">
                  <FileText className="h-6 w-6 text-[#cbd5e1]" aria-hidden />
                  <p className="text-[12.5px] text-[#94a3b8]">
                    Shtypni «Kontrollo» për të parë vlerat e zgjidhura të shabllonit.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {previewRows.length > 1 ? (
                    <select
                      className={cn(docSelect, "w-full")}
                      value={focusedPreview?.subjectId ?? ""}
                      onChange={(e) => setPreviewFocusId(e.target.value)}
                    >
                      {previewRows.map((r) => (
                        <option key={r.subjectId} value={r.subjectId}>
                          {r.subject}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-[13px] font-semibold text-[#0f172a]">{focusedPreview?.subject}</p>
                  )}
                  <div className="max-h-[340px] overflow-auto rounded-[10px] border border-[#eef2f7] bg-white p-3">
                    {focusedPreview && Object.keys(focusedPreview.values).length > 0 ? (
                      <dl className="m-0 space-y-2">
                        {Object.entries(focusedPreview.values).map(([k, v]) => (
                          <div key={k} className="border-b border-[#f1f5f9] pb-2 last:border-0 last:pb-0">
                            <dt className="font-mono text-[10.5px] uppercase tracking-wide text-[#94a3b8]">
                              {k}
                            </dt>
                            <dd
                              className={cn(
                                "m-0 mt-0.5 break-words text-[12.5px] font-semibold",
                                v && v.trim() !== "" ? "text-brand-blue" : "text-[#b45309]",
                              )}
                            >
                              {v && v.trim() !== "" ? v : "— mungon —"}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-[12.5px] text-[#94a3b8]">Nuk u zgjidh asnjë vlerë.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className={docCard}>
            <div className="flex items-center justify-between gap-2 border-b border-[#eef2f7] px-4 py-3">
              <h2 className="text-[13.5px] font-bold text-[#0f172a]">Gatishmëria</h2>
              {previewRows.length > 0 ? (
                <span className="text-[12px] font-semibold text-[#64748b]">
                  {readyCount} gati · {blockedCount} me mungesa
                </span>
              ) : null}
            </div>
            <div className="p-4">
              {previewRows.length === 0 ? (
                <p className="text-[12.5px] text-[#94a3b8]">
                  Kontrolli tregon për çdo marrës nëse të dhënat janë të plota para gjenerimit.
                </p>
              ) : (
                <ul className="m-0 list-none space-y-2.5 p-0">
                  {previewRows.map((r) => (
                    <li key={r.subjectId} className="flex items-start gap-2.5">
                      {r.errors.length === 0 ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16a34a]" aria-hidden />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#d97706]" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[#0f172a]">{r.subject}</p>
                        {r.errors.length === 0 ? (
                          <p className="text-[12px] text-[#15803d]">Gati për gjenerim.</p>
                        ) : (
                          <ul className="m-0 list-none space-y-0.5 p-0">
                            {r.errors.map((e) => (
                              <li key={e} className="text-[12px] text-[#b45309]">
                                {e}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Sticky footer — Kontrollo / Gjenero */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mt-5 md:bottom-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#e2e8f0] bg-white/95 px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.07)] backdrop-blur">
          <p className="text-[13px] font-semibold text-[#0f172a]">
            {selectedIds.size} dokument(e)
            <span className="ml-1.5 font-medium text-[#94a3b8]">
              → {selectedIds.size > 1 ? "ZIP / PDF" : "PDF"}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={docBtnSecondary} disabled={pending} onClick={loadPreview}>
              Kontrollo
            </button>
            <button type="button" className={docBtnPrimary} disabled={pending} onClick={generate}>
              {pending ? "Duke gjeneruar…" : `Gjenero (${selectedIds.size || 0})`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
