"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { PayrollPeriodStatus } from "@prisma/client";
import { AppSubBar, SubBarStatus } from "@/components/layout/app-sub-bar";
import { Button } from "@/components/ui/button";
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
  includeAllEmployeesInPayrollAction,
  regeneratePayrollAction,
  returnPayrollReviewToDraftAction,
  validatePayrollAction,
} from "@/modules/payroll/actions/payroll-actions";
import { PayrollSpreadsheet } from "@/modules/payroll/components/spreadsheet/payroll-spreadsheet";
import { PayrollCorrectionsPanel } from "@/modules/payroll/components/corrections/payroll-corrections-panel";
import { PayrollDocumentsTab } from "@/modules/payroll/components/tabs/payroll-documents-tab";
import { PayrollAtkTab } from "@/modules/payroll/components/tabs/payroll-atk-tab";
import { PayrollHistoryTab } from "@/modules/payroll/components/tabs/payroll-history-tab";
import { CARD, CARD_TITLE } from "@/modules/payroll/components/payroll-card";
import { cn } from "@/lib/utils";

const SEG_TRIGGER =
  "rounded-[7px] px-[15px] py-[7px] text-[13px] font-medium text-[#64748b] transition-colors hover:text-[#334155] data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-[#0f172a] data-[state=active]:shadow-[0_1px_2px_rgba(15,23,42,0.08)]";

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

/**
 * Totals as a stat strip at the top of the body, matching Punonjësit. They used
 * to occupy the sub-bar's `actions` slot, which pushed the actual workflow
 * actions below the tab bar where they floated over every panel.
 */
function PayrollTotalsStrip({ data }: { data: PayrollDetailDto }) {
  const { totals } = data;
  const cells: Array<{ label: string; display: string; accent?: boolean }> = [
    { label: "Bruto", display: formatPayrollEuro(totals.gross) },
    { label: "Neto", display: formatPayrollEuro(totals.net), accent: true },
    { label: "Tatimi", display: formatPayrollEuro(totals.pitWithheld) },
    { label: "Trust 1", display: formatPayrollEuro(totals.pensionEmployee) },
    { label: "Trust 2", display: formatPayrollEuro(totals.pensionEmployer) },
    { label: "Punonjës", display: formatHeadcount(String(totals.headcount)) },
  ];

  return (
    <div aria-label="Totalet" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="rounded-xl border border-[#e2e8f0] bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">{cell.label}</p>
          <p
            className={cn(
              "mt-1.5 truncate text-[20px] font-extrabold leading-none tracking-[-0.02em] text-[#0f172a] [font-variant-numeric:tabular-nums]",
              cell.accent && "text-[#1d4ed8]",
            )}
            title={cell.display}
          >
            {cell.display}
          </p>
        </div>
      ))}
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

/**
 * One descriptor per action. Desktop renders `label` with its `hint` beneath;
 * the mobile bar renders `shortLabel` alone. Previously two hand-written lists,
 * which is how "Kyç payroll & snapshot" and "Kyç" ended up as the same button
 * under two different names.
 */
interface WorkflowAction {
  id: string;
  label: string;
  shortLabel: string;
  /** One line saying what pressing this actually does. */
  hint: string;
  variant: "default" | "secondary" | "outlinePrimary";
  run: () => void;
  disabled?: boolean;
}

