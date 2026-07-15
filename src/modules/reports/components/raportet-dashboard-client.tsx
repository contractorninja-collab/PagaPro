"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CatalogRow } from "@/modules/reports/services/report-registry";
import type { GeneratedReportListRow } from "@/modules/reports/services/report-query-service";
import type { ReportOutputFormat, ReportType } from "@prisma/client";
import type { ReportCategory } from "@/modules/reports/types";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  Download,
  Eye,
  FileText,
  Info,
  Plus,
  Search,
  UserMinus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AppSubBar } from "@/components/layout/app-sub-bar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  archiveReportAction,
  generateReportAction,
  previewReportAction,
  regenerateReportAction,
} from "@/modules/reports/actions/report-actions";

type PickerCtx = {
  departments: { id: string; name: string }[];
  payrolls: { id: string; year: number; month: number; status: string }[];
  employees: { id: string; firstName: string; lastName: string }[];
};

function payrollReports(t: ReportType): boolean {
  return (
    t.startsWith("RAPORT_") ||
    t.startsWith("LISTA_PAGAVE") ||
    t === "LISTA_PER_NENSHKRIM_PA_SUMA" ||
    t === "FINANCE_PAYROLL_WORKBOOK" ||
    t === "ATK_EXPORT_WORKBOOK" ||
    t.startsWith("TRUSTI") ||
    t === "EMPLOYER_TOTAL_COST" ||
    t === "SALARY_ADVANCE_DEDUCTIONS"
  );
}

function leaveReports(t: ReportType): boolean {
  return t.startsWith("PUSHIMET") || t.startsWith("BALANCA") || t === "CARRY_OVER_LEAVE";
}

function employeeReports(t: ReportType): boolean {
  return t === "LISTA_PUNONJESVE" || t.startsWith("PUNONJES_") || t === "KONTRAKTORE";
}

function terminationMonthReport(t: ReportType): boolean {
  return t === "LARGIMET_SIPAS_MUAJIT";
}

const CATEGORY_ORDER: ReportCategory[] = ["EMPLOYEE", "PAYROLL", "LEAVE", "DOCUMENT", "TERMINATION"];

const CATEGORY_META: Record<ReportCategory, { icon: LucideIcon; tile: string }> = {
  EMPLOYEE: { icon: Users, tile: "bg-[#eff6ff] text-brand-blue" },
  PAYROLL: { icon: BarChart3, tile: "bg-[#ecfdf5] text-[#15803d]" },
  LEAVE: { icon: CalendarDays, tile: "bg-[#f0fdfa] text-[#0d9488]" },
  DOCUMENT: { icon: FileText, tile: "bg-[#eef2ff] text-[#4338ca]" },
  TERMINATION: { icon: UserMinus, tile: "bg-[#fef2f2] text-[#dc2626]" },
};

const ALL_FORMATS: ReportOutputFormat[] = ["XLSX", "CSV", "PDF"];

/** Tiny format chip — XLSX green tone, CSV slate, PDF red (per handoff 7a). */
function FormatChip({ fmt, className }: { fmt: string; className?: string }) {
  const tone =
    fmt === "XLSX"
      ? "bg-[#ecfdf5] text-[#15803d]"
      : fmt === "PDF"
        ? "bg-[#fef2f2] text-[#dc2626]"
        : "bg-[#f1f5f9] text-[#475569]";
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded px-[5px] py-[2px] text-[9px] font-bold leading-none",
        tone,
        className,
      )}
    >
      {fmt}
    </span>
  );
}

/** Aktiv / Arkivuar register pill. */
function RegisterStatusPill({ archived }: { archived: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit items-center rounded-full px-2 text-[11px] font-semibold",
        archived ? "bg-[#f1f5f9] text-[#94a3b8]" : "bg-[#ecfdf5] text-[#15803d]",
      )}
    >
      {archived ? "Arkivuar" : "Aktiv"}
    </span>
  );
}

