"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { ChartFrame, ChartSkeleton } from "@/components/patterns/chart-frame";
import type {
  LeavePressure,
  PayrollCostPoint,
  WorkforceShape,
  WorkforceSlice,
} from "@/modules/reports/services/report-analytics-service";

/**
 * `/raportet` — three questions, each answered with a headline number, a chart
 * and one line of plain Albanian.
 *
 * Recharts is loaded through `next/dynamic` with `ssr: false`, so it never
 * reaches the server bundle and the page still streams its numbers and text
 * before any chart code arrives. Every chart carries an `aria-label` stating
 * the finding plus a visible text fallback, because a chart nobody can read on
 * a phone is worse than the number it replaced.
 */

import { CARD } from "@/components/patterns/surface";
const MICRO = "text-[11px] font-bold uppercase tracking-[0.04em] text-[#94a3b8]";

const PayrollCostChart = dynamic(
  () => import("./charts/report-charts").then((m) => m.PayrollCostChart),
  { ssr: false, loading: () => <ChartSkeleton height={280} /> },
);
const DepartmentChart = dynamic(
  () => import("./charts/report-charts").then((m) => m.DepartmentChart),
  { ssr: false, loading: () => <ChartSkeleton height={200} /> },
);
const MovementChart = dynamic(() => import("./charts/report-charts").then((m) => m.MovementChart), {
  ssr: false,
  loading: () => <ChartSkeleton height={260} />,
});
const LeaveByMonthChart = dynamic(
  () => import("./charts/report-charts").then((m) => m.LeaveByMonthChart),
  { ssr: false, loading: () => <ChartSkeleton height={240} /> },
);

const eur0 = (v: number): string =>
  `€${v.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const days = (v: number): string =>
  v.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 1 });

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function Section({
  title,
  question,
  children,
}: {
  title: string;
  question: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-[17px] font-extrabold tracking-[-0.02em] text-brand-navy">{title}</h2>
        <p className="mt-0.5 text-[13px] text-[#64748b]">{question}</p>
      </div>
      {children}
    </section>
  );
}

function Headline({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: { value: number; goodWhenUp: boolean; suffix?: string } | null;
}) {
  const Icon: LucideIcon | null =
    delta == null || delta.value === 0 ? null : delta.value > 0 ? ArrowUpRight : ArrowDownRight;
  const good = delta ? (delta.value > 0) === delta.goodWhenUp : true;
  return (
    <div className={`p-4 ${CARD}`}>
      <p className={MICRO}>{label}</p>
      <p className="mt-1 text-[26px] font-extrabold leading-none tabular-nums tracking-[-0.025em] text-[#0f172a]">
        {value}
      </p>
      {delta && Icon ? (
        <p
          className={`mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-semibold ${
            good ? "text-[#15803d]" : "text-[#b45309]"
          }`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {Math.abs(delta.value)}
          {delta.suffix ?? "%"} ndaj muajit paraprak
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[12.5px] text-[#64748b]">{hint}</p>
      ) : null}
    </div>
  );
}

/** Compact distribution bars — a pie chart would say less in more pixels. */
function DistributionBars({
  title,
  slices,
  tone = "#2563EB",
}: {
  title: string;
  slices: WorkforceSlice[];
  tone?: string;
}) {
  const total = slices.reduce((s, x) => s + x.count, 0);
  return (
    <div className={`p-4 ${CARD}`}>
      <p className={MICRO}>{title}</p>
      {total === 0 ? (
        <p className="mt-3 text-[13px] text-[#64748b]">Pa të dhëna.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {slices.map((s) => (
            <li key={s.key}>
              <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                <span className="truncate text-[#334155]">{s.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-[#0f172a]">
                  {s.count}
                  <span className="ml-1 text-[11px] font-medium text-[#94a3b8]">
                    {pct(s.count, total)}%
                  </span>
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#eef2f7]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct(s.count, total)}%`, backgroundColor: tone }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * A chart plus the sentence a screen reader (or a phone) gets instead.
 * `summary` is the finding, not a description of the axes.
 */