/** A workflow button carries its own explanation — nobody should have to guess. */
function WorkflowButton({ action }: { action: WorkflowAction }) {
  return (
    <Button
      type="button"
      variant={action.variant}
      onClick={action.run}
      disabled={action.disabled}
      className="h-auto flex-col items-start gap-0.5 py-2 text-left"
    >
      <span className="text-[13px] font-semibold leading-tight">{action.label}</span>
      <span className="text-[10.5px] font-normal leading-tight opacity-75">{action.hint}</span>
    </Button>
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
  const canGeneratePdfs = payroll.status === "APPROVED" || payroll.status === "LOCKED";

  async function generatePdfs() {
    setPdfPending(true);
    try {
      const r = await generatePayrollPdfsAction(payroll.id);
      if (!r.ok) {
        toast.error("error" in r ? r.error : "Gjenerimi i PDF dështoi.");
        return;
      }
      toast.success("PDF-t u gjeneruan.");
      setTab("documents");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gjenerimi i PDF dështoi për një gabim të papritur.");
    } finally {
      setPdfPending(false);
    }
  }

  /**
   * The chain is Llogarit Pagat → Valido → Mirato → Aprovo Pagat → Mbyll dhe
   * Arkivo, and each step only appears once the one before it has been done —
   * so the page never offers an action the payroll is not ready for.
   *
   * Kthehu reaches back over every step up to the freeze. Aprovo Pagat writes
   * the compliance snapshot, so nothing after it can be undone.
   */
  const hasEntries = data.entries.length > 0;
  const validated = payroll.validatedAt != null;
  const workflowActions: WorkflowAction[] = [];

  if (draftEditable) {
    workflowActions.push({
      id: "regenerate",
      label: "Llogarit Pagat",
      shortLabel: "Llogarit Pagat",
      hint: "Ndërton rreshtat nga punonjësit aktivë të muajit.",
      variant: hasEntries ? "secondary" : "default",
      run: () => void exec("Pagat u llogaritën.", regeneratePayrollAction(payroll.id)),
    });
    if (hasEntries) {
      workflowActions.push({
        id: "validate",
        label: "Valido",
        shortLabel: "Valido",
        hint: "Kontrollon të dhënat dhe shfaq sinjalizimet përpara miratimit.",
        variant: validated ? "secondary" : "default",
        run: () => void exec("Të dhënat u validuan.", validatePayrollAction(payroll.id)),
      });
    }
    if (hasEntries && validated) {
      workflowActions.push({
        id: "approve",
        label: "Mirato",
        shortLabel: "Mirato",
        hint: "Kontrollet janë kryer — pagat janë gati për hapat e fundit.",
        variant: "default",
        run: () => void exec("Pagat u miratuan.", approvePayrollAction(payroll.id)),
      });
    }
  }

  // Legacy rows that entered REVIEWED under the previous chain still move on.
  if (payroll.status === "REVIEWED") {
    workflowActions.push({
      id: "approve",
      label: "Mirato",
      shortLabel: "Mirato",
      hint: "Kontrollet janë kryer — pagat janë gati për hapat e fundit.",
      variant: "default",
      run: () => void exec("Pagat u miratuan.", approvePayrollAction(payroll.id)),
    });
  }

  if (payroll.status === "APPROVED") {
    workflowActions.push({
      id: "lock",
      label: "Aprovo Pagat",
      shortLabel: "Aprovo Pagat",
      hint: "Ngrin pagat. Pas këtij hapi nuk mund të ktheheni për t'i ndryshuar.",
      variant: "default",
      run: () => void exec("Pagat u aprovuan dhe u ngrinë.", lockPayrollAction(payroll.id)),
    });
  }

  if (payroll.status === "REVIEWED" || payroll.status === "APPROVED") {
    workflowActions.push({
      id: "return",
      label: "Kthehu",
      shortLabel: "Kthehu",
      hint: "Kthehu një hap prapa për të ndryshuar pagat.",
      variant: "outlinePrimary",
      run: () => void exec("U kthye për redaktim.", returnPayrollReviewToDraftAction(payroll.id)),
    });
  }

  if (payroll.status === "LOCKED") {
    workflowActions.push({
      id: "archive",
      label: "Mbyll dhe Arkivo",
      shortLabel: "Mbyll dhe Arkivo",
      hint: "Mbyll muajin dhe e kalon në arkiv.",
      variant: "secondary",
      run: () => void exec("Muaji u mbyll dhe u arkivua.", archivePayrollAction(payroll.id)),
    });
  }

  const correctionEmployees = data.entries.map((e) => ({
    id: e.employeeId,
    label: `${e.employeeName} (${e.personalId})`,
  }));

  // Sub-bar description: company · working calendar · public holidays.
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
        actions={
          workflowActions.length > 0 ? (
            <div className="hidden flex-wrap items-stretch gap-2 lg:flex">
              {workflowActions.map((a) => (
                <WorkflowButton key={a.id} action={a} />
              ))}
            </div>
          ) : undefined
        }
      />
      <div className="space-y-5 pb-24 lg:pb-8">
        <PayrollTotalsStrip data={data} />

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

        {data.restrictedToEmployeeCount > 0 ? (
          <section className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-5 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
            <h2 className="mb-2 text-[13px] font-bold text-[#b45309]">
              Ky payroll është i kufizuar te {data.restrictedToEmployeeCount} punonjës
            </h2>
            <div className="space-y-2 text-[13px] leading-relaxed text-[#92400e]">
              <p>
                Ripëllogaritja përfshin vetëm këta punonjës — punonjësit e tjerë të përshtatshëm nuk
                shfaqen. Hiqni kufizimin që payroll-i të mbulojë të gjithë punonjësit e muajit.
              </p>
              {draftEditable ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void exec("U përfshinë të gjithë punonjësit.", includeAllEmployeesInPayrollAction(payroll.id))
                  }
                >
                  Përfshi të gjithë punonjësit
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Reference data, not an alert — closed by default so it stops sitting
            between the header and the work. */}
        {data.operationalSettings ? (
          <details className={CARD}>
            <summary className={cn(CARD_TITLE, "cursor-pointer select-none list-none")}>
              Parametrat e llogaritjes
            </summary>
            <div className="grid gap-x-4 gap-y-2 px-5 py-4 text-xs leading-relaxed text-[#64748b] sm:grid-cols-2 lg:grid-cols-4">
              <p>Minimalja (bazë): €{data.operationalSettings.minimumSalaryMonthly}</p>
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
                Normë javore referuese (overtime): {data.operationalSettings.overtimeWeeklyThresholdHours}h/javë ·
                Sinjal OT: {data.operationalSettings.overtimeWeeklyCapHours}h/javë
              </p>
              <p>Përshkrim natë (HR): {data.operationalSettings.nightWorkPeriodDescription}</p>
              <p className="sm:col-span-2">
                Festat operative (Konfigurimet → Festat + legacy JSON): +
                {data.operationalSettings.payrollExtraHolidayDates.length} rreshta JSON shtesë · −
                {data.operationalSettings.payrollExcludedHolidayDates.length} përjashtime JSON · kalendari mujor
                në payroll përdor bashkimin DB + JSON.
              </p>
              <p>
                Multi OT / WE / HO / Natë: {data.operationalSettings.overtimeMultiplier} /{" "}
                {data.operationalSettings.weekendMultiplier} / {data.operationalSettings.holidayMultiplier} /{" "}
                {data.operationalSettings.nightWorkMultiplier}
              </p>
              <p>
                Pushimi mjekësor (% e normës):{" "}
                {(Number(data.operationalSettings.sickLeavePayPercent) * 100).toFixed(2)}% — Neni 60, Ligji i
                Punës: 100% është minimumi ligjor dhe zbatohet automatikisht si dysheme.
              </p>
            </div>
          </details>
        ) : null}

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="h-auto w-fit max-w-full justify-start gap-[3px] rounded-[10px] border-0 bg-[#eef2f7] p-1 text-[#64748b]">
            <TabsTrigger className={SEG_TRIGGER} value="spreadsheet">
              Spreadsheet
            </TabsTrigger>
            <TabsTrigger className={SEG_TRIGGER} value="documents">
              Dokumente
            </TabsTrigger>
            <TabsTrigger className={SEG_TRIGGER} value="atk">
              ATK
            </TabsTrigger>
            <TabsTrigger className={SEG_TRIGGER} value="history">
              Historia
            </TabsTrigger>
            <TabsTrigger className={SEG_TRIGGER} value="corrections">
              Korrigjimet
            </TabsTrigger>
          </TabsList>

          <TabsContent value="spreadsheet" className="mt-4 space-y-3">
            <PayrollSpreadsheet
              payrollId={payroll.id}
              status={payroll.status}
              entries={data.entries}
              footerTotals={data.totals}
              pensionEmployeePercent={data.operationalSettings?.pensionEmployeePercent}
              pensionEmployerPercent={data.operationalSettings?.pensionEmployerPercent}
            />
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            <PayrollDocumentsTab
              payrollId={payroll.id}
              status={payroll.status}
              documents={data.documents}
              canGenerate={canGeneratePdfs}
              pending={pdfPending}
              onGenerate={() => void generatePdfs()}
            />
          </TabsContent>

          <TabsContent value="atk" className="mt-4">
            <PayrollAtkTab
              status={payroll.status}
              exports={data.atkExports}
              canGenerate={canGenerateAtk}
              pending={atkPending}
              onGenerate={() =>
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
              onArchive={(exportId) =>
                void exec("Eksporti u arkivua.", archivePayrollAtkExportAction(exportId))
              }
            />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <PayrollHistoryTab timeline={data.timeline} auditTrail={data.auditTrail} />
          </TabsContent>

          <TabsContent value="corrections" className="mt-4">
            <PayrollCorrectionsPanel
              payrollId={payroll.id}
              status={payroll.status}
              allowCreate={payroll.status === "LOCKED" || payroll.status === "ARCHIVED"}
              corrections={data.corrections}
              employeeOptions={correctionEmployees}
            />
          </TabsContent>
        </Tabs>

        {workflowActions.length > 0 ? (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e2e8f0] bg-white/95 p-3 backdrop-blur lg:hidden">
            <div className="mx-auto flex max-w-lg flex-wrap gap-2">
              {workflowActions.map((a) => (
                <Button
                  key={a.id}
                  size="sm"
                  variant={a.variant}
                  className="flex-1"
                  type="button"
                  onClick={a.run}
                  disabled={a.disabled}
                >
                  {a.shortLabel}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
