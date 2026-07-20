"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, Printer } from "lucide-react";
import type { PayrollPeriodStatus } from "@prisma/client";
import { AppSubBar, SubBarStatus } from "@/components/layout/app-sub-bar";
import { Button } from "@/components/ui/button";
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
import { PayrollSpreadsheet } from "@/modules/payroll/components/spreadsheet/payroll-spreadsheet";
import { PayrollCorrectionsPanel } from "@/modules/payroll/components/corrections/payroll-corrections-panel";
import { cn } from "@/lib/utils";

/* ------------------------------- 1b style atoms ------------------------------- */

const BTN_P =
  "inline-flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-[9px] bg-brand-blue px-[17px] text-[13px] font-semibold text-white transition-colors hover:bg-[#1d4ed8] disabled:pointer-events-none disabled:opacity-50";
const BTN_S =
  "inline-flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-[#e2e8f0] bg-white px-[15px] text-[13px] font-semibold text-[#334155] transition-colors hover:bg-[#eef2f7] disabled:pointer-events-none disabled:opacity-50";
const BTN_S_BLUE =
  "inline-flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-[#cddcf4] bg-white px-[15px] text-[13px] font-semibold text-brand-blue transition-colors hover:bg-[#eff6ff] disabled:pointer-events-none disabled:opacity-50";
