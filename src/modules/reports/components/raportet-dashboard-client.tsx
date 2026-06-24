"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CatalogRow } from "@/modules/reports/services/report-registry";
import type { GeneratedReportListRow } from "@/modules/reports/services/report-query-service";
import type { ReportOutputFormat, ReportType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

export function RaportetDashboardClient(props: {
  catalog: CatalogRow[];
  generated: GeneratedReportListRow[];
  picker: PickerCtx;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [search, setSearch] = useState("");
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

  const selectedMeta = useMemo(
    () => props.catalog.find((c) => c.type === reportType),
    [props.catalog, reportType],
  );

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
    <div className="mx-auto max-w-6xl space-y-8 pb-24 md:pb-10">
      <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Raportet</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Qendra e eksporteve operative — punonjës, pagë, pushime, dokumente.
          </p>
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button>Gjenero raport</Button>
          </SheetTrigger>
          <SheetContent side="right" className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>Gjenerimi i raportit</SheetTitle>
              <p className="text-sm text-muted-foreground">
                Zgjidh llojin, filtrat dhe formatin; paraafisho para eksportit.
              </p>
            </SheetHeader>

            <div className="space-y-2">
              <Label>Lloji i raportit</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={reportType}
                onChange={(e) => {
                  const t = e.target.value as ReportType;
                  const meta = props.catalog.find((c) => c.type === t);
                  syncFormatDefault(t, meta?.formats ?? ["XLSX"]);
                }}
              >
                {props.catalog.map((c) => (
                  <option key={c.type} value={c.type}>
                    {c.categoryLabel}: {c.titleSq}
                  </option>
                ))}
              </select>
              {selectedMeta ? <p className="text-xs text-muted-foreground">{selectedMeta.descriptionSq}</p> : null}
            </div>

            {payrollReports(reportType) ? (
              <div className="space-y-2">
                <Label>Periudha e pagës</Label>
                <select
                  className="h-10 w-full rounded-md border px-2 text-sm"
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Viti</Label>
                  <Input
                    type="number"
                    value={leaveYear}
                    onChange={(e) => setLeaveYear(Number(e.target.value))}
                  />
                </div>
              </div>
            ) : null}

            {terminationMonthReport(reportType) ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Viti</Label>
                  <Input type="number" value={termYear} onChange={(e) => setTermYear(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Muaji</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={termMonth}
                    onChange={(e) => setTermMonth(Number(e.target.value))}
                  />
                </div>
              </div>
            ) : null}

            {employeeReports(reportType) || reportType === "KONTRATA_AKTIVE" ? (
              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label>Departamenti (opsionale)</Label>
                  <select
                    className="h-10 w-full rounded-md border px-2 text-sm"
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
                <div className="space-y-2">
                  <Label>Punonjësi (opsionale)</Label>
                  <select
                    className="h-10 w-full rounded-md border px-2 text-sm"
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
                    <div className="space-y-2">
                      <Label>Statusi</Label>
                      <select
                        className="h-10 w-full rounded-md border px-2 text-sm"
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
                    <div className="space-y-2">
                      <Label>Lloji i punës</Label>
                      <select
                        className="h-10 w-full rounded-md border px-2 text-sm"
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
              </div>
            ) : null}

            {reportType === "KONTRATA_AFER_SKADIMIT" ? (
              <div className="space-y-2">
                <Label>Ditë deri në skadencë</Label>
                <Input type="number" min={1} max={730} value={daysAhead} onChange={(e) => setDaysAhead(Number(e.target.value))} />
              </div>
            ) : null}

            {(reportType === "DOKUMENTET_E_GJENERUARA" || reportType === "DOKUMENTET_SIPAS_PUNONJESIT") && (
              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label>Punonjësi {reportType === "DOKUMENTET_SIPAS_PUNONJESIT" ? "" : "(opsionale)"}</Label>
                  <select
                    className="h-10 w-full rounded-md border px-2 text-sm"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                  >
                    <option value="">{reportType === "DOKUMENTET_SIPAS_PUNONJESIT" ? "Zgjidhni…" : "Të gjithë"}</option>
                    {props.picker.employees.map((em) => (
                      <option key={em.id} value={em.id}>
                        {em.lastName} {em.firstName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Kategoria e dokumentit</Label>
                  <select
                    className="h-10 w-full rounded-md border px-2 text-sm"
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
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeArchivedDocs}
                      onChange={(e) => setIncludeArchivedDocs(e.target.checked)}
                    />
                    Përfshi të arkivuarit
                  </label>
                ) : null}
              </div>
            )}

            <div className="space-y-2">
              <Label>Formati</Label>
              <select
                className="h-10 w-full rounded-md border px-2 text-sm"
                value={format}
                onChange={(e) => setFormat(e.target.value as ReportOutputFormat)}
              >
                {(selectedMeta?.formats ?? ["XLSX"]).map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div className="max-h-52 overflow-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    {previewCols.map((c) => (
                      <th key={c.key} className="whitespace-nowrap px-2 py-2 font-medium">
                        {c.headerSq}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.length === 0 ? (
                    <tr>
                      <td colSpan={Math.max(previewCols.length, 1)} className="px-2 py-6 text-center text-muted-foreground">
                        Klikoni «Paraafishim»
                      </td>
                    </tr>
                  ) : (
                    previewRows.map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {previewCols.map((c) => (
                          <td key={c.key} className="px-2 py-1">
                            {String(row[c.key] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {previewTruncated ? (
              <p className="text-xs text-muted-foreground">Shfaqen vetëm rreshtat e para të paraafishimit.</p>
            ) : null}

            <div className="mt-auto flex flex-col gap-2 border-t border-border px-6 py-4 sm:flex-row">
              <Button type="button" variant="outlinePrimary" disabled={pending} onClick={() => void runPreview()}>
                Paraafishim
              </Button>
              <Button type="button" disabled={pending} onClick={() => void runGenerate()}>
                Gjenero dhe hap
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <div className="space-y-3">
        <Label className="text-muted-foreground">Kërko në katalog</Label>
        <Input placeholder="Emër raporti ose kategori…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(["EMPLOYEE", "PAYROLL", "LEAVE", "DOCUMENT", "TERMINATION"] as const).map((cat) => (
          <div key={cat} className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {cat === "EMPLOYEE"
                ? "Punonjës"
                : cat === "PAYROLL"
                  ? "Pagë"
                  : cat === "LEAVE"
                    ? "Pushime"
                    : cat === "DOCUMENT"
                      ? "Dokumente"
                      : "Largime"}
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              {filteredCatalog
                .filter((c) =>
                  cat === "EMPLOYEE"
                    ? c.category === "EMPLOYEE"
                    : cat === "PAYROLL"
                      ? c.category === "PAYROLL"
                      : cat === "LEAVE"
                        ? c.category === "LEAVE"
                        : cat === "DOCUMENT"
                          ? c.category === "DOCUMENT"
                          : c.category === "TERMINATION",
                )
                .slice(0, 8)
                .map((c) => (
                  <li key={c.type}>
                    <button
                      type="button"
                      className="text-left text-primary underline-offset-4 hover:underline"
                      onClick={() => {
                        syncFormatDefault(c.type, c.formats);
                        setSheetOpen(true);
                      }}
                    >
                      {c.titleSq}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Raportet e gjeneruara</h2>
        <div className="hidden overflow-x-auto rounded-lg border md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Raporti</th>
                <th className="px-3 py-2 text-left font-medium">Kategoria</th>
                <th className="px-3 py-2 text-left font-medium">Formati</th>
                <th className="px-3 py-2 text-left font-medium">Gjeneruar nga</th>
                <th className="px-3 py-2 text-left font-medium">Data</th>
                <th className="px-3 py-2 text-left font-medium">Statusi</th>
                <th className="px-3 py-2 text-right font-medium">Veprime</th>
              </tr>
            </thead>
            <tbody>
              {props.generated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    Nuk ka raporte të gjeneruara ende.
                  </td>
                </tr>
              ) : (
                props.generated.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/raportet/${r.id}`} className="text-primary hover:underline">
                        {r.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{r.categoryLabel}</td>
                    <td className="px-3 py-2">{r.fileFormat}</td>
                    <td className="px-3 py-2">{r.generatedByDisplay ?? "—"}</td>
                    <td className="px-3 py-2">{new Date(r.generatedAt).toLocaleString("sq")}</td>
                    <td className="px-3 py-2">{r.isArchived ? "Arkivuar" : "Aktiv"}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button asChild size="sm" variant="outlinePrimary">
                          <Link href={`/raportet/${r.id}`}>Preview</Link>
                        </Button>
                        <Button asChild size="sm" variant="outlinePrimary">
                          <a href={`/api/reports/files/${r.id}`}>Download</a>
                        </Button>
                        <Button
                          size="sm"
                          variant="outlinePrimary"
                          disabled={pending || r.isArchived}
                          onClick={() => void rowRegenerate(r.id)}
                        >
                          Rigjenero
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={pending || r.isArchived}
                          onClick={() => void rowArchive(r.id)}
                        >
                          Arkivo
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 md:hidden">
          {props.generated.map((r) => (
            <div key={r.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex justify-between gap-2">
                <Link href={`/raportet/${r.id}`} className="font-semibold text-primary">
                  {r.title}
                </Link>
                <span className="text-xs text-muted-foreground">{r.fileFormat}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{r.categoryLabel}</p>
              <p className="mt-2 text-xs">{new Date(r.generatedAt).toLocaleString("sq")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outlinePrimary">
                  <Link href={`/raportet/${r.id}`}>Hap</Link>
                </Button>
                <Button asChild size="sm" variant="outlinePrimary">
                  <a href={`/api/reports/files/${r.id}`}>Shkarko</a>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
        <Button className="w-full" onClick={() => setSheetOpen(true)}>
          Gjenero raport
        </Button>
      </div>
    </div>
  );
}
