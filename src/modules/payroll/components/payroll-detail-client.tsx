"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PayrollDetailDto } from "@/modules/payroll/services/payroll-period-service";
import type { PayrollActionResult } from "@/modules/payroll/actions/payroll-actions";
import {
  approvePayrollAction,
  archivePayrollAtkExportAction,
  archivePayrollAction,
  generatePayrollAtkExportAction,
  generatePayrollPdfsAction,
  lockPayrollAction,
  regeneratePayrollAction,
  returnPayrollReviewToDraftAction,
  reviewPayrollAction,
  updatePayrollEntryAction,
  validatePayrollAction,
} from "@/modules/payroll/actions/payroll-actions";
import { PayrollStatusBadge } from "@/modules/payroll/components/payroll-status-badge";
import { PayrollSpreadsheet } from "@/modules/payroll/components/spreadsheet/payroll-spreadsheet";
import { PayrollCorrectionsPanel } from "@/modules/payroll/components/corrections/payroll-corrections-panel";
import { cn } from "@/lib/utils";

/** Plain payroll decimal string → EUR display (e.g. €999,999.99) without clipping large amounts. */
function formatPayrollEuro(amountStr: string): string {
  const normalized = String(amountStr).trim().replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return `€${amountStr}`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Integer headcount with grouping (e.g. 1,250). */
function formatHeadcount(raw: string): string {
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return String(raw);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n));
}