const BTN_SM_P =
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-blue px-3 text-xs font-semibold text-white transition-colors hover:bg-[#1d4ed8] disabled:pointer-events-none disabled:opacity-50";
const BTN_SM_S =
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#e2e8f0] bg-white px-3 text-xs font-semibold text-[#334155] transition-colors hover:bg-[#eef2f7] disabled:pointer-events-none disabled:opacity-50";
const BTN_SM_BLUE =
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#cddcf4] bg-white px-3 text-xs font-semibold text-brand-blue transition-colors hover:bg-[#eff6ff] disabled:pointer-events-none disabled:opacity-50";

const CARD = "rounded-xl border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]";
const CARD_TITLE = "border-b border-[#eef2f7] px-5 py-3 text-[13px] font-bold text-[#0f172a]";

const SEG_TRIGGER =
  "rounded-[7px] px-[15px] py-[7px] text-[13px] font-medium text-[#64748b] transition-colors hover:text-[#334155] data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-[#0f172a] data-[state=active]:shadow-[0_1px_2px_rgba(15,23,42,0.08)]";

/* ------------------------------------------------------------------------------ */

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

/** 9a — wide right-aligned totals card (Bruto, Neto accent, Tatimi, Trust 1, Trust 2, Punonjës). */
function PayrollTotalsSummaryCard(props: { data: PayrollDetailDto }) {
  const { totals } = props.data;
  const headcountStr = formatHeadcount(String(totals.headcount));

  const cells: Array<{
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
      aria-label="Totalet"
      className="max-w-[calc(100vw-32px)] overflow-x-auto rounded-xl border border-[#e5e7eb] bg-white px-5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.07)] sm:max-w-[calc(100vw-360px)] xl:max-w-none"
    >
      <div className="flex flex-nowrap items-stretch">
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className={cn(
              "flex flex-col items-end justify-end gap-1 px-[15px] first:pl-0 last:pr-0",
              i > 0 && "border-l border-[#e5e7eb]",
            )}
          >
            <span className="whitespace-nowrap text-[10px] font-semibold uppercase leading-none tracking-[0.07em] text-[#9ca3af]">
              {cell.label}
            </span>
            <span
              className={cn(
                "whitespace-nowrap text-[17px] font-bold leading-tight tracking-tight text-[#111827] [font-variant-numeric:tabular-nums]",
                cell.netHighlight && "font-extrabold text-[#1d4ed8]",
              )}
              title={cell.display}
            >
              {cell.display}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SUB_BAR_STATUS: Record<
  PayrollPeriodStatus,
  { tone: "info" | "success" | "warning" | "destructive" | "neutral" | "locked"; label: string }
> = {
  DRAFT: { tone: "warning", label: "Draft" },
  REVIEWED: { tone: "info", label: "Në shqyrtim" },
  APPROVED: { tone: "success", label: "I miratuar" },
  LOCKED: { tone: "locked", label: "I kyçur" },
  ARCHIVED: { tone: "neutral", label: "I arkivuar" },
};

function PayrollSubBarStatus({ status }: { status: PayrollPeriodStatus }) {
  const s = SUB_BAR_STATUS[status];
  return <SubBarStatus tone={s.tone}>{s.label}</SubBarStatus>;
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

  // Sub-bar description: company · working calendar · public holidays (kept from the old body block).
  const calendarSummary = data.workingCalendar
    ? `${data.workingCalendar.expectedWorkingDays} ditë pune · ${data.workingCalendar.expectedRegularHours} orë (${data.workingCalendar.hoursPerWorkingDay}h/ditë)`
    : payroll.expectedWorkingDays != null
      ? `${payroll.expectedWorkingDays} ditë pune · ${payroll.expectedRegularHours ?? "—"} orë të pritura`
      : null;
  const holidaySummary =
    data.workingCalendar && data.workingCalendar.weekdayPublicHolidayDates.length > 0
      ? `Festë publike: ${data.workingCalendar.weekdayPublicHolidayDates.join(", ")}.`
      : null;
  const subBarDescription = [[data.companyLabel, calendarSummary].filter(Boolean).join(" · "), holidaySummary]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <AppSubBar
        dense
        backHref="/pagat"
        backLabel="Pagat"
        title={payroll.monthLabel}
        status={<PayrollSubBarStatus status={payroll.status} />}
        description={subBarDescription || undefined}
        actions={<PayrollTotalsSummaryCard data={data} />}
      />
      <div className="space-y-5 pb-24 lg:pb-8">

      {payroll.validationWarnings.length > 0 ? (
        <section className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-5 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <h2 className="mb-2 text-[13px] font-bold text-[#b45309]">Sinjalizime validimi</h2>
          <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-[#92400e]">
            {payroll.validationWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.operationalSettings ? (
        <section className={CARD}>
          <h2 className={CARD_TITLE}>Parametrat operative (payroll_settings)</h2>
          <div className="grid gap-x-4 gap-y-2 px-5 py-4 text-xs leading-relaxed text-[#64748b] sm:grid-cols-2 lg:grid-cols-4">
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
              — Neni 60, Ligji i Punës: 100% është minimumi ligjor dhe zbatohet automatikisht si dysheme.
            </p>
          </div>
        </section>
      ) : null}

      {draftEditable && data.entries.length === 0 ? (
        <section className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-5 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <h2 className="mb-2 text-[13px] font-bold text-[#b45309]">Ende nuk ka rreshta për këtë payroll</h2>
          <div className="space-y-2 text-[13px] leading-relaxed text-[#92400e]">
            <p>
              Për të përfshirë punonjësit e përshtatshëm për{" "}
              <strong className="font-semibold text-[#78350f]">{payroll.monthLabel}</strong>, shtypni{" "}
              <strong className="font-semibold text-[#78350f]">Ripëllogarit punonjësit</strong>.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Përfshihen vetëm <strong className="font-semibold text-[#78350f]">EMPLOYEE</strong> (jo kontraktorët), me
                status <strong className="font-semibold text-[#78350f]">ACTIVE</strong> ose{" "}
                <strong className="font-semibold text-[#78350f]">ON_LEAVE</strong>.
              </li>
            </ul>
          </div>
        </section>
      ) : null}

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="h-auto w-fit max-w-full justify-start gap-[3px] rounded-[10px] border-0 bg-[#eef2f7] p-1 text-[#64748b]">
          <TabsTrigger className={SEG_TRIGGER} value="spreadsheet">
            Spreadsheet
          </TabsTrigger>
          <TabsTrigger className={SEG_TRIGGER} value="documents">
            PDF
          </TabsTrigger>
          <TabsTrigger className={SEG_TRIGGER} value="atk">
            ATK (Excel)
          </TabsTrigger>
          <TabsTrigger className={SEG_TRIGGER} value="timeline">
            Timeline
          </TabsTrigger>
          <TabsTrigger className={SEG_TRIGGER} value="corrections">
            Korrigjimet
          </TabsTrigger>
        </TabsList>

        {/* Workflow action row (desktop) */}
        <div className="mt-4 hidden flex-wrap items-center gap-2.5 lg:flex">
          {draftEditable ? (
            <button type="button" className={BTN_P} onClick={() => void exec("Ripëllogaritur.", regeneratePayrollAction(payroll.id))}>
              Ripëllogarit punonjësit
            </button>
          ) : null}
          {payroll.status === "DRAFT" ? (
            <button type="button" className={BTN_S} onClick={() => void exec("Shqyrtuar.", reviewPayrollAction(payroll.id))}>
              Shëno të shqyrtuar
            </button>
          ) : null}
          {payroll.status === "REVIEWED" ? (
            <>
              <button type="button" className={BTN_P} onClick={() => void exec("Miratuar.", approvePayrollAction(payroll.id))}>
                Mirato për kyçje
              </button>
              <button
                type="button"
                className={BTN_S_BLUE}
                onClick={() => void exec("Draft.", returnPayrollReviewToDraftAction(payroll.id))}
              >
                Kthe në draft (nga shqyrtimi)
              </button>
            </>
          ) : null}
          {payroll.status === "APPROVED" ? (
            <>
              <button type="button" className={BTN_P} onClick={() => void exec("Kyçur.", lockPayrollAction(payroll.id))}>
                Kyç payroll & snapshot
              </button>
              <button type="button" className={BTN_S} disabled={pdfPending} onClick={() => void generatePdfs()}>
                {pdfPending ? "Duke gjeneruar…" : "Paraprakisht: gjenero PDF"}
              </button>
            </>
          ) : null}
          {payroll.status === "LOCKED" ? (
            <button type="button" className={BTN_S} onClick={() => void exec("Arkivuar.", archivePayrollAction(payroll.id))}>
              Arkivo
            </button>
          ) : null}
          {draftEditable && data.entries.length > 0 ? (
            <button type="button" className={BTN_S} onClick={() => void exec("Validuar.", validatePayrollAction(payroll.id))}>
              Validizo (sinjalizime)
            </button>
          ) : null}
          <span className="ml-auto text-xs text-[#94a3b8]">
            Redaktimi aktiv vetëm në DRAFT · ruajtja autoritative në server
          </span>
        </div>

        <TabsContent value="spreadsheet" className="mt-4 space-y-3">
          <PayrollSpreadsheet
            payrollId={payroll.id}
            status={payroll.status}
            entries={data.entries}
            footerTotals={data.totals}
            pensionEmployeePercent={data.operationalSettings?.pensionEmployeePercent}
            pensionEmployerPercent={data.operationalSettings?.pensionEmployerPercent}
          />
          {draftEditable && data.entries.length > 0 ? (
            <div className={cn(CARD, "px-4 py-3")}>
              <p className="mb-2 text-xs font-semibold text-[#64748b]">Mbivendosje manuale bruto/neto (me arsye):</p>
              <div className="flex flex-wrap gap-2">
                {data.entries.map((e) => (
                  <button key={e.id} type="button" className={BTN_SM_S} onClick={() => openAdvanced(e)}>
                    Avancuar · {e.employeeName.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-4">
          <p className="max-w-3xl text-[13px] leading-relaxed text-[#64748b]">
            Fletëpagesat profesionale përfshijnë të ardhurat, zbritjet, neton dhe të dhënat bankare. Skedari quhet sipas
            punonjësit dhe muajit (p.sh.{" "}
            <code className="rounded bg-[#f1f5f9] px-1 text-xs text-[#334155]">Ajeti_Arines_Qershor_2026.pdf</code>
            ). Për printim masiv, përdorni paketën e kombinuar më poshtë.
          </p>
          {data.documents.length === 0 ? (
            <p className="text-sm text-[#64748b]">Ende nuk janë gjeneruar PDF.</p>
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
                    <section className={CARD}>
                      <h3 className={CARD_TITLE}>Printim masiv — të gjitha fletëpagesat</h3>
                      <div className="flex flex-wrap items-center gap-2 px-5 py-4">
                        <p className="w-full text-xs text-[#64748b]">
                          {bundle.filename} — {payslips.length} fletëpagesa në një PDF (një faqe për punonjës).
                        </p>
                        <a
                          className={BTN_SM_P}
                          href={`/api/payroll-documents/${bundle.id}?inline=1`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Printer className="h-3.5 w-3.5" aria-hidden />
                          Printo të gjitha
                        </a>
                        <a
                          className={BTN_SM_S}
                          href={`/api/payroll-documents/${bundle.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden />
                          Shkarko paketën
                        </a>
                      </div>
                    </section>
                  ) : null}

                  {payslips.length > 0 ? (
                    <section className={CARD}>
                      <h3 className={CARD_TITLE}>Fletëpagesat e punonjësve</h3>
                      <ul className="divide-y divide-[#f1f5f9]">
                        {payslips.map((d) => (
                          <li
                            key={d.id}
                            className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 transition-colors hover:bg-[#f8fafc]"
                          >
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-[#0f172a]">{d.employeeName ?? d.filename}</p>
                              <p className="truncate text-xs text-[#94a3b8]">{d.filename}</p>
                            </div>
                            <div className="flex shrink-0 gap-1.5">
                              <a
                                className={BTN_SM_BLUE}
                                href={`/api/payroll-documents/${d.id}?inline=1`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Printer className="h-3.5 w-3.5" aria-hidden />
                                Printo
                              </a>
                              <a
                                className={BTN_SM_S}
                                href={`/api/payroll-documents/${d.id}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Download className="h-3.5 w-3.5" aria-hidden />
                                Shkarko
                              </a>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {registers.length > 0 ? (
                    <section className={CARD}>
                      <h3 className={CARD_TITLE}>Listat e pagave</h3>
                      <ul className="divide-y divide-[#f1f5f9]">
                        {registers.map((d) => (
                          <li
                            key={d.id}
                            className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 transition-colors hover:bg-[#f8fafc]"
                          >
                            <span className="text-[13px] font-semibold text-[#0f172a]">{d.filename}</span>
                            <a
                              className={BTN_SM_S}
                              href={`/api/payroll-documents/${d.id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Shkarko
                            </a>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </>
              );
            })()
          )}
        </TabsContent>

        <TabsContent value="atk" className="mt-4 space-y-4">
          <section className={CARD}>
            <h3 className={CARD_TITLE}>Eksporti ATK (Excel — shablloni zyrtar)</h3>
            <div className="space-y-3 px-5 py-4 text-[13px] leading-relaxed text-[#64748b]">
              <p>
                Gjeneroni workbook-un nga <strong className="font-semibold text-[#0f172a]">Mostra Pagave ATK.xlsx</strong>{" "}
                në <code className="rounded bg-[#f1f5f9] px-1 py-0.5 text-xs text-[#334155]">public/atk_template/</code>.
                Kontraktorët përjashtohen automatikisht. Në{" "}
                <strong className="font-semibold text-[#0f172a]">LOCKED</strong> eksporti gjenerohet një herë; në{" "}
                <strong className="font-semibold text-[#0f172a]">APPROVED</strong> mund të rigjenerohet (eksportet e
                mëparshme arkivohen).
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={BTN_SM_P}
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
                </button>
                {latestAtkExport ? (
                  <a className={BTN_SM_S} href={latestAtkExport.downloadUrl} target="_blank" rel="noreferrer">
                    Shkarko eksportin aktiv
                  </a>
                ) : (
                  <button type="button" className={BTN_SM_S} disabled>
                    Shkarko eksportin aktiv
                  </button>
                )}
              </div>
              {!atkStatusEligible ? (
                <p className="text-xs text-[#94a3b8]">Gjenerimi aktiv vetëm për payroll APPROVED ose LOCKED.</p>
              ) : payroll.status === "LOCKED" && latestAtkExport ? (
                <p className="text-xs text-[#94a3b8]">
                  Payroll i kyçur: përdorni shkarkimin — rigjenerimi është i ndaluar.
                </p>
              ) : null}
            </div>
          </section>

          <section className={CARD}>
            <h3 className={CARD_TITLE}>Libri i Pagave / Përmbledhja Financiare (Pagat per ATK)</h3>
            <div className="space-y-3 px-5 py-4 text-[13px] leading-relaxed text-[#64748b]">
              <p>
                Eksportoni të gjitha të dhënat dhe llogaritjet e plota të motorit të payroll-it (përfshirë orët, bruto
                pagën, trustin, tatimin, bonuset dhe avanset) në një skedar Excel të stiluar me markën PagaPRO ose si
                skedar CSV.
              </p>
              <div className="flex flex-wrap gap-2">
                <a className={BTN_SM_BLUE} href={`/api/payroll/${payroll.id}/export-financial?format=xlsx`} download>
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Shkarko Excel (Branded)
                </a>
                <a className={BTN_SM_S} href={`/api/payroll/${payroll.id}/export-financial?format=csv`} download>
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Shkarko CSV
                </a>
              </div>
            </div>
          </section>

          <section className={CARD}>
            <h3 className={CARD_TITLE}>Historia e eksporteve ATK</h3>
            {data.atkExports.length === 0 ? (
              <p className="px-5 py-4 text-sm text-[#64748b]">Ende nuk ka eksporte ATK.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#eef2f7] bg-[#f8fafc] text-left text-[11px] font-bold uppercase tracking-[0.04em] text-[#94a3b8]">
                      <th className="px-5 py-3 font-bold">Koha</th>
                      <th className="px-3 py-3 font-bold">Nga</th>
                      <th className="px-3 py-3 font-bold">Hash (prefiks)</th>
                      <th className="px-3 py-3 font-bold">Arkiv</th>
                      <th className="px-5 py-3 text-right font-bold">Veprime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.atkExports.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-[#f1f5f9] transition-colors last:border-0 hover:bg-[#f8fafc]"
                      >
                        <td className="whitespace-nowrap px-5 py-2.5 text-[13px] text-[#64748b] [font-variant-numeric:tabular-nums]">
                          {new Date(row.generatedAt).toLocaleString("sq-XK")}
                        </td>
                        <td className="px-3 py-2.5 text-[13px] text-[#334155]">{row.generatedByLabel ?? "—"}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-[#334155]">{row.snapshotHashPrefix}</td>
                        <td className="px-3 py-2.5 text-[13px] text-[#334155]">{row.isArchived ? "Po" : "Jo"}</td>
                        <td className="px-5 py-2.5 text-right">
                          <div className="flex justify-end gap-1.5">
                            <a className={BTN_SM_S} href={row.downloadUrl} target="_blank" rel="noreferrer">
                              Shkarko
                            </a>
                            {payroll.status === "APPROVED" && !row.isArchived ? (
                              <button
                                type="button"
                                className={BTN_SM_BLUE}
                                onClick={() =>
                                  void exec(
                                    "Eksporti u arkivua.",
                                    archivePayrollAtkExportAction(row.id),
                                  )
                                }
                              >
                                Arkivo
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4 space-y-4">
          <section className={CARD}>
            <h3 className={CARD_TITLE}>Aktiviteti</h3>
            <ul className="divide-y divide-[#f1f5f9]">
              {data.timeline.map((t) => (
                <li key={t.id} className="px-5 py-3 text-[13px] leading-relaxed">
                  <span className="font-semibold text-[#0f172a]">{t.verb}</span>{" "}
                  <span className="text-[#334155]">— {t.summary}</span>
                  <span className="mt-1 block text-xs text-[#94a3b8] [font-variant-numeric:tabular-nums]">
                    {new Date(t.occurredAt).toLocaleString("sq-XK")}
                  </span>
                </li>
              ))}
              {data.timeline.length === 0 ? (
                <li className="px-5 py-4 text-sm text-[#64748b]">Nuk ka ngjarje ende.</li>
              ) : null}
            </ul>
          </section>
          <section className={CARD}>
            <h3 className={CARD_TITLE}>Audit log</h3>
            <ul className="divide-y divide-[#f1f5f9]">
              {data.auditTrail.map((a) => (
                <li key={a.id} className="px-5 py-2.5 text-xs text-[#64748b]">
                  <span className="font-semibold text-[#0f172a]">{a.action}</span> —{" "}
                  <span className="[font-variant-numeric:tabular-nums]">
                    {new Date(a.createdAt).toLocaleString("sq-XK")}
                  </span>
                </li>
              ))}
              {data.auditTrail.length === 0 ? (
                <li className="px-5 py-4 text-sm text-[#64748b]">Nuk ka audit ende.</li>
              ) : null}
            </ul>
          </section>
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

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e2e8f0] bg-white/95 p-3 backdrop-blur lg:hidden">
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
          {draftEditable && data.entries.length > 0 ? (
            <Button size="sm" variant="secondary" className="flex-1" type="button" onClick={() => void exec("Validuar.", validatePayrollAction(payroll.id))}>
              Validizo
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
    </>
  );
}