const fieldLabelCls = "mb-1.5 block text-[11.5px] font-semibold text-[#64748b]";
const fieldControlCls =
  "h-[38px] w-full rounded-[9px] border border-[#e2e8f0] bg-white px-3 text-[13px] text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-brand-blue/30";

export function RaportetDashboardClient(props: {
  catalog: CatalogRow[];
  generated: GeneratedReportListRow[];
  picker: PickerCtx;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeQuery, setTypeQuery] = useState("");
  const [reportType, setReportType] = useState<ReportType>("LISTA_PUNONJESVE");

  const now = new Date();
  const [payrollId, setPayrollId] = useState(props.picker.payrolls[0]?.id ?? "");
  const [leaveYear, setLeaveYear] = useState(now.getFullYear());
  const [termYear, setTermYear] = useState(now.getFullYear());
  const [termMonth, setTermMonth] = useState(now.getMonth() + 1);
  const [departmentId, setDepartmentId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [documentCategory, setDocumentCategory] = useState("");
  const [includeArchivedDocs, setIncludeArchivedDocs] = useState(false);
  const [daysAhead, setDaysAhead] = useState(60);

  const [previewCols, setPreviewCols] = useState<{ key: string; headerSq: string }[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [previewTruncated, setPreviewTruncated] = useState(false);

  const [format, setFormat] = useState<ReportOutputFormat>("XLSX");

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return props.catalog;
    return props.catalog.filter(
      (c) =>
        c.titleSq.toLowerCase().includes(q) ||
        c.categoryLabel.toLowerCase().includes(q) ||
        c.descriptionSq.toLowerCase().includes(q),
    );
  }, [props.catalog, search]);

  const pickerCatalog = useMemo(() => {
    const q = typeQuery.trim().toLowerCase();
    if (!q) return props.catalog;
    return props.catalog.filter(
      (c) => c.titleSq.toLowerCase().includes(q) || c.categoryLabel.toLowerCase().includes(q),
    );
  }, [props.catalog, typeQuery]);

  const selectedMeta = useMemo(
    () => props.catalog.find((c) => c.type === reportType),
    [props.catalog, reportType],
  );

  const categoryLabelFor = (cat: ReportCategory) =>
    props.catalog.find((c) => c.category === cat)?.categoryLabel ?? cat;

  function buildFiltersJson(): unknown {
    if (payrollReports(reportType)) {
      return { payrollId };
    }
    if (leaveReports(reportType)) {
      return {
        year: leaveYear,
        ...(departmentId ? { departmentId } : {}),
        ...(employeeId ? { employeeId } : {}),
      };
    }
    if (employeeReports(reportType)) {
      return {
        ...(departmentId ? { departmentId } : {}),
        ...(employeeId ? { employeeId } : {}),
        ...(employmentStatus ? { employmentStatus } : {}),
        ...(employmentType ? { employmentType } : {}),
      };
    }
    if (reportType === "KONTRATA_AKTIVE") {
      return {
        ...(departmentId ? { departmentId } : {}),
        ...(employeeId ? { employeeId } : {}),
      };
    }
    if (reportType === "KONTRATA_AFER_SKADIMIT") {
      return {
        daysAhead,
        ...(departmentId ? { departmentId } : {}),
      };
    }
    if (reportType === "DOKUMENTET_E_GJENERUARA") {
      return {
        ...(employeeId ? { employeeId } : {}),
        ...(documentCategory ? { documentCategory } : {}),
        includeArchived: includeArchivedDocs,
      };
    }
    if (reportType === "DOKUMENTET_SIPAS_PUNONJESIT") {
      return {
        employeeId,
        ...(documentCategory ? { documentCategory } : {}),
      };
    }
    if (terminationMonthReport(reportType)) {
      return { year: termYear, month: termMonth };
    }
    return {};
  }

  const hasContextualFilters =
    payrollReports(reportType) ||
    leaveReports(reportType) ||
    employeeReports(reportType) ||
    terminationMonthReport(reportType) ||
    reportType === "KONTRATA_AKTIVE" ||
    reportType === "KONTRATA_AFER_SKADIMIT" ||
    reportType === "DOKUMENTET_E_GJENERUARA" ||
    reportType === "DOKUMENTET_SIPAS_PUNONJESIT";

  function syncFormatDefault(t: ReportType, fmts: ReportOutputFormat[]) {
    setReportType(t);
    if (!fmts.includes(format)) setFormat(fmts[0] ?? "XLSX");
  }

  async function runPreview() {
    startTransition(async () => {
      const res = await previewReportAction({
        reportType,
        filtersJson: buildFiltersJson(),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPreviewCols(res.data!.columns);
      setPreviewRows(res.data!.rows as Record<string, unknown>[]);
      setPreviewTruncated(res.data!.truncated);
      toast.success("Paraafishimi u përditësua.");
    });
  }

  async function runGenerate() {
    startTransition(async () => {
      const res = await generateReportAction({
        reportType,
        filtersJson: buildFiltersJson(),
        format,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Raporti u gjenerua.");
      setSheetOpen(false);
      router.refresh();
      if (res.data?.id) {
        router.push(`/raportet/${res.data.id}`);
      }
    });
  }

  async function rowArchive(id: string) {
    startTransition(async () => {
      const res = await archiveReportAction({ id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Raporti u arkivua.");
      router.refresh();
    });
  }

  async function rowRegenerate(id: string) {
    startTransition(async () => {
      const res = await regenerateReportAction({ previousReportId: id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Raporti i ri u krijua.");
      router.refresh();
      if (res.data?.id) router.push(`/raportet/${res.data.id}`);
    });
  }

  return (
    <>
      <AppSubBar
        eyebrow="Raporte & eksporte"
        title="Raportet"
        description="Qendra e eksporteve operative — punonjës, pagë, pushime, dokumente dhe largime."
        actions={
          <>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#94a3b8]"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Kërko në katalog…"
                aria-label="Kërko në katalog"
                className="h-10 w-[200px] rounded-[10px] border border-[#e2e8f0] bg-white pl-9 pr-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-brand-blue/30 md:w-[240px]"
              />
            </div>
            <Button
              onClick={() => setSheetOpen(true)}
              className="h-10 rounded-[10px] bg-brand-blue px-[18px] text-[13.5px] font-semibold text-white hover:bg-[#1d4ed8]"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Gjenero raport
            </Button>
          </>
        }
      />

      <div className="space-y-6 pb-24 md:pb-10">
        {/* ── Catalog: five category cards + highlight tile (7a) ─────────────── */}
        <section className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CATEGORY_ORDER.map((cat) => {
            const meta = CATEGORY_META[cat];
            const CatIcon = meta.icon;
            const rows = filteredCatalog.filter((c) => c.category === cat);
            const total = props.catalog.filter((c) => c.category === cat).length;
            return (
              <div
                key={cat}
                className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] md:px-[18px]"
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <div
                    className={cn(
                      "flex h-[30px] w-[30px] items-center justify-center rounded-lg",
                      meta.tile,
                    )}
                  >
                    <CatIcon className="h-[15px] w-[15px]" aria-hidden />
                  </div>
                  <h2 className="text-sm font-bold text-[#0f172a]">{categoryLabelFor(cat)}</h2>
                  <span className="ml-auto text-[11px] tabular-nums text-[#94a3b8]">
                    {rows.length === total ? total : `${rows.length}/${total}`}
                  </span>
                </div>
                {rows.length === 0 ? (
                  <p className="px-2 py-3 text-[12.5px] text-[#94a3b8]">
                    Asnjë raport nuk përputhet me kërkimin.
                  </p>
                ) : (
                  <div className="flex flex-col">
                    {rows.map((c) => (
                      <button
                        key={c.type}
                        type="button"
                        onClick={() => {
                          syncFormatDefault(c.type, c.formats);
                          setSheetOpen(true);
                        }}
                        className="flex items-center justify-between gap-2 rounded-[7px] px-2 py-2 text-left transition-colors hover:bg-[#f8fafc]"
                      >
                        <span className="min-w-0 truncate text-[12.5px] text-[#334155]">
                          {c.titleSq}
                        </span>
                        <span className="flex shrink-0 gap-[3px]">
                          {c.formats.map((f) => (
                            <FormatChip key={f} fmt={f} />
                          ))}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* highlight / help tile */}
          <div className="flex flex-col gap-2.5 rounded-xl bg-brand-navy p-5 text-[#e8edf5]">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[.08]">
              <Info className="h-4 w-4 text-[#5b9dff]" aria-hidden />
            </div>
            <p className="text-sm font-bold text-white">
              {props.catalog.length} raporte gati
            </p>
            <p className="text-xs leading-relaxed text-[#8b95a7]">
              Çdo raport paraafishohet para eksportit dhe ruhet në regjistrin më poshtë me gjurmë
              auditimi.
            </p>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="mt-auto w-fit text-[12.5px] font-semibold text-[#5b9dff] hover:text-white"
            >
              Hap gjeneruesin →
            </button>
          </div>
        </section>

        {/* ── Generated-reports register ─────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-[13px] font-bold text-[#0f172a]">Raportet e gjeneruara</h2>
          <div className="overflow-x-auto rounded-xl border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[2.2fr_1fr_0.8fr_1.3fr_1.3fr_0.9fr_1.8fr] gap-x-3 border-b border-[#eef2f7] bg-[#f8fafc] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.04em] text-[#94a3b8]">
                <span>Raporti</span>
                <span>Kategoria</span>
                <span>Formati</span>
                <span>Gjeneruar nga</span>
                <span>Data</span>
                <span>Statusi</span>
                <span className="text-right">Veprime</span>
              </div>

              {props.generated.length === 0 ? (
                <p className="px-5 py-10 text-center text-[13px] text-[#94a3b8]">
                  Nuk ka raporte të gjeneruara ende.
                </p>
              ) : (
                props.generated.map((r, i) => (
                  <div
                    key={r.id}
                    className={cn(
                      "grid grid-cols-[2.2fr_1fr_0.8fr_1.3fr_1.3fr_0.9fr_1.8fr] items-center gap-x-3 px-5 py-3 transition-colors hover:bg-[#f8fafc]",
                      i < props.generated.length - 1 && "border-b border-[#f1f5f9]",
                      r.isArchived && "opacity-65",
                    )}
                  >
                    <Link
                      href={`/raportet/${r.id}`}
                      className="min-w-0 truncate text-[13px] font-semibold text-[#0f172a] hover:text-brand-blue"
                    >
                      {r.title}
                    </Link>
                    <span className="text-[12.5px] text-[#334155]">{r.categoryLabel}</span>
                    <FormatChip fmt={r.fileFormat} />
                    <span className="min-w-0 truncate text-[12.5px] text-[#334155]">
                      {r.generatedByDisplay ?? "—"}
                    </span>
                    <span className="text-[12px] tabular-nums text-[#64748b]">
                      {new Date(r.generatedAt).toLocaleString("sq")}
                    </span>
                    <RegisterStatusPill archived={r.isArchived} />
                    <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                      <Link
                        href={`/raportet/${r.id}`}
                        className="text-xs font-semibold text-[#64748b] hover:text-[#0f172a]"
                      >
                        Preview
                      </Link>
                      <a
                        href={`/api/reports/files/${r.id}`}
                        className="text-xs font-semibold text-brand-blue hover:text-[#1d4ed8]"
                      >
                        Shkarko
                      </a>
                      <button
                        type="button"
                        disabled={pending || r.isArchived}
                        onClick={() => void rowRegenerate(r.id)}
                        className="text-xs font-semibold text-brand-blue hover:text-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Rigjenero
                      </button>
                      <button
                        type="button"
                        disabled={pending || r.isArchived}
                        onClick={() => void rowArchive(r.id)}
                        className="text-xs font-semibold text-[#dc2626] hover:text-[#b91c1c] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Arkivo
                      </button>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* mobile CTA */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e2e8f0] bg-white/95 p-3 backdrop-blur md:hidden">
          <Button
            className="h-10 w-full rounded-[10px] bg-brand-blue text-[13.5px] font-semibold text-white hover:bg-[#1d4ed8]"
            onClick={() => setSheetOpen(true)}
          >
            Gjenero raport
          </Button>
        </div>
      </div>

      {/* ── Generation cockpit (7b) — wide two-pane sheet ─────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="flex w-full max-w-full flex-col gap-0 p-0 sm:max-w-[720px] xl:max-w-[1080px]"
        >
          <SheetHeader className="border-b border-[#eef2f7] px-6 py-4">
            <SheetTitle className="text-[17px] font-bold tracking-[-0.02em] text-[#0f172a]">
              Gjenero raport
            </SheetTitle>
            <p className="text-[13px] text-[#64748b]">
              Zgjidh llojin, filtrat dhe formatin — paraafisho para eksportit.
            </p>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto bg-brand-canvas p-4 md:p-5">
            <div className="grid items-start gap-4 xl:grid-cols-[320px_1fr]">
              {/* LEFT — type picker + contextual filters + format */}
              <div className="flex min-w-0 flex-col gap-4">
                <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
                  <div className="border-b border-[#eef2f7] px-4 pb-3 pt-3.5">
                    <p className="mb-2 text-[13px] font-bold text-[#0f172a]">Lloji i raportit</p>
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94a3b8]"
                        aria-hidden
                      />
                      <input
                        type="search"
                        value={typeQuery}
                        onChange={(e) => setTypeQuery(e.target.value)}
                        placeholder="Kërko raport…"
                        aria-label="Kërko raport"
                        className="h-[34px] w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] pl-8 pr-3 text-[12.5px] text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                      />
                    </div>
                  </div>
                  <div className="max-h-[248px] overflow-y-auto p-2">
                    {pickerCatalog.length === 0 ? (
                      <p className="px-2 py-4 text-[12.5px] text-[#94a3b8]">
                        Asnjë raport nuk përputhet.
                      </p>
                    ) : (
                      CATEGORY_ORDER.map((cat) => {
                        const rows = pickerCatalog.filter((c) => c.category === cat);
                        if (rows.length === 0) return null;
                        return (
                          <div key={cat}>
                            <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">
                              {categoryLabelFor(cat)}
                            </p>
                            {rows.map((c) => {
                              const active = c.type === reportType;
                              return (
                                <button
                                  key={c.type}
                                  type="button"
                                  onClick={() => syncFormatDefault(c.type, c.formats)}
                                  className={cn(
                                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                                    active ? "bg-[#eff6ff]" : "hover:bg-[#f8fafc]",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "h-1.5 w-1.5 shrink-0 rounded-full",
                                      active ? "bg-brand-blue" : "bg-[#cbd5e1]",
                                    )}
                                    aria-hidden
                                  />
                                  <span
                                    className={cn(
                                      "min-w-0 truncate text-[12.5px]",
                                      active
                                        ? "font-semibold text-brand-blue"
                                        : "text-[#334155]",
                                    )}
                                  >
                                    {c.titleSq}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* contextual filter card */}
                <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
                  <p className="mb-3.5 text-[13px] font-bold text-[#0f172a]">Filtrat</p>
                  <div className="flex flex-col gap-3">
                    {payrollReports(reportType) ? (
                      <div>
                        <label className={fieldLabelCls} htmlFor="rpt-payroll">
                          Periudha e pagës
                        </label>
                        <select
                          id="rpt-payroll"
                          className={fieldControlCls}
                          value={payrollId}
                          onChange={(e) => setPayrollId(e.target.value)}
                        >
                          <option value="">Zgjidh payroll…</option>
                          {props.picker.payrolls.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.year}-{String(p.month).padStart(2, "0")} ({p.status})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    {leaveReports(reportType) ? (
                      <div>
                        <label className={fieldLabelCls} htmlFor="rpt-leave-year">
                          Viti
                        </label>
                        <input
                          id="rpt-leave-year"
                          type="number"
                          className={fieldControlCls}
                          value={leaveYear}
                          onChange={(e) => setLeaveYear(Number(e.target.value))}
                        />
                      </div>
                    ) : null}

                    {terminationMonthReport(reportType) ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={fieldLabelCls} htmlFor="rpt-term-year">
                            Viti
                          </label>
                          <input
                            id="rpt-term-year"
                            type="number"
                            className={fieldControlCls}
                            value={termYear}
                            onChange={(e) => setTermYear(Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className={fieldLabelCls} htmlFor="rpt-term-month">
                            Muaji
                          </label>
                          <input
                            id="rpt-term-month"
                            type="number"
                            min={1}
                            max={12}
                            className={fieldControlCls}
                            value={termMonth}
                            onChange={(e) => setTermMonth(Number(e.target.value))}
                          />
                        </div>
                      </div>
                    ) : null}

                    {employeeReports(reportType) || reportType === "KONTRATA_AKTIVE" ? (
                      <>
                        <div>
                          <label className={fieldLabelCls} htmlFor="rpt-dept">
                            Departamenti (opsionale)
                          </label>
                          <select
                            id="rpt-dept"
                            className={fieldControlCls}
                            value={departmentId}
                            onChange={(e) => setDepartmentId(e.target.value)}
                          >
                            <option value="">Të gjithë</option>
                            {props.picker.departments.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={fieldLabelCls} htmlFor="rpt-emp">
                            Punonjësi (opsionale)
                          </label>
                          <select
                            id="rpt-emp"
                            className={fieldControlCls}
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value)}
                          >
                            <option value="">Të gjithë</option>
                            {props.picker.employees.map((em) => (
                              <option key={em.id} value={em.id}>
                                {em.lastName} {em.firstName}
                              </option>
                            ))}
                          </select>
                        </div>
                        {employeeReports(reportType) ? (
                          <>
                            <div>
                              <label className={fieldLabelCls} htmlFor="rpt-status">
                                Statusi
                              </label>
                              <select
                                id="rpt-status"
                                className={fieldControlCls}
                                value={employmentStatus}
                                onChange={(e) => setEmploymentStatus(e.target.value)}
                              >
                                <option value="">Çdo status</option>
                                <option value="ACTIVE">Aktiv</option>
                                <option value="TERMINATED">I larguar</option>
                                <option value="INACTIVE">Jo aktiv</option>
                                <option value="ON_LEAVE">Në pushim</option>
                                <option value="SUSPENDED">I pezulluar</option>
                              </select>
                            </div>
                            <div>
                              <label className={fieldLabelCls} htmlFor="rpt-type">
                                Lloji i punës
                              </label>
                              <select
                                id="rpt-type"
                                className={fieldControlCls}
                                value={employmentType}
                                onChange={(e) => setEmploymentType(e.target.value)}
                              >
                                <option value="">Të gjithë</option>
                                <option value="EMPLOYEE">Punonjës</option>
                                <option value="CONTRACTOR">Kontraktor</option>
                              </select>
                            </div>
                          </>
                        ) : null}
                      </>
                    ) : null}

                    {reportType === "KONTRATA_AFER_SKADIMIT" ? (
                      <>
                        <div>
                          <label className={fieldLabelCls} htmlFor="rpt-days">
                            Ditë deri në skadencë
                          </label>
                          <input
                            id="rpt-days"
                            type="number"
                            min={1}
                            max={730}
                            className={fieldControlCls}
                            value={daysAhead}
                            onChange={(e) => setDaysAhead(Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className={fieldLabelCls} htmlFor="rpt-dept-exp">
                            Departamenti (opsionale)
                          </label>
                          <select
                            id="rpt-dept-exp"
                            className={fieldControlCls}
                            value={departmentId}
                            onChange={(e) => setDepartmentId(e.target.value)}
                          >
                            <option value="">Të gjithë</option>
                            {props.picker.departments.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : null}

                    {reportType === "DOKUMENTET_E_GJENERUARA" ||
                    reportType === "DOKUMENTET_SIPAS_PUNONJESIT" ? (
                      <>
                        <div>
                          <label className={fieldLabelCls} htmlFor="rpt-doc-emp">
                            Punonjësi{" "}
                            {reportType === "DOKUMENTET_SIPAS_PUNONJESIT" ? "" : "(opsionale)"}
                          </label>
                          <select
                            id="rpt-doc-emp"
                            className={fieldControlCls}
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value)}
                          >
                            <option value="">
                              {reportType === "DOKUMENTET_SIPAS_PUNONJESIT"
                                ? "Zgjidhni…"
                                : "Të gjithë"}
                            </option>
                            {props.picker.employees.map((em) => (
                              <option key={em.id} value={em.id}>
                                {em.lastName} {em.firstName}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={fieldLabelCls} htmlFor="rpt-doc-cat">
                            Kategoria e dokumentit
                          </label>
                          <select
                            id="rpt-doc-cat"
                            className={fieldControlCls}
                            value={documentCategory}
                            onChange={(e) => setDocumentCategory(e.target.value)}
                          >
                            <option value="">Të gjitha</option>
                            <option value="CONTRACT">Kontratë</option>
                            <option value="LEAVE">Pushim</option>
                            <option value="TERMINATION">Largim</option>
                            <option value="WARNING">Paralajmërim</option>
                            <option value="PAYROLL">Pagë</option>
                            <option value="OTHER">Tjetër</option>
                          </select>
                        </div>
                        {reportType === "DOKUMENTET_E_GJENERUARA" ? (
                          <label className="flex items-center gap-2 text-[13px] text-[#334155]">
                            <input
                              type="checkbox"
                              checked={includeArchivedDocs}
                              onChange={(e) => setIncludeArchivedDocs(e.target.checked)}
                              className="h-4 w-4 rounded border-[#e2e8f0] accent-brand-blue"
                            />
                            Përfshi të arkivuarit
                          </label>
                        ) : null}
                      </>
                    ) : null}

                    {!hasContextualFilters ? (
                      <p className="text-[12.5px] text-[#94a3b8]">
                        Ky raport nuk kërkon filtra shtesë.
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* format segmented control */}
                <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
                  <p className="mb-3 text-[13px] font-bold text-[#0f172a]">Formati</p>
                  <div className="flex gap-2" role="radiogroup" aria-label="Formati i eksportit">
                    {ALL_FORMATS.map((f) => {
                      const supported = (selectedMeta?.formats ?? ["XLSX"]).includes(f);
                      const active = format === f;
                      return (
                        <button
                          key={f}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          disabled={!supported}
                          onClick={() => setFormat(f)}
                          className={cn(
                            "flex h-[38px] flex-1 items-center justify-center rounded-[9px] text-[13px] transition-colors",
                            active
                              ? "border-[1.5px] border-brand-blue bg-[#eff6ff] font-bold text-brand-blue"
                              : "border border-[#e2e8f0] bg-white font-semibold text-[#64748b] hover:bg-[#f8fafc]",
                            !supported && "cursor-not-allowed opacity-40 hover:bg-white",
                          )}
                        >
                          {f}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* RIGHT — live preview */}
              <div className="flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
                <div className="flex items-start justify-between gap-3 border-b border-[#eef2f7] px-4 py-3.5 md:px-[18px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-bold text-[#0f172a]">
                        {selectedMeta?.titleSq ?? "Raporti"}
                      </h3>
                      {selectedMeta ? (
                        <span className="inline-flex h-5 items-center rounded-full bg-[#eff6ff] px-2 text-[11px] font-semibold text-brand-blue">
                          {selectedMeta.categoryLabel}
                        </span>
                      ) : null}
                    </div>
                    {selectedMeta ? (
                      <p className="mt-1 text-xs text-[#94a3b8]">{selectedMeta.descriptionSq}</p>
                    ) : null}
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-[5px] text-[11.5px] font-semibold text-[#64748b]">
                    <Eye className="h-[13px] w-[13px] text-[#94a3b8]" aria-hidden />
                    Paraafishim
                  </span>
                </div>

                <div className="max-h-[460px] flex-1 overflow-auto">
                  {previewCols.length === 0 ? (
                    <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-1.5 px-6 text-center">
                      <Eye className="h-5 w-5 text-[#cbd5e1]" aria-hidden />
                      <p className="text-[13px] font-semibold text-[#64748b]">
                        Klikoni «Paraafishim»
                      </p>
                      <p className="text-xs text-[#94a3b8]">
                        Shfaqen kolonat reale dhe rreshtat e parë të raportit të zgjedhur.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-left">
                      <thead className="sticky top-0 z-10 bg-[#f8fafc]">
                        <tr>
                          {previewCols.map((c) => (
                            <th
                              key={c.key}
                              className="whitespace-nowrap border-b border-[#eef2f7] px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.03em] text-[#94a3b8]"
                            >
                              {c.headerSq}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={Math.max(previewCols.length, 1)}
                              className="px-3.5 py-8 text-center text-[12.5px] text-[#94a3b8]"
                            >
                              Asnjë rresht për filtrat e zgjedhur.
                            </td>
                          </tr>
                        ) : (
                          previewRows.map((row, i) => (
                            <tr
                              key={i}
                              className="border-b border-[#f1f5f9] transition-colors last:border-b-0 hover:bg-[#f8fafc]"
                            >
                              {previewCols.map((c) => (
                                <td
                                  key={c.key}
                                  className="whitespace-nowrap px-3.5 py-[9px] text-[12.5px] tabular-nums text-[#334155]"
                                >
                                  {String(row[c.key] ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                {previewCols.length > 0 ? (
                  <div className="border-t border-[#eef2f7] bg-[#f8fafc] px-4 py-2.5 text-[11.5px] text-[#94a3b8] md:px-[18px]">
                    {previewTruncated
                      ? `Shfaqen ${previewRows.length} rreshtat e parë në paraafishim · eksporti përfshin të gjitha`
                      : `${previewRows.length} rreshta në paraafishim`}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* sticky action bar */}
          <div className="flex items-center gap-3 border-t border-[#e2e8f0] bg-white px-4 py-3.5 md:px-6">
            <span className="hidden text-[12.5px] text-[#64748b] lg:block">
              Raporti ruhet në regjistër me gjurmë auditimi
            </span>
            <div className="flex-1" />
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => void runPreview()}
              className="h-10 rounded-[10px] border-[#e2e8f0] bg-white px-4 text-[13.5px] font-semibold text-[#334155] hover:bg-[#eef2f7]"
            >
              Paraafishim
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => void runGenerate()}
              className="h-10 rounded-[10px] bg-brand-blue px-5 text-[13.5px] font-semibold text-white hover:bg-[#1d4ed8]"
            >
              <Download className="h-4 w-4" aria-hidden />
              Gjenero dhe hap · {format}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
