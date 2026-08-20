import { useMemo, type ReactNode } from "react";
import type { PushimetBalanceRowDto } from "@/modules/leaves/types/pushimet";
import type { LeaveBalanceTotals } from "@/modules/leaves/services/leave-query-service";
import { LEAVE_CARD, MICRO_LABEL } from "@/modules/leaves/components/leave-ui";
import { LeaveBalanceList } from "@/modules/leaves/components/leave-balance-list";
import { fmtDays } from "@/modules/leaves/helpers/leave-balance-view";
import type { AttentionContext } from "@/modules/leaves/helpers/leave-balance-attention";

/**
 * The company's annual leave position, then the people who need a decision.
 *
 * This used to be a card per employee in a four-column grid. With eighteen
 * employees, thirteen of the cards were identical — same quota, same accrual,
 * "Përdorur 0 · Pritje 0" on every one — so the block filled the viewport and
 * said almost nothing. Now the exceptions are listed and the rest fold away
 * behind a count, reachable by search.
 *
 * Every tile reads the DB aggregate. They used to be summed on the client from
 * the row array, which is capped: past roughly 130 employees the tiles and the
 * footer directly beneath them were adding up different populations and quietly
 * disagreeing on the same card.
 */
export function AnnualLeaveBalancePanel({
  balances,
  companyTotals,
  year,
  attention,
  action,
}: {
  balances: PushimetBalanceRowDto[];
  /** Company position from a DB aggregate — the list below may be capped. */
  companyTotals: LeaveBalanceTotals;
  year: number;
  /**
   * Server-supplied date and the company's policy switches. Built by the caller
   * so both balance panels judge rows against exactly the same context, and so
   * neither reads a clock of its own.
   */
  attention: AttentionContext;
  /** Header slot — carries the explicit "Rifresko balancat" control. */
  action?: ReactNode;
}) {
  const annual = useMemo(
    () => balances.filter((b) => b.leaveType === "PUSHIM_VJETOR"),
    [balances],
  );

  if (annual.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-white px-4 py-8 text-center text-[13px] text-ink-500">
        <p>
          Nuk ka balanca të pushimit vjetor për vitin {year} — do të popullohet kur regjistrohen
          punonjës dhe pushime.
        </p>
        {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${LEAVE_CARD}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line-soft px-4 py-3.5">
        <div className="min-w-0">
          <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-ink-900">
            Pushimi vjetor — bilanci {year}
          </h2>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-400">
            {companyTotals.employees} punonjës · shfaqen ata që kërkojnë vendim
          </p>
        </div>
        {action}
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-line-soft bg-fill-hover lg:grid-cols-4">
        <div className="bg-white px-4 py-3">
          <p className={MICRO_LABEL}>Disponueshme tani</p>
          <p className="mt-0.5 text-[20px] font-extrabold leading-none tabular-nums tracking-[-0.02em] text-[#15803d]">
            {fmtDays(companyTotals.remainingDays)}
          </p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className={MICRO_LABEL}>Përdorur {year}</p>
          <p className="mt-0.5 text-[20px] font-extrabold leading-none tabular-nums tracking-[-0.02em] text-ink-900">
            {fmtDays(companyTotals.usedDays)}
          </p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className={MICRO_LABEL}>Në pritje</p>
          <p className="mt-0.5 text-[20px] font-extrabold leading-none tabular-nums tracking-[-0.02em] text-ink-900">
            {fmtDays(companyTotals.pendingDays)}
          </p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className={MICRO_LABEL}>Alarme</p>
          <p className="mt-0.5 text-[20px] font-extrabold leading-none tabular-nums tracking-[-0.02em]">
            {companyTotals.negativeCount > 0 ? (
              <span className="text-[#dc2626]">{companyTotals.negativeCount} negativ</span>
            ) : (
              <span className="text-[#15803d]">0</span>
            )}
            {companyTotals.carryExpiringSoonCount > 0 ? (
              <span className="ml-1.5 text-[13px] font-semibold text-[#b45309]">
                · {companyTotals.carryExpiringSoonCount} skadojnë
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="border-b border-line-soft pt-2">
        <LeaveBalanceList
          rows={annual}
          attention={attention}
          emptyText={`Nuk ka balanca të pushimit vjetor për vitin ${year}.`}
        />
      </div>

      {/* The company position. Read from the database rather than added up from
          the rows above, which are capped — a company past the ceiling would
          otherwise see a total that silently excluded everyone off the end. */}
      <div className="border-t-2 border-line bg-fill-faint px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-ink-700">
            Totali · {companyTotals.employees} punonjës
          </p>
          <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[12px] tabular-nums">
            <div className="flex items-baseline gap-1.5">
              <dt className="text-ink-400">Kuota</dt>
              <dd className="font-semibold text-ink-900">{companyTotals.yearlyQuota}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-ink-400">Bartur</dt>
              <dd className="font-semibold text-ink-900">{companyTotals.carryOverDays}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-ink-400">Akumuluar</dt>
              <dd className="font-semibold text-ink-900">{companyTotals.accruedYtd}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-ink-400">Përdorur</dt>
              <dd className="font-semibold text-ink-900">{companyTotals.usedDays}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-ink-400">Në pritje</dt>
              <dd className="font-semibold text-ink-900">{companyTotals.pendingDays}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-ink-400">Disponueshme</dt>
              <dd className="text-[14px] font-extrabold text-[#15803d]">{companyTotals.remainingDays}</dd>
            </div>
          </dl>
        </div>

        {/* Two engine versions in one column do not add up to one meaning. */}
        {companyTotals.ruleVersions.length > 1 ? (
          <p className="mt-2 text-[11.5px] font-medium text-[#b45309]">
            Këto bilanca janë llogaritur me {companyTotals.ruleVersions.length} versione rregullash (
            {companyTotals.ruleVersions.join(", ")}). Totali i mbledh të dyja — rifreskoni balancat për t&apos;i
            njësuar.
          </p>
        ) : null}

        {/* Shown whenever the list is short of the company, search or no search.
            It used to be suppressed while searching, which is exactly backwards:
            an incomplete list matters most when somebody is looking for one
            person and not finding them. */}
        {companyTotals.employees > annual.length ? (
          <p className="mt-2 text-[11.5px] text-ink-400">
            Po shfaqen {annual.length} nga {companyTotals.employees} punonjës — kërkimi mbulon vetëm këta.
          </p>
        ) : null}
      </div>

      <p className="border-t border-line-soft bg-fill-faint px-4 py-3 text-[11px] leading-relaxed text-ink-400">
        &quot;Disponueshme tani&quot; = ditët e akumuluara deri sot minus të përdorurat (plus ditët e bartura,
        nëse aktive). &quot;Fund viti&quot; është projeksioni deri më 31 dhjetor. Festat zyrtare dhe pushimi
        mjekësor gjatë pushimit vjetor nuk zbriten (Art 34).
      </p>
    </div>
  );
}
