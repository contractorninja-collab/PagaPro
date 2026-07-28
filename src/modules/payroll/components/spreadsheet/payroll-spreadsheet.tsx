"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PayrollPeriodStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
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

/**
 * Cell state drives the border colour, and each state means exactly one thing:
 *
 *   amber    — the value differs from what the engine expected, i.e. somebody
 *              overrode it. A non-zero number is *not* amber; it is already
 *              visible, and colouring it too made amber mean two things at once.
 *   blue     — in flight
 *   emerald  — just saved, fading back to neutral
 */
type CellState = "idle" | "saving" | "saved";

const CELL_BASE =
  "box-border h-[26px] w-full min-w-[52px] rounded-md border px-2 text-right text-xs leading-tight outline-none transition-colors [font-variant-numeric:tabular-nums] focus:border-brand-blue focus:bg-white disabled:cursor-not-allowed disabled:opacity-60";

function cellTone(state: CellState, deviates: boolean): string {
  if (state === "saving") return "border-brand-blue bg-white text-[#334155]";
  if (state === "saved") return "border-[#6ee7b7] bg-[#ecfdf5] text-[#047857]";
  if (deviates) return "border-[#fde68a] bg-[#fffbeb] text-[#b45309]";
  return "border-[#e2e8f0] bg-[#f8fafc] text-[#475569]";
}