function EmptySection({ message, cta }: { message: string; cta?: { href: string; label: string } }) {
  return (
    <div className={`px-4 py-10 text-center ${CARD}`}>
      <p className="text-[13px] text-[#64748b]">{message}</p>
      {cta ? (
        <Link
          href={cta.href}
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-blue hover:underline"
        >
          {cta.label}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

export function RaportetChartsClient(props: {
  year: number;
  cost: PayrollCostPoint[];
  workforce: WorkforceShape;
  leave: LeavePressure;
}) {
  const { cost, workforce, leave } = props;

  const latest = cost.length > 0 ? cost[cost.length - 1] : null;
  const previous = cost.length > 1 ? cost[cost.length - 2] : null;
  const costDelta =
    latest && previous && previous.employerCost > 0
      ? Math.round(((latest.employerCost - previous.employerCost) / previous.employerCost) * 100)
      : null;
  const yearCost = cost.reduce((s, p) => s + p.employerCost, 0);
  const draftMonths = cost.filter((p) => p.isDraft).map((p) => p.label);

  const netMovement = workforce.movement.reduce((s, m) => s + m.net, 0);
  const totalJoiners = workforce.movement.reduce((s, m) => s + m.joiners, 0);
  const totalLeavers = workforce.movement.reduce((s, m) => s + m.leavers, 0);
  const biggestDept = workforce.byDepartment[0] ?? null;

  const usedPct = pct(leave.used, leave.quota);
  const quotaFree = Math.max(0, Math.round((leave.quota - leave.used - leave.pending) * 10) / 10);
  const peakLeaveMonth = leave.byMonth.reduce(
    (best, m) => (m.days > (best?.days ?? 0) ? m : best),
    null as (typeof leave.byMonth)[number] | null,
  );
  const carryTotal = leave.carryAtRisk.reduce((s, r) => s + r.carryDays, 0);

  return (
    <div className="space-y-10">
      {/* ---------------------------------------------------------------- */}
      <Section
        title="Kostoja e pagave"
        question={`Sa na kushton paga muaj pas muaji në ${props.year}?`}
      >
        {cost.length === 0 ? (
          <EmptySection
            message={`Nuk ka payroll të llogaritur për ${props.year}.`}
            cta={{ href: "/pagat", label: "Shko te Pagat" }}
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Headline
                label="Kosto totale e vitit"
                value={eur0(yearCost)}
                hint={`${cost.length} periudha të llogaritura`}
              />
              <Headline
                label={`Muaji i fundit (${latest?.label ?? "—"})`}
                value={eur0(latest?.employerCost ?? 0)}
                delta={costDelta != null ? { value: costDelta, goodWhenUp: false } : null}
                hint="Kostoja e plotë e punëdhënësit"
              />
              <Headline
                label="Bruto ndaj neto (muaji i fundit)"
                value={`${pct(latest?.net ?? 0, latest?.gross ?? 0)}%`}
                hint={`Neto ${eur0(latest?.net ?? 0)} nga bruto ${eur0(latest?.gross ?? 0)}`}
              />
              <Headline
                label="Barra e punëdhënësit (muaji i fundit)"
                value={eur0(latest?.employerBurden ?? 0)}
                hint="Kontributi i punëdhënësit mbi bruton"
              />
            </div>

            <ChartFrame
              summary={`Kostoja e pagave sipas muajve në ${props.year}. Muaji i fundit ${latest?.label}: bruto ${eur0(latest?.gross ?? 0)}, neto ${eur0(latest?.net ?? 0)}, kosto totale ${eur0(latest?.employerCost ?? 0)}.`}
              fallback={`Kostoja totale e punëdhënësit është ${eur0(yearCost)} për ${cost.length} periudha. ${
                costDelta == null
                  ? "Nuk ka muaj paraprak për krahasim."
                  : costDelta === 0
                    ? "Muaji i fundit është i njëjtë me atë paraprak."
                    : `Muaji i fundit është ${Math.abs(costDelta)}% ${costDelta > 0 ? "më i shtrenjtë" : "më i lirë"} se ai paraprak.`
              }${draftMonths.length > 0 ? ` Kujdes: ${draftMonths.join(", ")} është ende DRAFT dhe mund të ndryshojë.` : ""}`}
            >
              <PayrollCostChart data={cost} />
            </ChartFrame>
          </>
        )}
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="Fuqia punëtore" question="Kush punon këtu, ku, dhe si po lëviz numri?">
        {workforce.headcount === 0 ? (
          <EmptySection
            message="Nuk ka punonjës aktivë të regjistruar."
            cta={{ href: "/punonjesit", label: "Shto punonjës" }}
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Headline
                label="Punonjës aktivë"
                value={String(workforce.headcount)}
                hint="Të gjithë përveç të larguarve, sot"
              />
              <Headline
                label={`Punësime ${props.year}`}
                value={String(totalJoiners)}
                hint={totalJoiners === 0 ? "Asnjë punësim i regjistruar" : undefined}
              />
              <Headline
                label={`Largime ${props.year}`}
                value={String(totalLeavers)}
                hint={totalLeavers === 0 ? "Asnjë largim i regjistruar" : undefined}
              />
              <Headline
                label="Ndryshimi neto"
                value={`${netMovement > 0 ? "+" : ""}${netMovement}`}
                hint="Punësime minus largime"
              />
            </div>

            <ChartFrame
              summary={`Punësime dhe largime muaj pas muaji në ${props.year}: ${totalJoiners} punësime, ${totalLeavers} largime, ndryshim neto ${netMovement}.`}
              fallback={
                totalJoiners === 0 && totalLeavers === 0
                  ? `Asnjë punësim apo largim i regjistruar në ${props.year}.`
                  : `Në ${props.year} u punësuan ${totalJoiners} dhe u larguan ${totalLeavers} — ndryshim neto ${netMovement > 0 ? "+" : ""}${netMovement}.`
              }
            >
              <MovementChart data={workforce.movement} />
            </ChartFrame>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <ChartFrame
                summary={`Punonjës sipas departamentit. ${
                  biggestDept ? `${biggestDept.label} është më i madhi me ${biggestDept.count}.` : ""
                }`}
                fallback={
                  biggestDept
                    ? `${biggestDept.label} mban ${pct(biggestDept.count, workforce.headcount)}% të fuqisë punëtore (${biggestDept.count} nga ${workforce.headcount}).`
                    : "Pa departamente."
                }
              >
                <DepartmentChart data={workforce.byDepartment} />
              </ChartFrame>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <DistributionBars title="Sipas statusit" slices={workforce.byStatus} tone="#0B1220" />
                <DistributionBars
                  title="Sipas llojit të kontratës"
                  slices={workforce.byContractType}
                  tone="#2563EB"
                />
                <DistributionBars
                  title="Sipas marrëdhënies"
                  slices={workforce.byEmploymentType}
                  tone="#94A3B8"
                />
              </div>
            </div>
          </>
        )}
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        title="Presioni i pushimeve"
        question={`Sa pushim është përdorur, sa ka mbetur, dhe kur bie ngarkesa në ${props.year}?`}
      >
        {leave.employees === 0 ? (
          <EmptySection
            message={`Nuk ka balanca pushimi për ${props.year}.`}
            cta={{ href: "/pushimet", label: "Shko te Pushimet" }}
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Headline
                label="Përdorur nga kuota"
                value={`${usedPct}%`}
                hint={`${days(leave.used)} nga ${days(leave.quota)} ditë`}
              />
              <Headline
                label="Ditë të mbetura sot"
                value={days(leave.remaining)}
                hint={`Të akumuluara minus të përdorurat, ${leave.employees} punonjës`}
              />
              <Headline
                label="Në pritje miratimi"
                value={days(leave.pending)}
                hint="Ditë të kërkuara, ende pa vendim"
              />
              <Headline
                label="Ditë të bartura në rrezik"
                value={days(carryTotal)}
                hint={
                  leave.carryAtRisk.length === 0
                    ? "Askush nuk humb ditë të bartura"
                    : `${leave.carryAtRisk.length} punonjës — skadojnë më 30 qershor`
                }
              />
            </div>

            {/*
              The bar is entirely about the yearly QUOTA, so its leftover is
              "quota not yet spoken for". It is deliberately not labelled with
              `remaining`, which is a different number on a different
              denominator — days accrued so far minus days used (Neni 36) — and
              is therefore always the smaller of the two mid-year. Putting them
              in one bar would have read as arithmetic that does not add up.
            */}
            <div className={`p-4 ${CARD}`}>
              <p className={MICRO}>Kuota vjetore e kompanisë</p>
              <div
                className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-[#eef2f7]"
                role="img"
                aria-label={`Nga ${days(leave.quota)} ditë kuotë vjetore, ${days(leave.used)} janë përdorur dhe ${days(leave.pending)} presin miratim; ${days(quotaFree)} mbeten të pashfrytëzuara.`}
              >
                <div
                  className="h-full bg-brand-blue"
                  style={{ width: `${pct(leave.used, leave.quota)}%` }}
                />
                <div
                  className="h-full bg-[#93c5fd]"
                  style={{ width: `${pct(leave.pending, leave.quota)}%` }}
                />
              </div>
              <p className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-[#64748b]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-brand-blue" aria-hidden />
                  Përdorur {days(leave.used)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#93c5fd]" aria-hidden />
                  Në pritje {days(leave.pending)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#eef2f7]" aria-hidden />
                  Kuotë e pashfrytëzuar {days(quotaFree)}
                </span>
              </p>
              <p className="mt-2 border-t border-[#eef2f7] pt-2.5 text-[12.5px] leading-relaxed text-[#64748b]">
                Kuota është e drejta e plotë e vitit. &quot;Ditë të mbetura&quot; ({days(leave.remaining)})
                është më e vogël sepse ditët akumulohen muaj pas muaji (Neni 36) — ajo tregon çka mund
                të merret sot, jo çka takon për vitin.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <ChartFrame
                summary={`Ditë pushimi të miratuara sipas muajve në ${props.year}. ${
                  peakLeaveMonth && peakLeaveMonth.days > 0
                    ? `Muaji më i ngarkuar është ${peakLeaveMonth.label} me ${days(peakLeaveMonth.days)} ditë.`
                    : "Nuk ka pushime të miratuara."
                }`}
                fallback={
                  peakLeaveMonth && peakLeaveMonth.days > 0
                    ? `Ngarkesa është më e lartë në ${peakLeaveMonth.label} — ${days(peakLeaveMonth.days)} ditë pune mungese nga ${peakLeaveMonth.requests} kërkesa.`
                    : `Asnjë pushim i miratuar në ${props.year}.`
                }
              >
                <LeaveByMonthChart data={leave.byMonth} />
              </ChartFrame>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <DistributionBars
                  title="Gjendja e bilanceve"
                  slices={leave.buckets}
                  tone="#D97706"
                />
                <DistributionBars title="Sipas llojit të pushimit" slices={leave.byType} />
              </div>
            </div>

            {leave.carryAtRisk.length > 0 ? (
              <div className={`overflow-hidden ${CARD}`}>
                <div className="border-b border-[#eef2f7] px-4 py-3.5">
                  <h3 className="text-[13.5px] font-bold tracking-[-0.01em] text-[#0f172a]">
                    Ditë të bartura që skadojnë
                  </h3>
                  <p className="mt-0.5 text-[12px] text-[#64748b]">
                    Ditët e vitit paraprak humbin nëse nuk shfrytëzohen deri më 30 qershor (Neni 35).
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-[#eef2f7] bg-[#f8fafc]">
                        <th className={`px-4 py-2 text-left ${MICRO}`}>Punonjësi</th>
                        <th className={`px-3 py-2 text-right ${MICRO}`}>Bartur</th>
                        <th className={`px-3 py-2 text-right ${MICRO}`}>Mbetur</th>
                        <th className={`px-4 py-2 text-right ${MICRO}`}>Skadon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leave.carryAtRisk.map((r) => (
                        <tr
                          key={r.employeeId}
                          className="border-b border-[#f1f5f9] transition-colors last:border-0 hover:bg-[#f8fafc]"
                        >
                          <td className="px-4 py-2.5">
                            <Link
                              href={`/punonjesit/${r.employeeId}`}
                              className="font-semibold text-[#0f172a] transition-colors hover:text-brand-blue"
                            >
                              {r.employeeName}
                            </Link>
                            <p className="text-[11px] text-[#94a3b8]">
                              {r.departmentName ?? "Pa departament"}
                            </p>
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#b45309]">
                            {days(r.carryDays)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-[#64748b]">
                            {days(r.remainingDays)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-[#64748b]">
                            {r.expiresIso ? r.expiresIso.slice(0, 10).split("-").reverse().join(".") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Section>
    </div>
  );
}
