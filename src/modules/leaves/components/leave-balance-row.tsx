import type { LeaveType } from "@prisma/client";
import { LeaveTypePill, TonePill } from "@/modules/leaves/components/leave-ui";
import { LEAVE_TYPE_LABELS_SQ } from "@/modules/leaves/helpers/leave-type-metadata";
import { balanceStatSegments, fmtDays, toNum } from "@/modules/leaves/helpers/leave-balance-view";
import { topReason, type AttentionVerdict } from "@/modules/leaves/helpers/leave-balance-attention";
import type { PushimetBalanceRowDto } from "@/modules/leaves/types/pushimet";

/**
 * One employee's balance, in two lines.
 *
 * This replaced a card that carried a name, a department, a big number, a
 * progress bar, five figures and up to three pills — about 110px of chrome for
 * a row that, thirteen times out of eighteen, said nothing but "20 days, none
 * used". A calm row here is roughly 34px.
 *
 * The progress bar is gone on purpose. It encoded used-over-total, which the
 * line directly beneath it stated as exact numbers, and its aria-label spelled
 * those same numbers out a third time for screen readers. Severity is carried
 * instead by a coloured left edge and the colour of the number itself — both
 * free, vertically. Nothing is conveyed by colour alone: every tone also has a
 * pill with words in it.
 */
export function LeaveBalanceRow({
  row,
  verdict,
  showTypePill = false,
}: {
  row: PushimetBalanceRowDto;
  verdict: AttentionVerdict;
  /** The other-types block lists several quotas per person and must name them. */
  showTypePill?: boolean;
}) {
  const remaining = toNum(row.remainingDays);
  const top = topReason(verdict);
  const tone = top?.tone ?? null;

  const edge =
    tone === "destructive"
      ? "border-l-2 border-l-[#dc2626]"
      : tone === "warning"
        ? "border-l-2 border-l-[#d97706]"
        : "border-l-2 border-l-transparent";

  const valueColor =
    tone === "destructive"
      ? "text-[#dc2626]"
      : tone === "warning"
        ? "text-[#b45309]"
        : remaining < 0
          ? "text-[#dc2626]"
          : "text-ink-900";

  return (
    <li
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 bg-white py-2 pl-3 pr-4 transition-colors hover:bg-fill-faint ${edge}`}
    >
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold leading-tight text-ink-900">
          <span className="truncate">{row.employeeName}</span>
          {showTypePill ? (
            <LeaveTypePill type={row.leaveType as LeaveType} label={LEAVE_TYPE_LABELS_SQ[row.leaveType]} />
          ) : null}
          <span className="truncate text-[11px] font-normal text-ink-400">
            {row.departmentName ?? "Pa departament"}
          </span>
        </p>
        <p className="truncate text-[11px] leading-tight text-ink-500 [font-variant-numeric:tabular-nums]">
          {balanceStatSegments(row).join(" · ")}
        </p>
      </div>

      <p
        className={`shrink-0 text-right text-[14px] font-bold leading-tight [font-variant-numeric:tabular-nums] ${valueColor}`}
      >
        {fmtDays(remaining)}
        <span className="ml-1 text-[10.5px] font-medium text-ink-400">ditë</span>
      </p>

      {verdict.reasons.length > 0 ? (
        <div className="col-span-2 flex flex-wrap gap-1.5">
          {verdict.reasons.map((reason) => (
            <TonePill key={reason.key} tone={reason.tone} size="sm">
              {reason.label}
            </TonePill>
          ))}
        </div>
      ) : null}

      {/* Engine prose — kept for rows a human is already looking at, so the
          first-year explanation is there when somebody wonders about a small
          number, without putting it in front of everyone every day. */}
      {verdict.needsAttention && row.warnings.length > 0 ? (
        <ul className="col-span-2 space-y-0.5 border-l-2 border-[#fde68a] pl-2.5">
          {row.warnings.map((warning) => (
            <li key={warning} className="text-[11px] leading-snug text-[#92400e]">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
