"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { LeaveStatusBadge } from "@/modules/leaves/components/leave-status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatSqDate } from "@/modules/employees/components/employees-labels";
import { LEAVE_TYPE_LABELS_SQ, LEAVE_SUBTYPE_LABELS_SQ } from "@/modules/leaves/helpers/leave-type-metadata";
import { payrollImpactLabel } from "@/modules/leaves/helpers/payroll-impact-label";
import { LEAVE_CARD, LEAVE_TYPE_TONES } from "@/modules/leaves/components/leave-ui";
import type { PushimetLeaveRowDto } from "@/modules/leaves/types/pushimet";

const TH = "px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.04em] text-[#94a3b8]";
const TD = "px-4 py-3 align-middle";

export function LeaveRequestsTable(props: {
  rows: PushimetLeaveRowDto[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onCancel: (id: string) => void;
  onGenerate: (id: string) => void;
}) {
  const { rows, onApprove, onReject, onCancel, onGenerate } = props;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e2e8f0] bg-white px-4 py-12 text-center text-[13px] text-[#64748b]">
        Nuk u gjet asnjë kërkesë për filtrat e zgjedhur.
      </div>
    );
  }

  return (
    <div className={`hidden overflow-hidden md:block ${LEAVE_CARD}`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-[13px] text-[#111827]">
          <thead>
            <tr className="border-b border-[#eef2f7] bg-[#f8fafc]">
              <th className={TH}>Punonjësi</th>
              <th className={TH}>Lloji</th>
              <th className={TH}>Nën-lloji</th>
              <th className={TH}>Fillimi</th>
              <th className={TH}>Mbarimi</th>
              <th className={`${TH} text-right`}>Ditë</th>
              <th className={TH}>Statusi</th>
              <th className={TH}>Payroll</th>
              <th className={`${TH} text-right`}>Veprime</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const tone = LEAVE_TYPE_TONES[row.type];
              return (
                <tr
                  key={row.id}
                  className="border-b border-[#f1f5f9] transition-colors last:border-0 hover:bg-[#f8fafc]"
                >
                  <td className={TD}>
                    <div className="flex flex-col">
                      <span className="font-semibold text-[#0f172a]">{row.employeeName}</span>
                      {row.departmentName ? (
                        <span className="text-xs text-[#64748b]">{row.departmentName}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className={TD}>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
                      {LEAVE_TYPE_LABELS_SQ[row.type]}
                    </span>
                  </td>
                  <td className={`${TD} max-w-[160px] text-xs text-[#64748b]`}>
                    {LEAVE_SUBTYPE_LABELS_SQ[row.subtype]}
                  </td>
                  <td className={`${TD} tabular-nums`}>{formatSqDate(row.startDateIso)}</td>
                  <td className={`${TD} tabular-nums`}>{formatSqDate(row.endDateIso)}</td>
                  <td className={`${TD} text-right tabular-nums text-[#64748b]`}>
                    {row.workingDays ?? row.totalDays ?? "—"}
                  </td>
                  <td className={TD}>
                    <LeaveStatusBadge status={row.status} />
                  </td>
                  <td className={`${TD} max-w-[140px] text-xs leading-snug text-[#64748b]`}>
                    {payrollImpactLabel(row)}
                  </td>
                  <td className={`${TD} text-right`}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Veprime"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] transition-colors hover:bg-[#eef2f7] hover:text-[#0f172a]"
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem asChild>
                          <Link href={`/pushimet/${row.id}`}>Shiko detajet</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/punonjesit/${row.employeeId}`}>Profili i punonjësit</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {row.status === "PENDING" ? (
                          <>
                            <DropdownMenuItem onClick={() => onApprove(row.id)}>Mirato</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onReject(row.id)}>Refuzo…</DropdownMenuItem>
                          </>
                        ) : null}
                        {row.status === "DRAFT" || row.status === "PENDING" ? (
                          <DropdownMenuItem onClick={() => onCancel(row.id)}>Anulo</DropdownMenuItem>
                        ) : null}
                        {row.status === "APPROVED" ? (
                          <DropdownMenuItem onClick={() => onGenerate(row.id)}>
                            Gjenero dokument…
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
