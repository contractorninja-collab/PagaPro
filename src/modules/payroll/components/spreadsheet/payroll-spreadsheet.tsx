"use client";

import { useEffect, useState } from "react";
import type { PayrollPeriodStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PayrollDetailDto } from "@/modules/payroll/services/payroll-period-service";
import { updatePayrollEntryAction } from "@/modules/payroll/actions/payroll-actions";
import {
  combinedLeaveHoursTotal,
  paidLeaveFromCombinedTotal,
} from "@/modules/payroll/helpers/leave-hours-cell";
import { cn } from "@/lib/utils";

type Entry = PayrollDetailDto["entries"][number];

function sumPlainEuro(vals: string[]): string {
  let t = 0;
  for (const v of vals) {
    const n = Number(v.replace(",", "."));
    if (!Number.isNaN(n)) t += n;
  }
  return t.toFixed(2);
}

function formatHourlyRateDisplay(raw: string): string {
  const n = Number(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(n)) return raw;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(n);
}

function trustHeaderLabel(title: string, rateDecimalStr?: string): string {
  if (rateDecimalStr == null || String(rateDecimalStr).trim() === "") return title;
  const n = Number(String(rateDecimalStr).replace(",", "."));
  if (!Number.isFinite(n)) return title;
  const pct = n * 100;
  const dec = pct % 1 === 0 ? 0 : 2;
  return `${title} (${pct.toFixed(dec)}%)`;
}

