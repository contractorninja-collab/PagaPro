"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AppSubBar } from "@/components/layout/app-sub-bar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { PayrollActionResult } from "@/modules/payroll/actions/payroll-actions";
import {
  approvePayrollAction,
  archivePayrollAction,
  createPayrollDraftAction,
  generatePayrollPdfsAction,
  lockPayrollAction,
  payrollSelectionPreviewAction,
  regeneratePayrollAction,
  reviewPayrollAction,
} from "@/modules/payroll/actions/payroll-actions";
import { PayrollsTable, type PayrollListRow } from "@/modules/payroll/components/payrolls-table";
import { payrollMonthNameSq } from "@/modules/payroll/helpers/month-label";

async function toastPayrollAction(
  router: ReturnType<typeof useRouter>,
  messageOk: string,
  promise: Promise<PayrollActionResult>,
) {
  const r = await promise;
  if (!r.ok) {
    toast.error(r.error);
    return;
  }
  toast.success(messageOk);
  router.refresh();
}

export function PayrollsPageClient(props: { initialRows: PayrollListRow[]; initialYear: number }) {
  const router = useRouter();
  const [yearFilter, setYearFilter] = useState(props.initialYear);
  const [createOpen, setCreateOpen] = useState(false);
  const [createMonth, setCreateMonth] = useState(String(new Date().getMonth() + 1));
  const [createYear, setCreateYear] = useState(String(props.initialYear));
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [expectedDays, setExpectedDays] = useState<number | null>(null);
  const [expectedHours, setExpectedHours] = useState<string | null>(null);
  const [hoursPerDayPreview, setHoursPerDayPreview] = useState<string | null>(null);
  const [previewHolidays, setPreviewHolidays] = useState<string[]>([]);
  const [multiplierPreview, setMultiplierPreview] = useState<{
    overtime: string;
    weekend: string;
    holiday: string;
    night: string;
  } | null>(null);
  const [eligibleIds, setEligibleIds] = useState<string[]>([]);
  const [previewEmployees, setPreviewEmployees] = useState<
    Array<{
      id: string;
      firstName: string;
      lastName: string;
      personalId: string;
      employmentType: string;
      status: string;
      compensationBasis: string;
    }>
  >([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const rows = useMemo(
    () => props.initialRows.filter((r) => r.year === yearFilter),
    [props.initialRows, yearFilter],
  );

  const yearChoices = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1];
  }, []);

  useEffect(() => {
    if (!createOpen) return;
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    void (async () => {
      const r = await payrollSelectionPreviewAction({
        year: Number(createYear),
        month: Number(createMonth),
      });
      if (cancelled) return;
      setPreviewLoading(false);
      if (!r.ok || !r.data) {
        setPreviewError(r.ok ? "Gabim i papritur." : r.error);
        setEligibleIds([]);
        setPreviewEmployees([]);
        setSelectedIds(new Set());
        setExpectedDays(null);
        setExpectedHours(null);
        setHoursPerDayPreview(null);
        setPreviewHolidays([]);
        setMultiplierPreview(null);
        return;
      }
      setExpectedDays(r.data.expectedWorkingDays);
      setExpectedHours(r.data.expectedRegularHours);
      setHoursPerDayPreview(r.data.hoursPerWorkingDay);
      setPreviewHolidays(r.data.weekdayPublicHolidayDates);
      setMultiplierPreview(r.data.multiplierPreview);
      const ids = r.data.employees.map((e) => e.id);
      setEligibleIds(ids);
      setPreviewEmployees(r.data.employees);
      setSelectedIds(new Set(ids));
    })();
    return () => {
      cancelled = true;
    };
  }, [createOpen, createYear, createMonth]);

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllEligible() {
    setSelectedIds(new Set(eligibleIds));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  return (
    <>
      <AppSubBar
        eyebrow="Payroll"
        title="Pagat"
        description="Ekzekutim mujor — spreadsheet në detaj, vetëm DRAFT është i editueshëm; kontraktorët përjashtohen nga përzgjedhja."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="payroll-year" className="sr-only">
                Viti
              </Label>
              <select
                id="payroll-year"
                className="flex h-10 w-[110px] cursor-pointer rounded-[10px] border border-[#e2e8f0] bg-white px-3.5 text-[13.5px] font-semibold text-[#334155] outline-none transition-colors hover:bg-[#f8fafc] focus-visible:border-brand-blue"
                value={String(yearFilter)}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setYearFilter(Number(e.target.value))}
              >
                {yearChoices.map((y) => (
                  <option key={y} value={y}>
                    Viti {y}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              className="h-10 gap-[7px] rounded-[10px] bg-brand-blue px-[18px] text-[13.5px] font-semibold text-white hover:bg-[#1d4ed8]"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden />
              Krijo payroll
            </Button>
          </div>
        }
      />

      <div>
        <PayrollsTable
          rows={rows}
          onRegenerate={(id) => void toastPayrollAction(router, "Payroll u ripëllogarit.", regeneratePayrollAction(id))}
          onReview={(id) => void toastPayrollAction(router, "Statusi u përditësua.", reviewPayrollAction(id))}
          onApprove={(id) => void toastPayrollAction(router, "Payroll u miratua.", approvePayrollAction(id))}
          onLock={(id) => void toastPayrollAction(router, "Payroll u kyç dhe snapshot-i u ruajt.", lockPayrollAction(id))}
          onArchive={(id) => void toastPayrollAction(router, "Payroll u arkivua.", archivePayrollAction(id))}
          onPdf={(id) => void toastPayrollAction(router, "PDF-t u gjeneruan.", generatePayrollPdfsAction(id))}
        />
      </div>

      <Dialog open={createOpen} onOpenChange={(open) => setCreateOpen(open)}>
        <DialogContent className="flex max-h-[min(90vh,840px)] flex-col gap-0 overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Krijo payroll për muajin</DialogTitle>
          </DialogHeader>
          <div className="grid shrink-0 gap-4 border-b border-border py-2">
            <div className="grid gap-2">
              <Label htmlFor="create-month">Muaji</Label>
              <select
                id="create-month"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                value={createMonth}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCreateMonth(e.target.value)}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1)}>
                    {payrollMonthNameSq(i + 1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-year">Viti</Label>
              <select
                id="create-year"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                value={createYear}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCreateYear(e.target.value)}
              >
                {yearChoices.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-3">
            {previewLoading ? (
              <p className="text-sm text-muted-foreground">Duke ngarkuar përzgjedhjen…</p>
            ) : previewError ? (
              <p className="text-sm text-destructive">{previewError}</p>
            ) : (
              <>
                {expectedDays != null ? (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      Ditë pune (hën–pj, pa festa publike sipas kalendarit në PayrollSettings):{" "}
                      <strong className="text-foreground">{expectedDays}</strong> · Orë/ditë:{" "}
                      <strong className="text-foreground">{hoursPerDayPreview ?? "—"}</strong> · Orë të pritura:{" "}
                      <strong className="text-foreground">{expectedHours ?? "—"}</strong>
                    </p>
                    {multiplierPreview ? (
                      <p>
                        Multipliers nga databaza: OT ×{multiplierPreview.overtime} · Fundjavë ×{multiplierPreview.weekend}{" "}
                        · Festë ×{multiplierPreview.holiday} · Natë ×{multiplierPreview.night}
                      </p>
                    ) : null}
                    {previewHolidays.length > 0 ? (
                      <p className="text-[11px]">
                        Festa në ditë pune këtë muaj:{" "}
                        <span className="font-medium text-foreground">{previewHolidays.join(", ")}</span>
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={selectAllEligible}>
                    Zgjidh të gjithë
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={clearSelection}>
                    Pastro
                  </Button>
                  <span className="self-center text-xs text-muted-foreground">{selectedIds.size} të përzgjedhur</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Nëse nuk zgjidhni askë, të gjithë punonjësit e përshtatshëm përfshihen në gjenerim (sipas filtrave ACTIVE / ON_LEAVE).
                </p>
                <ul className="mt-3 max-h-[280px] space-y-2 overflow-y-auto rounded-md border border-border p-2">
                  {previewEmployees.length === 0 ? (
                    <li className="text-sm text-muted-foreground">Nuk ka punonjës të përshtatshëm për këtë muaj.</li>
                  ) : (
                    previewEmployees.map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center gap-2 rounded-sm px-1 py-0.5 text-sm hover:bg-muted/60">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input type="checkbox" checked={selectedIds.has(e.id)} onChange={() => toggleId(e.id)} />
                          <span className="font-medium">
                            {e.lastName}, {e.firstName}
                          </span>
                          <span className="text-xs text-muted-foreground">{e.personalId}</span>
                          <span className="text-[10px] uppercase text-muted-foreground">{e.compensationBasis}</span>
                        </label>
                      </li>
                    ))
                  )}
                </ul>
              </>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t border-border pt-3">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>
              Anulo
            </Button>
            <Button
              type="button"
              disabled={previewLoading || !!previewError}
              onClick={() =>
                void (async () => {
                  const payload = {
                    year: Number(createYear),
                    month: Number(createMonth),
                    employeeIds:
                      selectedIds.size === 0 || selectedIds.size === eligibleIds.length ? undefined : [...selectedIds],
                  };
                  const r = await createPayrollDraftAction(payload);
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success("Payroll u krijua.");
                  setCreateOpen(false);
                  router.push(`/pagat/${r.data?.id}`);
                })()
              }
            >
              Vazhdo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
