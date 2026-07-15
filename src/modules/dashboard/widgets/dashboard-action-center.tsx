"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Info,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSqDate } from "@/modules/employees/components/employees-labels";
import {
  approveLeaveRequestAction,
  rejectLeaveRequestAction,
} from "@/modules/leaves/actions/leave-actions";
import { LEAVE_STATUS_LABELS_SQ } from "@/modules/leaves/helpers/leave-status-labels";
import type {
  ContractExpiryRow,
  LeavePendingRow,
  LeaveTodayCounts,
  OperationalAlert,
} from "../types/dashboard-types";
import { CONTRACT_KIND_LABELS_SQ, LEAVE_TYPE_LABELS_SQ } from "../helpers/dashboard-labels";

/** ATK monthly-declaration deadline row — computed server-side and passed in. */
export interface AtkDeadlineItem {
  title: string;
  detail: string;
  severity: "critical" | "warning" | "info";
  href: string;
}

type QueueTone = "critical" | "warning" | "info" | "neutral";

const TONE_STYLES: Record<QueueTone, { rail: string; tile: string; chip: string }> = {
  critical: {
    rail: "border-l-[#dc2626]",
    tile: "bg-[#fef2f2] text-[#dc2626]",
    chip: "bg-[#fef2f2] text-[#dc2626]",
  },
  warning: {
    rail: "border-l-[#d97706]",
    tile: "bg-[#fffbeb] text-[#d97706]",
    chip: "bg-[#fffbeb] text-[#b45309]",
  },
  info: {
    rail: "border-l-brand-blue",
    tile: "bg-[#eff6ff] text-brand-blue",
    chip: "bg-[#eff6ff] text-brand-blue",
  },
  neutral: {
    rail: "border-l-[#cbd5e1]",
    tile: "bg-[#f1f5f9] text-[#475569]",
    chip: "bg-[#f1f5f9] text-[#64748b]",
  },
};

const TONE_RANK: Record<QueueTone, number> = { critical: 0, warning: 1, info: 2, neutral: 3 };

const ALERT_CHIP_LABELS: Record<OperationalAlert["severity"], string> = {
  critical: "Kritike",
  warning: "Vëmendje",
  info: "Info",
};

const ALERT_ICONS: Record<OperationalAlert["severity"], LucideIcon> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const BTN_PRIMARY =
  "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-[9px] bg-brand-blue px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#1d4ed8]";
const BTN_SECONDARY =
  "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-[9px] border border-[#e2e8f0] bg-white px-4 text-[13px] font-semibold text-[#334155] transition-colors hover:bg-[#eef2f7]";
const BTN_APPROVE =
  "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-[9px] border border-[#dcfce7] bg-[#f0fdf4] px-3.5 text-[13px] font-semibold text-[#16a34a] transition-colors hover:bg-[#dcfce7]";
const BTN_REJECT =
  "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-[9px] border border-[#fee2e2] bg-white px-3.5 text-[13px] font-semibold text-[#dc2626] transition-colors hover:bg-[#fef2f2]";

interface QueueItem {
  key: string;
  tone: QueueTone;
  icon: LucideIcon;
  title: ReactNode;
  chip?: { label: string; tone: QueueTone };
  detail?: ReactNode;
  anchorId?: string;
  action?: ReactNode;
}

