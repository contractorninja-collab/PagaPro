"use client";

import Link from "next/link";
import { LeaveStatusBadge } from "@/modules/leaves/components/leave-status-badge";
import { formatSqDate } from "@/modules/employees/components/employees-labels";
import { LEAVE_TYPE_LABELS_SQ, LEAVE_SUBTYPE_LABELS_SQ } from "@/modules/leaves/helpers/leave-type-metadata";
import { payrollImpactLabel } from "@/modules/leaves/helpers/payroll-impact-label";
import {
  BTN_DESTRUCTIVE_DENSE,
  BTN_PRIMARY_DENSE,
  BTN_SECONDARY_DENSE,
  LEAVE_CARD,
} from "@/modules/leaves/components/leave-ui";
import type { PushimetLeaveRowDto } from "@/modules/leaves/types/pushimet";

export function LeaveRequestsMobileList(props: {
  rows: PushimetLeaveRowDto[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onCancel: (id: string) => void;
  onGenerate: (id: string) => void;
}) {
  const { rows, onApprove, onReject, onCancel, onGenerate } = props;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e2e8f0] bg-white px-4 py-10 text-center text-[13px] text-[#64748b] md:hidden">
        Nuk ka të dhëna për këtë pamje.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 md:hidden">
      {rows.map((row) => (
        <div key={row.id} className={`overflow-hidden p-4 ${LEAVE_CARD}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-[#0f172a]">{row.employeeName}</p>
              {row.departmentName ? (
                <p className="truncate text-xs text-[#64748b]">{row.departmentName}</p>
              ) : null}
            </div>
            <LeaveStatusBadge status={row.status} />
          </div>
          <div className="my-3 border-t border-[#eef2f7]" />
          <dl className="grid grid-cols-2 gap-x-2 gap-y-2 text-xs">
            <div>
              <dt className="text-[#94a3b8]">Lloji</dt>
              <dd className="font-medium text-[#111827]">{LEAVE_TYPE_LABELS_SQ[row.type]}</dd>
            </div>
            <div>
              <dt className="text-[#94a3b8]">Ditë pune</dt>
              <dd className="font-medium tabular-nums text-[#111827]">
                {row.workingDays ?? row.totalDays ?? "—"}
              </dd>
            </div>
            {row.subtype !== "NONE" ? (
              <div className="col-span-2">
                <dt className="text-[#94a3b8]">Nën-lloji</dt>
                <dd className="font-medium text-[#111827]">{LEAVE_SUBTYPE_LABELS_SQ[row.subtype]}</dd>
              </div>
            ) : null}
            <div className="col-span-2">
              <dt className="text-[#94a3b8]">Periudha</dt>
              <dd className="font-medium tabular-nums text-[#111827]">
                {formatSqDate(row.startDateIso)} → {formatSqDate(row.endDateIso)}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[#94a3b8]">Ndikimi në payroll</dt>
              <dd className="text-[#64748b]">{payrollImpactLabel(row)}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[#eef2f7] pt-4">
            <Link href={`/pushimet/${row.id}`} className={BTN_SECONDARY_DENSE}>
              Detaje
            </Link>
            {row.status === "PENDING" ? (
              <>
                <button type="button" className={BTN_PRIMARY_DENSE} onClick={() => onApprove(row.id)}>
                  Mirato
                </button>
                <button type="button" className={BTN_DESTRUCTIVE_DENSE} onClick={() => onReject(row.id)}>
                  Refuzo
                </button>
              </>
            ) : null}
            {row.status === "DRAFT" || row.status === "PENDING" ? (
              <button type="button" className={BTN_SECONDARY_DENSE} onClick={() => onCancel(row.id)}>
                Anulo
              </button>
            ) : null}
            {row.status === "APPROVED" ? (
              <button type="button" className={BTN_SECONDARY_DENSE} onClick={() => onGenerate(row.id)}>
                Dokument
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
