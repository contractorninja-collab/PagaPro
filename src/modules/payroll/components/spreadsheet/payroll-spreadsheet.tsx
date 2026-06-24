"use client";

import type { PayrollPeriodStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import type { PayrollDetailDto } from "@/modules/payroll/services/payroll-period-service";
import { updatePayrollEntryAction } from "@/modules/payroll/actions/payroll-actions";

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
}) {
  const router = useRouter();
  return (
    <Input
      key={`${props.entryId}-${props.field}-${props.value}`}
      disabled={props.disabled}
      defaultValue={props.value}
      className="box-border h-7 w-full min-w-[72px] px-1.5 text-right text-xs tabular-nums leading-tight"
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
          ev.target.value = props.value;
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
    "min-w-[88px] w-auto border-b border-border px-1.5 py-1 text-right text-xs font-medium leading-tight text-muted-foreground";

  return (
    <div className="space-y-3">
      <div className="hidden md:block">
        <div className="relative max-h-[min(70vh,720px)] overflow-x-auto overflow-y-auto rounded-lg border border-border">
          <table className="w-max min-w-full table-auto border-collapse text-xs">
            <thead className="sticky top-0 z-30 bg-muted/95 backdrop-blur">
              <tr>
                <th className="sticky left-0 z-40 min-w-[152px] max-w-[190px] border-b border-r border-border bg-muted/95 px-2 py-1.5 text-left text-xs font-medium leading-tight shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">
                  Punonjësi
                </th>
                <th className={thNum} style={{ textAlign: "right" }}>
                  Orët e Rregullta
                </th>
                <th className={thNum}>Bruto</th>
                <th className={thNum}>Cmimi/orë</th>
                <th className={thNum}>{trust1Header}</th>
                <th className={thNum}>{trust2Header}</th>
                <th className={thNum}>Tatimi në pagë</th>
                <th className={thNum}>Neto</th>
                <th className={thNum}>Baza tat.</th>
                <th className={thNum}>Pushim Orë</th>
                <th className={thNum} style={{ textAlign: "right" }}>
                  Orë Shtesë
                </th>
                <th className={thNum}>Vikend</th>
                <th className={thNum}>Festë</th>
                <th className={thNum}>Natë</th>
                <th className={thNum}>Bonus</th>
                <th className={thNum}>Avans</th>
              </tr>
            </thead>
            <tbody>
              {props.entries.map((e) => (
                <tr key={e.id} className="border-b border-border/80 hover:bg-muted/25">
                  <td className="sticky left-0 z-20 min-w-[152px] max-w-[190px] border-r border-border bg-background px-2 py-0.5 align-middle text-xs font-medium shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]">
                    <div className="truncate leading-tight">{e.employeeName}</div>
                    <div className="truncate text-[9px] font-normal leading-tight text-muted-foreground">{e.jobTitle}</div>
                  </td>
                  <td className="min-w-[88px] w-auto px-0.5 py-0.5 align-middle">
                    <CellInput disabled={!editable} payrollId={props.payrollId} entryId={e.id} field="actualRegularHours" value={e.actualRegularHours} />
                  </td>
                  <td className="min-w-[88px] w-auto whitespace-nowrap px-1 py-1 text-right tabular-nums text-muted-foreground">
                    €{e.grossSalary}
                  </td>
                  <td className="min-w-[88px] w-auto whitespace-nowrap px-1 py-1 text-right tabular-nums text-muted-foreground">
                    {formatHourlyRateDisplay(e.hourlyRate)}
                  </td>
                  <td className="min-w-[88px] w-auto whitespace-nowrap px-1 py-1 text-right tabular-nums text-muted-foreground">
                    €{e.pensionEmployee}
                  </td>
                  <td className="min-w-[88px] w-auto whitespace-nowrap px-1 py-1 text-right tabular-nums text-muted-foreground">
                    €{e.pensionEmployer}
                  </td>
                  <td className="min-w-[88px] w-auto whitespace-nowrap px-1 py-1 text-right tabular-nums text-muted-foreground">
                    €{e.pitWithheld}
                  </td>
                  <td className="min-w-[88px] w-auto whitespace-nowrap px-1 py-1 text-right tabular-nums font-medium">
                    €{e.netPay}
                  </td>
                  <td className="min-w-[88px] w-auto whitespace-nowrap px-1 py-1 text-right tabular-nums text-muted-foreground">
                    €{e.taxableIncome}
                  </td>
                  <td className="min-w-[88px] w-auto px-0.5 py-0.5 align-middle">
                    <CellInput disabled={!editable} payrollId={props.payrollId} entryId={e.id} field="paidLeaveHours" value={e.paidLeaveHours} />
                  </td>
                  <td className="min-w-[88px] w-auto px-0.5 py-0.5 align-middle">
                    <CellInput disabled={!editable} payrollId={props.payrollId} entryId={e.id} field="overtimeHours" value={e.overtimeHours} />
                  </td>
                  <td className="min-w-[88px] w-auto px-0.5 py-0.5 align-middle">
                    <CellInput disabled={!editable} payrollId={props.payrollId} entryId={e.id} field="weekendHours" value={e.weekendHours} />
                  </td>
                  <td className="min-w-[88px] w-auto px-0.5 py-0.5 align-middle">
                    <CellInput disabled={!editable} payrollId={props.payrollId} entryId={e.id} field="holidayHours" value={e.holidayHours} />
                  </td>
                  <td className="min-w-[88px] w-auto px-0.5 py-0.5 align-middle">
                    <CellInput disabled={!editable} payrollId={props.payrollId} entryId={e.id} field="nightHours" value={e.nightHours} />
                  </td>
                  <td className="min-w-[88px] w-auto px-0.5 py-0.5 align-middle">
                    <CellInput disabled={!editable} payrollId={props.payrollId} entryId={e.id} field="bonuses" value={e.bonuses} />
                  </td>
                  <td className="min-w-[88px] w-auto px-0.5 py-0.5 align-middle">
                    <CellInput disabled={!editable} payrollId={props.payrollId} entryId={e.id} field="salaryAdvanceDeduction" value={e.salaryAdvanceDeduction} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-30 bg-muted/95 text-[11px] leading-tight backdrop-blur">
              <tr>
                <td className="sticky left-0 z-40 min-w-[152px] max-w-[190px] border-t border-r border-border bg-muted/95 px-2 py-1 font-semibold shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">
                  Totalet (rreshtat)
                </td>
                <td className="border-t border-border p-1" />
                <td className="min-w-[88px] w-auto whitespace-nowrap border-t border-border px-1 py-1 text-right tabular-nums font-semibold">
                  €{footGross}
                </td>
                <td className="border-t border-border p-1" />
                <td className="min-w-[88px] w-auto whitespace-nowrap border-t border-border px-1 py-1 text-right tabular-nums font-semibold">
                  €{footPenE}
                </td>
                <td className="min-w-[88px] w-auto whitespace-nowrap border-t border-border px-1 py-1 text-right tabular-nums font-semibold">
                  €{footPenEr}
                </td>
                <td className="min-w-[88px] w-auto whitespace-nowrap border-t border-border px-1 py-1 text-right tabular-nums font-semibold">
                  €{footPit}
                </td>
                <td className="min-w-[88px] w-auto whitespace-nowrap border-t border-border px-1 py-1 text-right tabular-nums font-semibold">
                  €{footNet}
                </td>
                <td className="min-w-[88px] w-auto whitespace-nowrap border-t border-border px-1 py-1 text-right tabular-nums font-semibold">
                  €{footTaxable}
                </td>
                <td className="border-t border-border p-1" colSpan={7} />
              </tr>
              <tr className="bg-muted/80">
                <td className="sticky left-0 z-40 min-w-[152px] max-w-[190px] border-r border-border bg-muted/80 px-2 py-1 font-medium shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">
                  Totalet (server)
                </td>
                <td className="p-1" />
                <td className="min-w-[88px] w-auto whitespace-nowrap px-1 py-1 text-right tabular-nums">€{props.footerTotals.gross}</td>
                <td className="p-1" />
                <td className="min-w-[88px] w-auto whitespace-nowrap px-1 py-1 text-right tabular-nums">
                  €{props.footerTotals.pensionEmployee}
                </td>
                <td className="min-w-[88px] w-auto whitespace-nowrap px-1 py-1 text-right tabular-nums">
                  €{props.footerTotals.pensionEmployer}
                </td>
                <td className="min-w-[88px] w-auto whitespace-nowrap px-1 py-1 text-right tabular-nums">€{props.footerTotals.pitWithheld}</td>
                <td className="min-w-[88px] w-auto whitespace-nowrap px-1 py-1 text-right tabular-nums">€{props.footerTotals.net}</td>
                <td className="min-w-[88px] w-auto whitespace-nowrap px-1 py-1 text-right tabular-nums">
                  €{props.footerTotals.taxableIncome}
                </td>
                <td className="p-1" colSpan={7} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="space-y-2 md:hidden">
        {props.entries.map((e) => (
          <div key={e.id} className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <div>
              <p className="text-sm font-semibold leading-tight">{e.employeeName}</p>
              <p className="text-[11px] text-muted-foreground">{e.jobTitle}</p>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs tabular-nums">
              <dt className="text-muted-foreground">Bruto</dt>
              <dd className="text-right font-semibold">€{e.grossSalary}</dd>
              <dt className="text-muted-foreground">Trust 1</dt>
              <dd className="text-right">€{e.pensionEmployee}</dd>
              <dt className="text-muted-foreground">Baza tatimore</dt>
              <dd className="text-right">€{e.taxableIncome}</dd>
              <dt className="text-muted-foreground">Tatimi</dt>
              <dd className="text-right">€{e.pitWithheld}</dd>
              <dt className="text-muted-foreground">Neto</dt>
              <dd className="text-right font-semibold">€{e.netPay}</dd>
              <dt className="text-muted-foreground">Trust 2</dt>
              <dd className="text-right">€{e.pensionEmployer}</dd>
            </dl>
            {editable ? (
              <div className="mt-2 grid gap-1.5 border-t border-border pt-2">
                <div className="grid grid-cols-[1fr_minmax(4rem,5.5rem)] items-center gap-x-2 gap-y-1 text-[11px]">
                  <span className="text-muted-foreground leading-tight">Orët e Rregullta</span>
                  <CellInput payrollId={props.payrollId} entryId={e.id} disabled={false} field="actualRegularHours" value={e.actualRegularHours} />
                </div>
                <div className="grid grid-cols-[1fr_minmax(4rem,5.5rem)] items-center gap-x-2 gap-y-1 text-[11px]">
                  <span className="text-muted-foreground leading-tight">Orë Shtesë</span>
                  <CellInput payrollId={props.payrollId} entryId={e.id} disabled={false} field="overtimeHours" value={e.overtimeHours} />
                </div>
                <div className="grid grid-cols-[1fr_minmax(4rem,5.5rem)] items-center gap-x-2 gap-y-1 text-[11px]">
                  <span className="text-muted-foreground leading-tight">Bonus</span>
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