function PayrollTotalsSummaryCard(props: { data: PayrollDetailDto }) {
  const { totals } = props.data;
  const headcountStr = formatHeadcount(String(totals.headcount));

  const rows: Array<{
    label: string;
    display: string;
    netHighlight?: boolean;
  }> = [
    { label: "Bruto", display: formatPayrollEuro(totals.gross) },
    { label: "Neto", display: formatPayrollEuro(totals.net), netHighlight: true },
    { label: "Tatimi", display: formatPayrollEuro(totals.pitWithheld) },
    { label: "Trust 1", display: formatPayrollEuro(totals.pensionEmployee) },
    { label: "Trust 2", display: formatPayrollEuro(totals.pensionEmployer) },
    { label: "Punonjës", display: headcountStr },
  ];

  return (
    <div
      className={cn(
        "sticky top-4 z-10 ml-auto w-fit max-w-none shrink-0 self-start overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#FFFFFF]",
        "shadow-[0_1px_3px_rgba(0,0,0,0.07)]",
        "dark:border-border dark:bg-card dark:shadow-sm",
      )}
    >
      <div className="px-7 py-4">
        <h2 className="mb-3 border-b border-[#E5E7EB] pb-[10px] text-[13px] font-semibold leading-none tracking-tight text-foreground dark:border-border">
          Totalet
        </h2>
        <div className="flex w-full flex-row flex-nowrap items-stretch gap-0">
          {rows.map((row, i) => (
            <div
              key={row.label}
              className={cn(
                "flex min-w-[100px] flex-1 flex-col items-end justify-end gap-1 px-3 first:pl-0 last:pr-0",
                i > 0 && "border-l border-[#E5E7EB] dark:border-border",
              )}
            >
              <span className="whitespace-nowrap text-[10px] font-medium uppercase leading-none tracking-[0.07em] text-[#9CA3AF] dark:text-muted-foreground">
                {row.label}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-[18px] font-bold leading-tight tracking-tight text-[#111827] [font-variant-numeric:tabular-nums] dark:text-foreground",
                  row.netHighlight && "font-extrabold text-[#1D4ED8] dark:text-blue-400",
                )}
                title={row.display}
              >
                {row.display}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PayrollDetailClient(props: { data: PayrollDetailDto }) {
  const { data } = props;
  const router = useRouter();
  const { payroll } = data;
  const draftEditable = payroll.status === "DRAFT";
  const [atkPending, startAtkTransition] = useTransition();

  const latestAtkExport = data.atkExports.find((x) => !x.isArchived);
  const atkStatusEligible = payroll.status === "APPROVED" || payroll.status === "LOCKED";
  const canGenerateAtk =
    atkStatusEligible && (payroll.status === "LOCKED" ? latestAtkExport === undefined : true);

  const [tab, setTab] = useState("spreadsheet");
  const [advancedEntry, setAdvancedEntry] = useState<(typeof data.entries)[0] | null>(null);
  const [bonusInput, setBonusInput] = useState("");
  const [deductInput, setDeductInput] = useState("");
  const [advanceInput, setAdvanceInput] = useState("");
  const [grossOv, setGrossOv] = useState("");
  const [netOv, setNetOv] = useState("");
  const [grossReason, setGrossReason] = useState("");
  const [netReason, setNetReason] = useState("");
  const [notesInput, setNotesInput] = useState("");

  function openAdvanced(e: (typeof data.entries)[0]) {
    setAdvancedEntry(e);
    setBonusInput(e.bonuses);
    setDeductInput(e.otherDeductions);
    setAdvanceInput(e.salaryAdvanceDeduction);
    setGrossOv(e.manualGrossOverride ?? "");
    setNetOv(e.manualNetOverride ?? "");
    setGrossReason(e.manualGrossReason ?? "");
    setNetReason(e.manualNetReason ?? "");
    setNotesInput(e.notes ?? "");
  }

  async function saveAdvanced() {
    if (!advancedEntry) return;
    const r = await updatePayrollEntryAction({
      payrollId: payroll.id,
      entryId: advancedEntry.id,
      bonuses: bonusInput,
      otherDeductions: deductInput,
      salaryAdvanceDeduction: advanceInput,
      manualGrossOverride: grossOv.trim() === "" ? null : grossOv,
      manualNetOverride: netOv.trim() === "" ? null : netOv,
      manualGrossReason: grossReason.trim() === "" ? null : grossReason,
      manualNetReason: netReason.trim() === "" ? null : netReason,
      notes: notesInput.trim() === "" ? null : notesInput,
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Rreshti u përditësua.");
    setAdvancedEntry(null);
    router.refresh();
  }

  async function exec(label: string, p: Promise<PayrollActionResult<unknown>>) {
    try {
      const r = await p;
      if (!r.ok) {
        toast.error("error" in r ? r.error : "Veprimi dështoi.");
        return;
      }
      toast.success(label);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Veprimi dështoi për një gabim të papritur.");
    }
  }

  const [pdfPending, setPdfPending] = useState(false);

  async function generatePdfs() {
    setPdfPending(true);
    try {
      const r = await generatePayrollPdfsAction(payroll.id);
      if (!r.ok) {
        toast.error("error" in r ? r.error : "Gjenerimi i PDF dështoi.");
        return;
      }
      toast.success("PDF-t u gjeneruan. Po hapet skeda PDF për shkarkim.");
      setTab("documents");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gjenerimi i PDF dështoi për një gabim të papritur.");
    } finally {
      setPdfPending(false);
    }
  }

  const correctionEmployees = data.entries.map((e) => ({
    id: e.employeeId,
    label: `${e.employeeName} (${e.personalId})`,
  }));

  return (
    <div className="space-y-6 pb-24 lg:pb-8">
      <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-start lg:gap-6">
        <div className="min-w-0 w-full flex-1 space-y-3 lg:pr-2">
          <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit gap-1 px-2">
            <Link href="/pagat">
              <ArrowLeft className="h-4 w-4" />
              Pagat
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{payroll.monthLabel}</h1>
            <PayrollStatusBadge status={payroll.status} />
          </div>
          <p className="text-sm text-muted-foreground">{data.companyLabel}</p>
          {data.workingCalendar ? (
            <div className="max-w-2xl space-y-2 text-sm leading-relaxed text-muted-foreground">
              <p>
                <span className="font-medium text-foreground/90">Kalendari (motor):</span>{" "}
                {data.workingCalendar.expectedWorkingDays} ditë pune ·{" "}
                {data.workingCalendar.expectedRegularHours} orë (
                {data.workingCalendar.hoursPerWorkingDay}h/ditë nga PayrollSettings).
              </p>
              {data.workingCalendar.weekdayPublicHolidayDates.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-foreground/85">
                    Festa publike në ditë pune këtë muaj
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.workingCalendar.weekdayPublicHolidayDates.map((d) => (
                      <span
                        key={d}
                        className="inline-flex rounded-md border border-border/80 bg-muted/40 px-2 py-0.5 font-mono text-xs tabular-nums text-foreground"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : payroll.expectedWorkingDays != null ? (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Kalendari i ruajtur në payroll: {payroll.expectedWorkingDays} ditë ·{" "}
              {payroll.expectedRegularHours ?? "—"} orë të pritura.
            </p>
          ) : null}
        </div>

        <PayrollTotalsSummaryCard data={data} />
      </div>

      {payroll.validationWarnings.length > 0 ? (
        <Card className="border-amber-500/40 bg-amber-500/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-950 dark:text-amber-50">
              Sinjalizime validimi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {payroll.validationWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {data.operationalSettings ? (
        <Card className="border-border bg-muted/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Parametrat operative (payroll_settings)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
            <p>
              Minimalja (bazë): €{data.operationalSettings.minimumSalaryMonthly}
            </p>
            <p>
              Minimalja e planifikuar:{" "}
              {data.operationalSettings.minimumSalaryScheduledAmount
                ? `€${data.operationalSettings.minimumSalaryScheduledAmount}`
                : "—"}
            </p>
            <p>Pensioni pun.: {(Number(data.operationalSettings.pensionEmployeePercent) * 100).toFixed(2)}%</p>
            <p>Pensioni për.: {(Number(data.operationalSettings.pensionEmployerPercent) * 100).toFixed(2)}%</p>
            <p>Orët javore (konfigurim kompanie): {data.operationalSettings.standardWeeklyHours}h</p>
            <p>Orë/ditë (payroll_settings): {data.operationalSettings.hoursPerWorkingDay}h</p>
            <p>
              Normë javore referuese (overtime): {data.operationalSettings.overtimeWeeklyThresholdHours}h/javë · Sinjal OT:{" "}
              {data.operationalSettings.overtimeWeeklyCapHours}h/javë
            </p>
            <p>Përshkrim natë (HR): {data.operationalSettings.nightWorkPeriodDescription}</p>
            <p className="sm:col-span-2">
              Festat operative (Konfigurimet → Festat + legacy JSON): +
              {data.operationalSettings.payrollExtraHolidayDates.length} rreshta JSON shtesë · −
              {data.operationalSettings.payrollExcludedHolidayDates.length} përjashtime JSON · kalendari mujor në payroll përdor
              bashkimin DB + JSON.
            </p>
            <p>
              Multi OT / WE / HO / Natë: {data.operationalSettings.overtimeMultiplier} /{" "}
              {data.operationalSettings.weekendMultiplier} / {data.operationalSettings.holidayMultiplier} /{" "}
              {data.operationalSettings.nightWorkMultiplier}
            </p>
            <p>
              Pushimi mjekësor (% e normës): {(Number(data.operationalSettings.sickLeavePayPercent) * 100).toFixed(2)}%
              — parazgjedhje ligjore/kompani; shih dokumentacionin.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {draftEditable && data.entries.length === 0 ? (
        <Card className="border-amber-500/35 bg-amber-500/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-950 dark:text-amber-50">
              Ende nuk ka rreshta për këtë payroll
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Për të përfshirë punonjësit e përshtatshëm për{" "}
              <strong className="text-foreground">{payroll.monthLabel}</strong>, shtypni{" "}
              <strong className="text-foreground">Ripëllogarit punonjësit</strong>.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Përfshihen vetëm <strong className="text-foreground">EMPLOYEE</strong> (jo kontraktorët), me status{" "}
                <strong className="text-foreground">ACTIVE</strong> ose <strong className="text-foreground">ON_LEAVE</strong>.
              </li>
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 bg-muted/50 p-1 lg:inline-flex lg:w-auto">
          <TabsTrigger value="spreadsheet">Spreadsheet</TabsTrigger>
          <TabsTrigger value="documents">PDF</TabsTrigger>
          <TabsTrigger value="atk">ATK (Excel)</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="corrections">Korrigjimet</TabsTrigger>
        </TabsList>

        <TabsContent value="spreadsheet" className="mt-4 space-y-3">
          {draftEditable && data.entries.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outlinePrimary" size="sm" onClick={() => void exec("Validuar.", validatePayrollAction(payroll.id))}>
                Validizo (sinjalizime)
              </Button>
              <p className="self-center text-xs text-muted-foreground">
                Redaktimi aktiv vetëm në DRAFT; ruajtja autoritative është në server.
              </p>
            </div>
          ) : null}
          <PayrollSpreadsheet
            payrollId={payroll.id}
            status={payroll.status}
            entries={data.entries}
            footerTotals={data.totals}
            pensionEmployeePercent={data.operationalSettings?.pensionEmployeePercent}
            pensionEmployerPercent={data.operationalSettings?.pensionEmployerPercent}
          />
          {draftEditable && data.entries.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <span className="w-full text-xs text-muted-foreground">Mbivendosje manuale bruto/neto (me arsye):</span>
              {data.entries.map((e) => (
                <Button key={e.id} type="button" size="sm" variant="secondary" onClick={() => openAdvanced(e)}>
                  Avancuar · {e.employeeName.split(" ")[0]}
                </Button>
              ))}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Fletëpagesat profesionale përfshijnë të ardhurat, zbritjet, neton dhe të dhënat bankare. Skedari quhet sipas
            punonjësit dhe muajit (p.sh. <code className="rounded bg-muted px-1 text-xs">Ajeti_Arines_Qershor_2026.pdf</code>
            ). Për printim masiv, përdorni paketën e kombinuar më poshtë.
          </p>
          {data.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ende nuk janë gjeneruar PDF.</p>
          ) : (
            (() => {
              const bundle = data.documents.find((d) => d.kind === "PAYSLIPS_PRINT_BUNDLE");
              const payslips = data.documents.filter((d) => d.kind === "EMPLOYEE_PAYSLIP");
              const registers = data.documents.filter(
                (d) => d.kind === "REGISTER_WITH_TOTALS" || d.kind === "REGISTER_SIGNATURE_LIST",
              );

              return (
                <>
                  {bundle ? (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Printim masiv — të gjitha fletëpagesat</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-wrap items-center gap-2">
                        <p className="w-full text-xs text-muted-foreground">
                          {bundle.filename} — {payslips.length} fletëpagesa në një PDF (një faqe për punonjës).
                        </p>
                        <Button variant="default" size="sm" asChild>
                          <a
                            href={`/api/payroll-documents/${bundle.id}?inline=1`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Printer className="mr-1.5 h-3.5 w-3.5" />
                            Printo të gjitha
                          </a>
                        </Button>
                        <Button variant="secondary" size="sm" asChild>
                          <a href={`/api/payroll-documents/${bundle.id}`} target="_blank" rel="noreferrer">
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            Shkarko paketën
                          </a>
                        </Button>
                      </CardContent>
                    </Card>
                  ) : null}

                  {payslips.length > 0 ? (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Fletëpagesat e punonjësve</h3>
                      <ul className="space-y-2 text-sm">
                        {payslips.map((d) => (
                          <li
                            key={d.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="font-medium">{d.employeeName ?? d.filename}</p>
                              <p className="truncate text-xs text-muted-foreground">{d.filename}</p>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <Button variant="outlinePrimary" size="sm" asChild>
                                <a
                                  href={`/api/payroll-documents/${d.id}?inline=1`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Printer className="mr-1 h-3.5 w-3.5" />
                                  Printo
                                </a>
                              </Button>
                              <Button variant="secondary" size="sm" asChild>
                                <a href={`/api/payroll-documents/${d.id}`} target="_blank" rel="noreferrer">
                                  <Download className="mr-1 h-3.5 w-3.5" />
                                  Shkarko
                                </a>
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {registers.length > 0 ? (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Listat e pagave</h3>
                      <ul className="space-y-2 text-sm">
                        {registers.map((d) => (
                          <li
                            key={d.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2"
                          >
                            <span className="font-medium">{d.filename}</span>
                            <Button variant="secondary" size="sm" asChild>
                              <a href={`/api/payroll-documents/${d.id}`} target="_blank" rel="noreferrer">
                                Shkarko
                              </a>
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              );
            })()
          )}
        </TabsContent>

        <TabsContent value="atk" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Eksporti ATK (Excel — shablloni zyrtar)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Gjeneroni workbook-un nga <strong className="text-foreground">Mostra Pagave ATK.xlsx</strong> në{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">public/atk_template/</code>. Kontraktorët përjashtohen
                automatikisht. Në <strong className="text-foreground">LOCKED</strong> eksporti gjenerohet një herë; në{" "}
                <strong className="text-foreground">APPROVED</strong> mund të rigjenerohet (eksportet e mëparshme arkivohen).
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!canGenerateAtk || atkPending}
                  onClick={() =>
                    startAtkTransition(() => {
                      void generatePayrollAtkExportAction(payroll.id).then((r) => {
                        if (!r.ok) {
                          toast.error(r.error);
                          return;
                        }
                        toast.success("Eksporti ATK u gjenerua.");
                        router.refresh();
                      });
                    })
                  }
                >
                  {atkPending ? "Duke punuar…" : "Gjenero eksportin ATK"}
                </Button>
                {latestAtkExport ? (
                  <Button variant="secondary" size="sm" asChild>
                    <a href={latestAtkExport.downloadUrl} target="_blank" rel="noreferrer">
                      Shkarko eksportin aktiv
                    </a>
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" type="button" disabled>
                    Shkarko eksportin aktiv
                  </Button>
                )}
              </div>
              {!atkStatusEligible ? (
                <p className="text-xs">Gjenerimi aktiv vetëm për payroll APPROVED ose LOCKED.</p>
              ) : payroll.status === "LOCKED" && latestAtkExport ? (
                <p className="text-xs">Payroll i kyçur: përdorni shkarkimin — rigjenerimi është i ndaluar.</p>
              ) : null}
            </CardContent>
          </Card>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Historia e eksporteve ATK</h3>
            {data.atkExports.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ende nuk ka eksporte ATK.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                      <th className="px-3 py-2">Koha</th>
                      <th className="px-3 py-2">Nga</th>
                      <th className="px-3 py-2">Hash (prefiks)</th>
                      <th className="px-3 py-2">Arkiv</th>
                      <th className="px-3 py-2 text-right">Veprime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.atkExports.map((row) => (
                      <tr key={row.id} className="border-b border-border/80 last:border-0">
                        <td className="px-3 py-2 whitespace-nowrap tabular-nums text-muted-foreground">
                          {new Date(row.generatedAt).toLocaleString("sq-XK")}
                        </td>
                        <td className="px-3 py-2">{row.generatedByLabel ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.snapshotHashPrefix}</td>
                        <td className="px-3 py-2">{row.isArchived ? "Po" : "Jo"}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="secondary" size="sm" asChild>
                              <a href={row.downloadUrl} target="_blank" rel="noreferrer">
                                Shkarko
                              </a>
                            </Button>
                            {payroll.status === "APPROVED" && !row.isArchived ? (
                              <Button
                                variant="outlinePrimary"
                                size="sm"
                                type="button"
                                onClick={() =>
                                  void exec(
                                    "Eksporti u arkivua.",
                                    archivePayrollAtkExportAction(row.id),
                                  )
                                }
                              >
                                Arkivo
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4 space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Aktiviteti</h3>
            <ul className="space-y-2 text-sm">
              {data.timeline.map((t) => (
                <li key={t.id} className="rounded-md border border-border bg-card px-3 py-2">
                  <span className="font-medium">{t.verb}</span> — {t.summary}
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {new Date(t.occurredAt).toLocaleString("sq-XK")}
                  </span>
                </li>
              ))}
              {data.timeline.length === 0 ? (
                <li className="text-muted-foreground">Nuk ka ngjarje ende.</li>
              ) : null}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Audit log</h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {data.auditTrail.map((a) => (
                <li key={a.id}>
                  <span className="font-medium text-foreground">{a.action}</span> —{" "}
                  {new Date(a.createdAt).toLocaleString("sq-XK")}
                </li>
              ))}
              {data.auditTrail.length === 0 ? <li>Nuk ka audit ende.</li> : null}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="corrections" className="mt-4">
          <PayrollCorrectionsPanel
            payrollId={payroll.id}
            allowCreate={payroll.status === "LOCKED" || payroll.status === "ARCHIVED"}
            corrections={data.corrections}
            employeeOptions={correctionEmployees}
          />
        </TabsContent>
      </Tabs>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg flex-wrap gap-2">
          {draftEditable ? (
            <Button size="sm" className="flex-1" type="button" onClick={() => void exec("Ripëllogaritur.", regeneratePayrollAction(payroll.id))}>
              Ripëllogarit
            </Button>
          ) : null}
          {payroll.status === "DRAFT" ? (
            <Button size="sm" variant="secondary" className="flex-1" type="button" onClick={() => void exec("Shqyrtuar.", reviewPayrollAction(payroll.id))}>
              Shëno të shqyrtuar
            </Button>
          ) : null}
          {payroll.status === "REVIEWED" ? (
            <>
              <Button size="sm" variant="outlinePrimary" className="flex-1" type="button" onClick={() => void exec("Draft.", returnPayrollReviewToDraftAction(payroll.id))}>
                Kthe në draft
              </Button>
              <Button size="sm" className="flex-1" type="button" onClick={() => void exec("Miratuar.", approvePayrollAction(payroll.id))}>
                Mirato
              </Button>
            </>
          ) : null}
          {payroll.status === "APPROVED" ? (
            <>
              <Button size="sm" className="flex-1" type="button" onClick={() => void exec("Kyçur.", lockPayrollAction(payroll.id))}>
                Kyç
              </Button>
              <Button size="sm" variant="secondary" className="flex-1" type="button" disabled={pdfPending} onClick={() => void generatePdfs()}>
                {pdfPending ? "Duke gjeneruar…" : "PDF paraprak"}
              </Button>
            </>
          ) : null}
          {payroll.status === "LOCKED" ? (
            <Button size="sm" variant="secondary" className="flex-1" type="button" onClick={() => void exec("Arkivuar.", archivePayrollAction(payroll.id))}>
              Arkivo
            </Button>
          ) : null}
        </div>
      </div>

      <div className="hidden flex-wrap gap-2 lg:flex">
        {draftEditable ? (
          <Button type="button" onClick={() => void exec("Ripëllogaritur.", regeneratePayrollAction(payroll.id))}>
            Ripëllogarit punonjësit
          </Button>
        ) : null}
        {payroll.status === "DRAFT" ? (
          <Button type="button" variant="secondary" onClick={() => void exec("Shqyrtuar.", reviewPayrollAction(payroll.id))}>
            Shëno të shqyrtuar
          </Button>
        ) : null}
        {payroll.status === "REVIEWED" ? (
          <>
            <Button type="button" variant="outlinePrimary" onClick={() => void exec("Draft.", returnPayrollReviewToDraftAction(payroll.id))}>
              Kthe në draft (nga shqyrtimi)
            </Button>
            <Button type="button" onClick={() => void exec("Miratuar.", approvePayrollAction(payroll.id))}>
              Mirato për kyçje
            </Button>
          </>
        ) : null}
        {payroll.status === "APPROVED" ? (
          <>
            <Button type="button" onClick={() => void exec("Kyçur.", lockPayrollAction(payroll.id))}>
              Kyç payroll & snapshot
            </Button>
            <Button type="button" variant="secondary" disabled={pdfPending} onClick={() => void generatePdfs()}>
              {pdfPending ? "Duke gjeneruar…" : "Paraprakisht: gjenero PDF"}
            </Button>
          </>
        ) : null}
        {payroll.status === "LOCKED" ? (
          <Button type="button" variant="secondary" onClick={() => void exec("Arkivuar.", archivePayrollAction(payroll.id))}>
            Arkivo
          </Button>
        ) : null}
      </div>

      <Dialog
        open={!!advancedEntry}
        onOpenChange={(open) => {
          if (!open) setAdvancedEntry(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Redaktim i avancuar — {advancedEntry?.employeeName}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <div className="grid gap-1 sm:col-span-2">
              <Label htmlFor="bonus">Bonus (EUR)</Label>
              <Input id="bonus" value={bonusInput} onChange={(ev) => setBonusInput(ev.target.value)} />
            </div>
            <div className="grid gap-1 sm:col-span-2">
              <Label htmlFor="ded">Zbritje të tjera (EUR)</Label>
              <Input id="ded" value={deductInput} onChange={(ev) => setDeductInput(ev.target.value)} />
            </div>
            <div className="grid gap-1 sm:col-span-2">
              <Label htmlFor="adv">Zbritje avansi (EUR)</Label>
              <Input id="adv" value={advanceInput} onChange={(ev) => setAdvanceInput(ev.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="gov">Mbivendosje bruto</Label>
              <Input id="gov" value={grossOv} onChange={(ev) => setGrossOv(ev.target.value)} placeholder=" bosh për auto" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="gr">Arsyeja (bruto)</Label>
              <Input id="gr" value={grossReason} onChange={(ev) => setGrossReason(ev.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="nov">Mbivendosje neto</Label>
              <Input id="nov" value={netOv} onChange={(ev) => setNetOv(ev.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="nr">Arsyeja (neto)</Label>
              <Input id="nr" value={netReason} onChange={(ev) => setNetReason(ev.target.value)} />
            </div>
            <div className="grid gap-1 sm:col-span-2">
              <Label htmlFor="notes">Shënime</Label>
              <Input id="notes" value={notesInput} onChange={(ev) => setNotesInput(ev.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => setAdvancedEntry(null)}>
              Anulo
            </Button>
            <Button type="button" onClick={() => void saveAdvanced()}>
              Ruaj & ripëllogarit rreshtin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
