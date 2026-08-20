import { useMemo } from "react";
import type { PushimetBalanceRowDto } from "@/modules/leaves/types/pushimet";
import { LEAVE_CARD } from "@/modules/leaves/components/leave-ui";
import { LeaveBalanceList } from "@/modules/leaves/components/leave-balance-list";
import type { AttentionContext } from "@/modules/leaves/helpers/leave-balance-attention";

/**
 * Personal and medical leave quotas, on the same terms as the annual panel.
 *
 * This was a four-column table listing every employee against every non-annual
 * quota — eighteen people times two types, unpaginated, directly below a block
 * that already filled the screen. It now shares the attention-first list, so it
 * shows what needs a decision, folds the rest, and gains a search box it never
 * had.
 *
 * Non-annual rows carry no carry-over, no projection and no entitlement
 * breakdown, so the shared row degrades to "Kuota 5" without needing to know
 * which type it is holding — the pill says that.
 */
export function OtherLeaveBalancePanel({
  balances,
  attention,
}: {
  /** The full array; this filters out the annual rows the panel above owns. */
  balances: PushimetBalanceRowDto[];
  attention: AttentionContext;
}) {
  const rows = useMemo(
    () => balances.filter((b) => b.leaveType !== "PUSHIM_VJETOR"),
    [balances],
  );

  if (rows.length === 0) return null;

  return (
    <div className={`overflow-hidden ${LEAVE_CARD}`}>
      <div className="border-b border-line-soft px-4 py-3.5">
        <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-ink-900">
          Lloje të tjera (kuotë vjetore)
        </h2>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-400">
          Pushimi personal dhe mjekësor · {rows.length} rreshta
        </p>
      </div>
      <div className="pt-2">
        <LeaveBalanceList
          rows={rows}
          attention={attention}
          showTypePill
          searchPlaceholder="Kërko punonjës ose departament…"
          emptyText="Nuk ka kuota të tjera vjetore për këtë vit."
        />
      </div>
    </div>
  );
}