/** Holds the "just saved" tint briefly, then clears it. */
function useSavedPulse(): [CellState, (s: CellState) => void] {
  const [state, setState] = useState<CellState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = useCallback((next: CellState) => {
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    if (next === "saved") timer.current = setTimeout(() => setState("idle"), 1400);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return [state, set];
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
  /** When set, the cell turns amber if its value drifts from this expectation. */
  baseline?: string | null;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [val, setVal] = useState(props.value);
  const [state, setState] = useSavedPulse();

  // Sync back to the authoritative server value after router.refresh().
  useEffect(() => {
    setVal(props.value);
  }, [props.value]);

  const n = parseNum(val);
  const b = props.baseline == null ? null : parseNum(props.baseline);
  const deviates = b != null && n != null && n !== b;

  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={props.disabled}
      value={val}
      title={
        deviates && props.baseline != null
          ? `Ndryshuar nga pritshmëria (${props.baseline})`
          : undefined
      }
      onChange={(ev) => setVal(ev.target.value)}
      className={cn(CELL_BASE, cellTone(state, deviates))}
      onBlur={async (ev) => {
        const v = ev.target.value.trim();
        if (v === props.value) return;
        setState("saving");
        const r = await updatePayrollEntryAction({
          payrollId: props.payrollId,
          entryId: props.entryId,
          [props.field]: v,
        });
        if (!r.ok) {
          // Failures still shout — only the success toasts were noise.
          toast.error(r.error);
          setVal(props.value);
          setState("idle");
          return;
        }
        setState("saved");
        props.onSaved?.();
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
  onSaved?: () => void;
}) {
  const router = useRouter();
  const total = combinedLeaveHoursTotal(props.paid, props.sick, props.unpaid);
  const [val, setVal] = useState(total);
  const [state, setState] = useSavedPulse();

  // Rikthe vlerën autoritative pas router.refresh().
  useEffect(() => {
    setVal(total);
  }, [total]);

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
        // Leave has no engine baseline to drift from, so it is never amber.
        className={cn(CELL_BASE, cellTone(state, false))}
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
          setState("saving");
          const r = await updatePayrollEntryAction({
            payrollId: props.payrollId,
            entryId: props.entryId,
            paidLeaveHours: mapped.paid,
          });
          if (!r.ok) {
            toast.error(r.error);
            setVal(total);
            setState("idle");
            return;
          }
          setState("saved");
          props.onSaved?.();
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

/** The eight editable hour/amount fields, in the order they are entered. */
const INPUT_COLUMNS: Array<{
  key: string;
  label: string;
  field?: CellInputField;
  leave?: true;
}> = [
  { key: "regular", label: "Orët Rreg.", field: "actualRegularHours" },
  { key: "leave", label: "Pushim Orë", leave: true },
  { key: "overtime", label: "Orë Shtesë", field: "overtimeHours" },
  { key: "weekend", label: "Vikend", field: "weekendHours" },
  { key: "holiday", label: "Festë", field: "holidayHours" },
  { key: "night", label: "Natë", field: "nightHours" },
  { key: "bonus", label: "Bonus", field: "bonuses" },
  { key: "advance", label: "Avans", field: "salaryAdvanceDeduction" },
];

type CellInputField = Parameters<typeof CellInput>[0]["field"];

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
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const markSaved = useCallback(() => setSavedAt(new Date()), []);

  const footGross = sumPlainEuro(props.entries.map((e) => e.grossSalary));
  const footPenE = sumPlainEuro(props.entries.map((e) => e.pensionEmployee));
  const footTaxable = sumPlainEuro(props.entries.map((e) => e.taxableIncome));
  const footPit = sumPlainEuro(props.entries.map((e) => e.pitWithheld));
  const footNet = sumPlainEuro(props.entries.map((e) => e.netPay));
  const footPenEr = sumPlainEuro(props.entries.map((e) => e.pensionEmployer));

  /**
   * The server totals used to be printed as a second footer row, which made the
   * user the diff tool for an internal reconciliation. They should always agree;
   * when they do not, that is a bug and deserves an alarm, not a quiet row.
   */
  const mismatches = (
    [
      ["Bruto", footGross, props.footerTotals.gross],
      ["Trust 1", footPenE, props.footerTotals.pensionEmployee],
      ["Trust 2", footPenEr, props.footerTotals.pensionEmployer],
      ["Tatimi", footPit, props.footerTotals.pitWithheld],
      ["Neto", footNet, props.footerTotals.net],
      ["Baza tat.", footTaxable, props.footerTotals.taxableIncome],
    ] as const
  ).filter(([, client, server]) => {
    const a = parseNum(client);
    const b = parseNum(server);
    return a != null && b != null && Math.abs(a - b) >= 0.01;
  });

  const trust1Header = trustHeaderLabel("Trust 1", props.pensionEmployeePercent);
  const trust2Header = trustHeaderLabel("Trust 2", props.pensionEmployerPercent);

  const thNum =
    "min-w-[84px] w-auto whitespace-nowrap border-b border-[#e2e8f0] px-1.5 py-[7px] text-right text-[10.5px] font-semibold leading-tight text-[#64748b]";
  const thBand =
    "border-b border-[#e2e8f0] px-1.5 py-[5px] text-left text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]";
  const tdNum =
    "min-w-[84px] w-auto whitespace-nowrap px-1.5 py-1.5 text-right text-xs text-[#64748b] [font-variant-numeric:tabular-nums]";
  const tdInput = "min-w-[84px] w-auto px-1 py-[5px] align-middle";
  const stickyShadow = "shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]";
  const stickyShadowRight = "shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.12)]";
  const footCell =
    "min-w-[84px] w-auto whitespace-nowrap px-1.5 py-[9px] text-right text-xs [font-variant-numeric:tabular-nums]";

  if (props.entries.length === 0) {
    return (
      <div className="rounded-xl border border-[#e2e8f0] bg-white px-6 py-14 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
        <p className="text-sm font-semibold text-[#0f172a]">Nuk ka rreshta në këtë payroll.</p>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-[#64748b]">
          {editable
            ? "Shtypni „Llogarit Pagat” për t'i gjeneruar rreshtat nga lista e punonjësve aktivë."
            : "Ky payroll u mbyll pa rreshta. Rreshtat gjenerohen vetëm kur payroll-i është në DRAFT."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {mismatches.length > 0 ? (
        <div className="flex gap-3 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#dc2626]" aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className="text-[13px] font-semibold text-[#7f1d1d]">
              Totalet e serverit nuk përputhen me rreshtat
            </p>
            <p className="text-xs text-[#991b1b]">
              {mismatches.map(([label, client, server]) => `${label}: ${client} ≠ ${server}`).join(" · ")}
              {" — "}rifreskoni faqen; nëse mbetet, njoftoni mbështetjen para se ta miratoni.
            </p>
          </div>
        </div>
      ) : null}

      <div className="hidden md:block">
        <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="relative max-h-[min(70vh,720px)] overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[1560px] border-collapse text-xs">
              {/* Two header rows: the band names what a group of columns is for, so
                  it is obvious which side you type into and which side is computed. */}
              <thead className="sticky top-0 z-30 bg-[#f1f5f9]">
                <tr>
                  <th
                    rowSpan={2}
                    className={cn(
                      "sticky left-0 z-40 min-w-[180px] max-w-[220px] border-b border-[#e2e8f0] bg-[#f1f5f9] px-2.5 py-[9px] text-left text-[10.5px] font-semibold leading-tight text-[#64748b]",
                      stickyShadow,
                    )}
                  >
                    Punonjësi
                  </th>
                  <th className={thBand} colSpan={INPUT_COLUMNS.length}>
                    Orët &amp; shtesat {editable ? "· redaktueshme" : "· vetëm lexim"}
                  </th>
                  <th className={cn(thBand, "border-l border-[#e2e8f0]")} colSpan={6}>
                    Llogaritja · nga motori
                  </th>
                  <th
                    rowSpan={2}
                    className={cn(
                      "sticky right-0 z-40 min-w-[100px] border-b border-l border-[#e2e8f0] bg-[#f1f5f9] px-1.5 py-[9px] text-right text-[10.5px] font-bold leading-tight text-[#0f172a]",
                      stickyShadowRight,
                    )}
                  >
                    Neto
                  </th>
                </tr>
                <tr>
                  {INPUT_COLUMNS.map((c) => (
                    <th key={c.key} className={thNum}>
                      {c.label}
                    </th>
                  ))}
                  <th className={cn(thNum, "border-l border-[#e2e8f0]")}>Bruto</th>
                  <th className={thNum}>Çmimi/orë</th>
                  <th className={thNum}>{trust1Header}</th>
                  <th className={thNum}>{trust2Header}</th>
                  <th className={thNum}>Tatimi në pagë</th>
                  <th className={thNum}>Baza tat.</th>
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

                    {/* Inputs — all eight together, so a row is filled without
                        crossing a wall of read-only numbers. */}
                    {INPUT_COLUMNS.map((c) => (
                      <td key={c.key} className={tdInput}>
                        {c.leave ? (
                          <LeaveHoursCell
                            disabled={!editable}
                            payrollId={props.payrollId}
                            entryId={e.id}
                            paid={e.paidLeaveHours}
                            sick={e.sickLeaveHours}
                            unpaid={e.unpaidLeaveHours}
                            onSaved={markSaved}
                          />
                        ) : (
                          <CellInput
                            disabled={!editable}
                            payrollId={props.payrollId}
                            entryId={e.id}
                            field={c.field!}
                            value={String(e[c.field as keyof Entry] ?? "")}
                            baseline={c.field === "actualRegularHours" ? e.expectedRegularHours : undefined}
                            onSaved={markSaved}
                          />
                        )}
                      </td>
                    ))}

                    {/* Derived */}
                    <td className={cn(tdNum, "border-l border-[#eef2f7]")}>€{e.grossSalary}</td>
                    <td className={tdNum}>{formatHourlyRateDisplay(e.hourlyRate)}</td>
                    <td className={tdNum}>€{e.pensionEmployee}</td>
                    <td className={tdNum}>€{e.pensionEmployer}</td>
                    <td className={tdNum}>€{e.pitWithheld}</td>
                    <td className={tdNum}>€{e.taxableIncome}</td>

                    <td
                      className={cn(
                        "sticky right-0 z-20 min-w-[100px] whitespace-nowrap border-l border-[#eef2f7] bg-white px-1.5 py-1.5 text-right text-xs font-bold text-[#0f172a] transition-colors [font-variant-numeric:tabular-nums] group-hover:bg-[#f8fafc]",
                        stickyShadowRight,
                      )}
                    >
                      €{e.netPay}
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
                  <td className={footCell} colSpan={INPUT_COLUMNS.length} />
                  <td className={cn(footCell, "border-l border-[#e2e8f0] font-bold text-[#0f172a]")}>€{footGross}</td>
                  <td className={footCell} />
                  <td className={cn(footCell, "font-bold text-[#0f172a]")}>€{footPenE}</td>
                  <td className={cn(footCell, "font-bold text-[#0f172a]")}>€{footPenEr}</td>
                  <td className={cn(footCell, "font-bold text-[#0f172a]")}>€{footPit}</td>
                  <td className={cn(footCell, "font-bold text-[#0f172a]")}>€{footTaxable}</td>
                  <td
                    className={cn(
                      "sticky right-0 z-40 min-w-[100px] whitespace-nowrap border-l border-[#e2e8f0] bg-[#f1f5f9] px-1.5 py-[9px] text-right text-xs font-extrabold text-[#1d4ed8] [font-variant-numeric:tabular-nums]",
                      stickyShadowRight,
                    )}
                  >
                    €{footNet}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 px-0.5 text-[11.5px] text-[#94a3b8]">
          <span>{props.entries.length} rreshta · kontraktorët përjashtohen</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-[3px] border border-[#fde68a] bg-[#fffbeb]" aria-hidden />
            ndryshuar nga pritshmëria
          </span>
          {!editable ? <span>redaktimi aktiv vetëm në DRAFT</span> : null}
          {savedAt ? (
            <span className="text-[#047857]">
              Ruajtur {savedAt.toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : null}
          <details className="ml-auto">
            <summary className="cursor-pointer select-none text-[#64748b] hover:text-[#334155]">
              Si llogariten orët?
            </summary>
            <p className="mt-1.5 max-w-2xl text-[11.5px] leading-relaxed">
              Pushim Orë = vjetor/paguar + mjekësor (M) + pa pagesë (PP), ditë pune × orë ditore nga pushimet e
              miratuara — redaktimi ndryshon vetëm pjesën e paguar. Kërkesat e reja llogariten 8 orë për çdo ditë
              Hënë–Premte, duke përfshirë festat. Miratimi në PUSHIMET rifreskon automatikisht orët e
              rregullta/pushimit në payroll-et DRAFT dhe ruan inputet e tjera manuale.
            </p>
          </details>
        </div>
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
              // All eight inputs — the four that used to be desktop-only affect pay,
              // and dropping them silently meant a phone could not finish the job.
              <div className="mt-2 grid gap-1.5 border-t border-[#eef2f7] pt-2">
                {INPUT_COLUMNS.map((c) => (
                  <div
                    key={c.key}
                    className="grid grid-cols-[1fr_minmax(4rem,5.5rem)] items-center gap-x-2 gap-y-1 text-[11px]"
                  >
                    <span className="leading-tight text-[#64748b]">{c.label}</span>
                    {c.leave ? (
                      <LeaveHoursCell
                        payrollId={props.payrollId}
                        entryId={e.id}
                        disabled={false}
                        paid={e.paidLeaveHours}
                        sick={e.sickLeaveHours}
                        unpaid={e.unpaidLeaveHours}
                        onSaved={markSaved}
                      />
                    ) : (
                      <CellInput
                        payrollId={props.payrollId}
                        entryId={e.id}
                        disabled={false}
                        field={c.field!}
                        value={String(e[c.field as keyof Entry] ?? "")}
                        baseline={c.field === "actualRegularHours" ? e.expectedRegularHours : undefined}
                        onSaved={markSaved}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