function QueueRow({ item }: { item: QueueItem }) {
  const t = TONE_STYLES[item.tone];
  const Icon = item.icon;

  return (
    <li
      id={item.anchorId}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-[#e2e8f0] border-l-[3px] bg-white px-[18px] py-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:gap-[15px]",
        t.rail,
        item.anchorId ? "scroll-mt-24" : undefined,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-[15px] sm:items-center">
        <div
          className={cn(
            "flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px]",
            t.tile,
          )}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-[14.5px] font-bold leading-snug text-[#0f172a]">{item.title}</span>
            {item.chip ? (
              <span
                className={cn(
                  "inline-flex h-[19px] items-center rounded-full px-2 text-[10.5px] font-bold uppercase tracking-[0.03em]",
                  TONE_STYLES[item.chip.tone].chip,
                )}
              >
                {item.chip.label}
              </span>
            ) : null}
          </div>
          {item.detail ? (
            <p className="text-[12.5px] leading-relaxed text-[#64748b]">{item.detail}</p>
          ) : null}
        </div>
      </div>

      {item.action ? (
        <div className="flex flex-none flex-wrap items-center gap-2 pl-[53px] sm:pl-0">
          {item.action}
        </div>
      ) : null}
    </li>
  );
}

/**
 * "Qendra e veprimeve" — the 1b urgency-ranked queue unifying operational alerts,
 * pending leave approvals, expiring contracts and the ATK deadline. Presentation
 * only: reuses the existing DTO slices and leave approve/reject server actions.
 */
export function DashboardActionCenter(props: {
  alerts: OperationalAlert[];
  leavePending: LeavePendingRow[];
  today: LeaveTodayCounts;
  contractExpiries: ContractExpiryRow[];
  atkDeadline: AtkDeadlineItem | null;
  /** Totalet e vërteta nga summary — rreshtat për-artikull janë të kufizuar (take: N). */
  pendingLeaveTotal?: number;
  expiringContractsTotal?: number;
}) {
  const router = useRouter();

  async function decideLeave(id: string, mode: "approve" | "reject") {
    const fn = mode === "approve" ? approveLeaveRequestAction : rejectLeaveRequestAction;
    const r = await fn(id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(mode === "approve" ? "Pushimi u miratua." : "Pushimi u refuzua.");
    router.refresh();
  }

  const items: QueueItem[] = [];

  // Operational alerts — the aggregate leave/contract rows are superseded by the
  // richer per-request / per-contract rows below, POR vetëm kur rreshtat i mbulojnë
  // të gjitha (slices janë të kufizuara me take: N — mbi kufi, totali i plotë duhet
  // të mbetet i dukshëm përmes alertit agregat).
  const leaveFullyListed =
    props.leavePending.length >= (props.pendingLeaveTotal ?? props.leavePending.length);
  const contractsFullyListed =
    props.contractExpiries.length >= (props.expiringContractsTotal ?? props.contractExpiries.length);
  for (const alert of props.alerts) {
    if (alert.id === "leave-backlog" && props.leavePending.length > 0 && leaveFullyListed) continue;
    if (alert.id === "contracts-expiring" && props.contractExpiries.length > 0 && contractsFullyListed) continue;
    const tone: QueueTone = alert.severity;
    items.push({
      key: `alert-${alert.id}`,
      tone,
      icon: ALERT_ICONS[alert.severity],
      title: alert.title,
      chip: { label: ALERT_CHIP_LABELS[alert.severity], tone },
      detail: alert.detail,
      action: alert.href ? (
        <Link href={alert.href} className={tone === "info" ? BTN_SECONDARY : BTN_PRIMARY}>
          {alert.actionLabel ?? "Shiko detajet"}
        </Link>
      ) : undefined,
    });
  }

  // Expiring contracts — one row per contract, ranked by urgency bucket.
  props.contractExpiries.forEach((c, idx) => {
    const tone: QueueTone = c.urgency === "7" ? "critical" : c.urgency === "14" ? "warning" : "neutral";
    items.push({
      key: `contract-${c.contractId}`,
      tone,
      icon: FileText,
      title: `Kontrata e ${c.employeeName} skadon ${c.daysRemaining === 0 ? "sot" : `për ${c.daysRemaining} ditë`}`,
      chip: {
        label: c.urgency === "7" ? "Kritike" : c.urgency === "14" ? "≤ 14 ditë" : "≤ 30 ditë",
        tone,
      },
      detail: `${c.jobTitle ?? "Pa pozitë"} · ${CONTRACT_KIND_LABELS_SQ[c.contractKind]} · skadon ${formatSqDate(c.endDateIso)}`,
      anchorId: idx === 0 ? "contracts-expiry" : undefined,
      action: (
        <>
          <Link href="/dokumentet" className={tone === "critical" ? BTN_PRIMARY : BTN_SECONDARY}>
            Rinovo
          </Link>
          <Link
            href={`/punonjesit/${c.employeeId}`}
            className="text-[13px] font-semibold text-brand-blue hover:underline"
          >
            Hap profilin
          </Link>
        </>
      ),
    });
  });

  // Pending leave approvals — keep the inline approve/reject server actions.
  props.leavePending.forEach((row, idx) => {
    items.push({
      key: `leave-${row.id}`,
      tone: "warning",
      icon: CalendarDays,
      title: (
        <>
          <Link href={`/punonjesit/${row.employeeId}`} className="hover:underline">
            {row.employeeName}
          </Link>
          {" — "}
          {LEAVE_TYPE_LABELS_SQ[row.type]}
        </>
      ),
      chip: { label: LEAVE_STATUS_LABELS_SQ[row.status], tone: "warning" },
      detail: `${formatSqDate(row.startDateIso)} – ${formatSqDate(row.endDateIso)} · kërkesë pushimi`,
      anchorId: idx === 0 ? "leave-requests" : undefined,
      action: (
        <>
          <button type="button" className={BTN_APPROVE} onClick={() => void decideLeave(row.id, "approve")}>
            Mirato
          </button>
          <button type="button" className={BTN_REJECT} onClick={() => void decideLeave(row.id, "reject")}>
            Refuzo
          </button>
        </>
      ),
    });
  });

  // ATK monthly declaration deadline.
  if (props.atkDeadline) {
    items.push({
      key: "atk-deadline",
      tone: props.atkDeadline.severity,
      icon: Clock,
      title: props.atkDeadline.title,
      chip: { label: "Afati ATK", tone: props.atkDeadline.severity },
      detail: props.atkDeadline.detail,
      action: (
        <Link
          href={props.atkDeadline.href}
          className="text-[13px] font-semibold text-brand-blue hover:underline"
        >
          Shiko →
        </Link>
      ),
    });
  }

  items.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);

  return (
    <section aria-label="Qendra e veprimeve">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[17px] font-bold tracking-[-0.01em] text-brand-navy">
          Qendra e veprimeve
        </h2>
        <p className="text-[12.5px] text-[#64748b]">
          Renditur sipas urgjencës ·{" "}
          <span className="font-semibold text-[#0f172a]">{items.length} gjithsej</span>
          <span className="mx-1.5 text-[#cbd5e1]" aria-hidden>
            ·
          </span>
          Sot: {props.today.approved} miratuar · {props.today.rejected} refuzuar
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-[15px] rounded-xl border border-[#e2e8f0] bg-white px-[18px] py-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[#ecfdf5] text-[#16a34a]">
            <CheckCircle2 className="h-[18px] w-[18px]" aria-hidden />
          </div>
          <div>
            <p className="text-[14.5px] font-bold text-[#0f172a]">Gjithçka në rregull</p>
            <p className="text-[12.5px] text-[#64748b]">
              Nuk ka çështje që kërkojnë vëmendje për momentin.
            </p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-[11px]">
          {items.map((item) => (
            <QueueRow key={item.key} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