function parseNum(s: string): number | null {
  const n = Number(String(s).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function CellInput(props: {
  disabled: boolean;
  entryId: string;
  field: keyof Pick<
    Entry,
    | "actualRegularHours"
    | "paidLeaveHours"
    | "overtimeHours"
    | "weekendHours"
    | "holidayHours"
    | "nightHours"
    | "bonuses"
    | "salaryAdvanceDeduction"
  >;
  payrollId: string;
  value: string;
  /**
   * Amber-highlight baseline: when set (e.g. expected regular hours), the cell turns amber
   * if its value differs from the baseline; when omitted, any non-zero value is amber.
   */
  baseline?: string | null;
}) {
  const router = useRouter();
  const [val, setVal] = useState(props.value);

  // Sync back to the authoritative server value after router.refresh().
  useEffect(() => {
    setVal(props.value);
  }, [props.value]);

  const n = parseNum(val);
  const dirty = val.trim() !== props.value.trim();
  let amber: boolean;
  if (props.baseline !== undefined) {
    const b = props.baseline == null ? null : parseNum(props.baseline);
    amber = dirty || (b != null && n != null && n !== b);
  } else {
    amber = dirty || (n != null && n !== 0);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={props.disabled}
      value={val}
      onChange={(ev) => setVal(ev.target.value)}
      className={cn(
        "box-border h-[26px] w-full min-w-[52px] rounded-md border px-2 text-right text-xs leading-tight outline-none transition-colors [font-variant-numeric:tabular-nums]",
        amber
          ? "border-[#fde68a] bg-[#fffbeb] text-[#b45309]"
          : "border-[#e2e8f0] bg-[#f8fafc] text-[#475569]",
        "focus:border-brand-blue focus:bg-white disabled:cursor-not-allowed disabled:opacity-60",
      )}
      onBlur={async (ev) => {
        const v = ev.target.value.trim();
        if (v === props.value) return;
        const r = await updatePayrollEntryAction({
          payrollId: props.payrollId,
          entryId: props.entryId,
          [props.field]: v,
        });
        if (!r.ok) {
          toast.error(r.error);
          setVal(props.value);
          return;
        }
        toast.success("U ruajt.");
        queueMicrotask(() => {
          void router.refresh();
        });
      }}
    />
  );
}

/**
 * Kolona e kombinuar "Pushim Orë": total = vjetor/paguar + mjekësor + pa pagesë.
 * Orët mjekësore/pa pagesë derivohen nga pushimet e miratuara (fikse këtu) —
 * redaktimi i totalit ndryshon vetëm pjesën e paguar (total − mjekësor − pa pagesë).
 */
function LeaveHoursCell(props: {
  disabled: boolean;
  entryId: string;
  payrollId: string;
  paid: string;
  sick: string;
  unpaid: string;
}) {
  const router = useRouter();
  const total = combinedLeaveHoursTotal(props.paid, props.sick, props.unpaid);
  const [val, setVal] = useState(total);

  // Rikthe vlerën autoritative pas router.refresh().
  useEffect(() => {
    setVal(total);
  }, [total]);

  const n = parseNum(val);
  const dirty = val.trim() !== total.trim();
  const amber = dirty || (n != null && n !== 0);

  const sickN = parseNum(props.sick) ?? 0;
  const unpaidN = parseNum(props.unpaid) ?? 0;
  const hasFixed = sickN > 0 || unpaidN > 0;
  const breakdownTitle = `Vjetor/paguar ${props.paid} · Mjekësor ${props.sick} · Pa pagesë ${props.unpaid} — redaktimi ndryshon vetëm pjesën e paguar`;

  return (
    <div className="min-w-[52px]">
      <input
        type="text"
        inputMode="decimal"
        disabled={props.disabled}
        value={val}
        title={breakdownTitle}
        aria-label={`Orët e pushimit gjithsej — ${breakdownTitle}`}
        onChange={(ev) => setVal(ev.target.value)}
        className={cn(
          "box-border h-[26px] w-full min-w-[52px] rounded-md border px-2 text-right text-xs leading-tight outline-none transition-colors [font-variant-numeric:tabular-nums]",
          amber
            ? "border-[#fde68a] bg-[#fffbeb] text-[#b45309]"
            : "border-[#e2e8f0] bg-[#f8fafc] text-[#475569]",
          "focus:border-brand-blue focus:bg-white disabled:cursor-not-allowed disabled:opacity-60",
        )}
        onBlur={async (ev) => {
          const v = ev.target.value.trim();
          if (v === total) return;
          const mapped = paidLeaveFromCombinedTotal(v, props.sick, props.unpaid);
          if (!mapped.ok) {
            toast.error(
              `Totali s'mund të jetë nën ${mapped.minimum} orë — orët mjekësore/pa pagesë vijnë nga pushimet e miratuara.`,
            );
            setVal(total);
            return;
          }
          const r = await updatePayrollEntryAction({
            payrollId: props.payrollId,
            entryId: props.entryId,
            paidLeaveHours: mapped.paid,
          });
          if (!r.ok) {
            toast.error(r.error);
            setVal(total);
            return;
          }
          toast.success("U ruajt.");
          queueMicrotask(() => {
            void router.refresh();
          });
        }}
      />
      {hasFixed ? (
        <p className="mt-0.5 whitespace-nowrap text-right text-[9px] leading-tight text-[#94a3b8]" aria-hidden>
          {sickN > 0 ? `M ${props.sick}` : null}
          {sickN > 0 && unpaidN > 0 ? " · " : null}
          {unpaidN > 0 ? `PP ${props.unpaid}` : null}
        </p>
      ) : null}
    </div>
  );
}

export function PayrollSpreadsheet(props: {
  payrollId: string;
  status: PayrollPeriodStatus;
  entries: Entry[];
  footerTotals: PayrollDetailDto["totals"];
  /** Payroll settings decimal rate string (e.g. "0.05") for Trust 1 header */
  pensionEmployeePercent?: string;
  /** Payroll settings decimal rate string for Trust 2 header */
  pensionEmployerPercent?: string;
}) {
  const editable = props.status === "DRAFT";

  const footGross = sumPlainEuro(props.entries.map((e) => e.grossSalary));
  const footPenE = sumPlainEuro(props.entries.map((e) => e.pensionEmployee));
  const footTaxable = sumPlainEuro(props.entries.map((e) => e.taxableIncome));
  const footPit = sumPlainEuro(props.entries.map((e) => e.pitWithheld));
  const footNet = sumPlainEuro(props.entries.map((e) => e.netPay));
  const footPenEr = sumPlainEuro(props.entries.map((e) => e.pensionEmployer));

  const trust1Header = trustHeaderLabel("Trust 1", props.pensionEmployeePercent);
  const trust2Header = trustHeaderLabel("Trust 2", props.pensionEmployerPercent);

  const thNum =
    "min-w-[84px] w-auto whitespace-nowrap border-b border-[#e2e8f0] px-1.5 py-[9px] text-right text-[10.5px] font-semibold leading-tight text-[#64748b]";
  const tdNum =
    "min-w-[84px] w-auto whitespace-nowrap px-1.5 py-1.5 text-right text-xs text-[#64748b] [font-variant-numeric:tabular-nums]";
  const tdInput = "min-w-[84px] w-auto px-1 py-[5px] align-middle";
  const stickyShadow = "shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]";
  const footCell =
    "min-w-[84px] w-auto whitespace-nowrap px-1.5 py-[9px] text-right text-xs [font-variant-numeric:tabular-nums]";

  return (
    <div className="space-y-2.5">
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="relative max-h-[min(70vh,720px)] overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[1560px] border-collapse text-xs">
              <thead className="sticky top-0 z-30 bg-[#f1f5f9]">
                <tr>
                  <th
                    className={cn(
                      "sticky left-0 z-40 min-w-[180px] max-w-[220px] border-b border-[#e2e8f0] bg-[#f1f5f9] px-2.5 py-[9px] text-left text-[10.5px] font-semibold leading-tight text-[#64748b]",
                      stickyShadow,
                    )}
                  >
                    Punonjësi
                  </th>
                  <th className={thNum}>Orët Rreg.</th>
                  <th className={thNum}>Bruto</th>
                  <th className={thNum}>Çmimi/orë</th>
                  <th className={thNum}>{trust1Header}</th>
                  <th className={thNum}>{trust2Header}</th>
                  <th className={thNum}>Tatimi në pagë</th>
                  <th className={thNum}>Neto</th>
                  <th className={thNum}>Baza tat.</th>
                  <th className={thNum}>Pushim Orë</th>
                  <th className={thNum}>Orë Shtesë</th>
                  <th className={thNum}>Vikend</th>
                  <th className={thNum}>Festë</th>
                  <th className={thNum}>Natë</th>
                  <th className={thNum}>Bonus</th>
                  <th className={thNum}>Avans</th>
                </tr>
              </thead>
              <tbody>
                {props.entries.map((e) => (
                  <tr key={e.id} className="group border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
                    <td
                      className={cn(
                        "sticky left-0 z-20 min-w-[180px] max-w-[220px] bg-white px-2.5 py-2 align-middle transition-colors group-hover:bg-[#f8fafc]",
                        stickyShadow,
                      )}
                    >
                      <div className="truncate text-[12.5px] font-semibold leading-tight text-[#0f172a]">
                        {e.employeeName}
                      </div>
                      <div className="truncate text-[9.5px] font-normal leading-tight text-[#94a3b8]">{e.jobTitle}</div>
                    </td>
                    <td className={tdInput}>
                      <CellInput
                        disabled={!editable}
                        payrollId={props.payrollId}
                        entryId={e.id}
                        field="actualRegularHours"
                        value={e.actualRegularHours}
                        baseline={e.expectedRegularHours}
                      />
                    </td>
                    <td className={tdNum}>€{e.grossSalary}</td>
                    <td className={tdNum}>{formatHourlyRateDisplay(e.hourlyRate)}</td>
                    <td className={tdNum}>€{e.pensionEmployee}</td>
                    <td className={tdNum}>€{e.pensionEmployer}</td>
                    <td className={tdNum}>€{e.pitWithheld}</td>
                    <td className={cn(tdNum, "font-bold text-[#0f172a]")}>€{e.netPay}</td>
                    <td className={tdNum}>€{e.taxableIncome}</td>
                    <td className={tdInput}>
                      <LeaveHoursCell
                        disabled={!editable}
                        payrollId={props.payrollId}
                        entryId={e.id}
                        paid={e.paidLeaveHours}
                        sick={e.sickLeaveHours}
                        unpaid={e.unpaidLeaveHours}
                      />
                    </td>
                    <td className={tdInput}>
                      <CellInput disabled={!editable} payrollId={props.payrollId} entryId={e.id} field="overtimeHours" value={e.overtimeHours} />
                    </td>
                    <td className={tdInput}>
                      <CellInput disabled={!editable} payrollId={props.payrollId} entryId={e.id} field="weekendHours" value={e.weekendHours} />
                    </td>
                    <td className={tdInput}>
                      <CellInput disabled={!editable} payrollId={props.payrollId} entryId={e.id} field="holidayHours" value={e.holidayHours} />
                    </td>
                    <td className={tdInput}>
                      <CellInput disabled={!editable} payrollId={props.payrollId} entryId={e.id} field="nightHours" value={e.nightHours} />
                    </td>
                    <td className={tdInput}>
                      <CellInput disabled={!editable} payrollId={props.payrollId} entryId={e.id} field="bonuses" value={e.bonuses} />
                    </td>
                    <td className={tdInput}>
                      <CellInput disabled={!editable} payrollId={props.payrollId} entryId={e.id} field="salaryAdvanceDeduction" value={e.salaryAdvanceDeduction} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 z-30 bg-[#f1f5f9]">
                <tr className="border-t border-[#e2e8f0]">
                  <td
                    className={cn(
                      "sticky left-0 z-40 min-w-[180px] max-w-[220px] bg-[#f1f5f9] px-2.5 py-[9px] text-xs font-bold text-[#0f172a]",
                      stickyShadow,
                    )}
                  >
                    Totalet ({props.entries.length} rreshta)
                  </td>
                  <td className={footCell} />
                  <td className={cn(footCell, "font-bold text-[#0f172a]")}>€{footGross}</td>
                  <td className={footCell} />
                  <td className={cn(footCell, "font-bold text-[#0f172a]")}>€{footPenE}</td>
                  <td className={cn(footCell, "font-bold text-[#0f172a]")}>€{footPenEr}</td>
                  <td className={cn(footCell, "font-bold text-[#0f172a]")}>€{footPit}</td>
                  <td className={cn(footCell, "font-extrabold text-[#1d4ed8]")}>€{footNet}</td>
                  <td className={cn(footCell, "font-bold text-[#0f172a]")}>€{footTaxable}</td>
                  <td className={footCell} colSpan={7} />
                </tr>
                <tr className="border-t border-[#e2e8f0]">
                  <td
                    className={cn(
                      "sticky left-0 z-40 min-w-[180px] max-w-[220px] bg-[#f1f5f9] px-2.5 py-[7px] text-[11px] font-medium text-[#64748b]",
                      stickyShadow,
                    )}
                  >
                    Totalet (server)
                  </td>
                  <td className={footCell} />
                  <td className={cn(footCell, "text-[11px] text-[#475569]")}>€{props.footerTotals.gross}</td>
                  <td className={footCell} />
                  <td className={cn(footCell, "text-[11px] text-[#475569]")}>€{props.footerTotals.pensionEmployee}</td>
                  <td className={cn(footCell, "text-[11px] text-[#475569]")}>€{props.footerTotals.pensionEmployer}</td>
                  <td className={cn(footCell, "text-[11px] text-[#475569]")}>€{props.footerTotals.pitWithheld}</td>
                  <td className={cn(footCell, "text-[11px] font-semibold text-[#1d4ed8]")}>€{props.footerTotals.net}</td>
                  <td className={cn(footCell, "text-[11px] text-[#475569]")}>€{props.footerTotals.taxableIncome}</td>
                  <td className={footCell} colSpan={7} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        <p className="mt-2.5 px-0.5 text-[11.5px] text-[#94a3b8]">
          {props.entries.length} rreshta · kontraktorët përjashtohen automatikisht · fushat me kufi të verdhë kanë vlera
          jo-zero ose të ndryshuara · redaktimi aktiv vetëm në DRAFT · Pushim Orë = vjetor/paguar + mjekësor (M) + pa
          pagesë (PP), ditë pune × orë ditore nga pushimet e miratuara — redaktimi ndryshon vetëm pjesën e paguar ·
          rreshtat me orë të redaktuara manualisht nuk sinkronizohen automatikisht me pushimet e reja.
        </p>
      </div>

      <div className="space-y-2 md:hidden">
        {props.entries.map((e) => (
          <div key={e.id} className="rounded-xl border border-[#e2e8f0] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
            <div>
              <p className="text-sm font-semibold leading-tight text-[#0f172a]">{e.employeeName}</p>
              <p className="text-[11px] text-[#94a3b8]">{e.jobTitle}</p>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs [font-variant-numeric:tabular-nums]">
              <dt className="text-[#64748b]">Bruto</dt>
              <dd className="text-right font-semibold text-[#0f172a]">€{e.grossSalary}</dd>
              <dt className="text-[#64748b]">Trust 1</dt>
              <dd className="text-right text-[#334155]">€{e.pensionEmployee}</dd>
              <dt className="text-[#64748b]">Baza tatimore</dt>
              <dd className="text-right text-[#334155]">€{e.taxableIncome}</dd>
              <dt className="text-[#64748b]">Tatimi</dt>
              <dd className="text-right text-[#334155]">€{e.pitWithheld}</dd>
              <dt className="text-[#64748b]">Neto</dt>
              <dd className="text-right font-bold text-[#1d4ed8]">€{e.netPay}</dd>
              <dt className="text-[#64748b]">Trust 2</dt>
              <dd className="text-right text-[#334155]">€{e.pensionEmployer}</dd>
            </dl>
            {editable ? (
              <div className="mt-2 grid gap-1.5 border-t border-[#eef2f7] pt-2">
                <div className="grid grid-cols-[1fr_minmax(4rem,5.5rem)] items-center gap-x-2 gap-y-1 text-[11px]">
                  <span className="leading-tight text-[#64748b]">Orët e Rregullta</span>
                  <CellInput
                    payrollId={props.payrollId}
                    entryId={e.id}
                    disabled={false}
                    field="actualRegularHours"
                    value={e.actualRegularHours}
                    baseline={e.expectedRegularHours}
                  />
                </div>
                <div className="grid grid-cols-[1fr_minmax(4rem,5.5rem)] items-center gap-x-2 gap-y-1 text-[11px]">
                  <span className="leading-tight text-[#64748b]">Pushim Orë</span>
                  <LeaveHoursCell
                    payrollId={props.payrollId}
                    entryId={e.id}
                    disabled={false}
                    paid={e.paidLeaveHours}
                    sick={e.sickLeaveHours}
                    unpaid={e.unpaidLeaveHours}
                  />
                </div>
                <div className="grid grid-cols-[1fr_minmax(4rem,5.5rem)] items-center gap-x-2 gap-y-1 text-[11px]">
                  <span className="leading-tight text-[#64748b]">Orë Shtesë</span>
                  <CellInput payrollId={props.payrollId} entryId={e.id} disabled={false} field="overtimeHours" value={e.overtimeHours} />
                </div>
                <div className="grid grid-cols-[1fr_minmax(4rem,5.5rem)] items-center gap-x-2 gap-y-1 text-[11px]">
                  <span className="leading-tight text-[#64748b]">Bonus</span>
                  <CellInput payrollId={props.payrollId} entryId={e.id} disabled={false} field="bonuses" value={e.bonuses} />
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
