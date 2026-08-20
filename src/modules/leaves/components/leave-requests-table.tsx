"use client";

import Link from "next/link";
import { FileText, MoreHorizontal } from "lucide-react";
import { LeaveStatusBadge } from "@/modules/leaves/components/leave-status-badge";
import { useCan } from "@/components/layout/capability-provider";
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
import {
  LEAVE_CARD,
  LEAVE_TYPE_TONES,
  LeaveFlagPills,
  type LeaveConflictFlag,
} from "@/modules/leaves/components/leave-ui";
import type { PushimetLeaveRowDto } from "@/modules/leaves/types/pushimet";

const TH = "px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.04em] text-ink-400";
const TD = "px-4 py-3 align-middle";

/**
 * Whether this leave has a document in the archive.
 *
 * Until now the only way to answer that was to open the request. Generating one
 * was already offered in the row menu, so the archive could create documents it
 * then refused to show.
 *
 * `documents === null` means the query did not load them, which is not the same
 * as "none" and must not be drawn as an invitation to generate a second copy.
 */
function LeaveDocumentCell({
  row,
  onGenerate,
}: {
  row: PushimetLeaveRowDto;
  onGenerate: (id: string) => void;
}) {
  const canWriteDocuments = useCan("documents.write");
  const docs = row.documents;
  if (docs === null) return <span className="text-ink-300">—</span>;

  const newest = docs[0];
  if (newest) {
    return (
      <Link
        href={`/dokumentet/${newest.artifactId}`}
        className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold text-brand-blue hover:underline"
      >
        <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Hape
        {docs.length > 1 ? (
          <span className="font-medium text-ink-400">+{docs.length - 1}</span>
        ) : null}
      </Link>
    );
  }

  // Only an approved leave can be documented, so nothing else offers the action.
  if (row.status === "APPROVED" && canWriteDocuments) {
    return (
      <button
        type="button"
        onClick={() => onGenerate(row.id)}
        className="whitespace-nowrap text-[12.5px] font-medium text-ink-500 underline-offset-2 transition-colors hover:text-brand-blue hover:underline"
      >
        Gjenero
      </button>
    );
  }

  return <span className="text-ink-300">—</span>;
}

export function LeaveRequestsTable(props: {
  rows: PushimetLeaveRowDto[];
  /** Decision-support warnings, rendered on the row itself. */
  flagsFor?: (row: PushimetLeaveRowDto) => LeaveConflictFlag[];
  /** The row currently running a mutation — blocks a second click. */
  busyId?: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onCancel: (id: string) => void;
  onGenerate: (id: string) => void;
}) {
  const { rows, flagsFor, busyId, onApprove, onReject, onCancel, onGenerate } = props;
  /**
   * The menu keeps its two read links (the request and the employee profile),
   * so its mutations are disabled rather than removed — a menu that changes
   * length by role is harder to learn than one whose items grey out.
   */
  const canWriteLeave = useCan("leave.write");
  const canWriteDocs = useCan("documents.write");

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-white px-4 py-12 text-center text-[13px] text-ink-500">
        Nuk u gjet asnjë kërkesë për filtrat e zgjedhur.
      </div>
    );
  }

  return (
    <div className={`hidden overflow-hidden md:block ${LEAVE_CARD}`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1020px] border-collapse text-[13px] text-[#111827]">
          <thead>
            <tr className="border-b border-line-soft bg-fill-faint">
              <th className={TH}>Punonjësi</th>
              <th className={TH}>Lloji</th>
              <th className={TH}>Nën-lloji</th>
              <th className={TH}>Fillimi</th>
              <th className={TH}>Mbarimi</th>
              <th className={`${TH} text-right`}>Ditë</th>
              <th className={TH}>Statusi</th>
              <th className={TH}>Payroll</th>
              <th className={TH}>Dokumenti</th>
              <th className={`${TH} text-right`}>Veprime</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const tone = LEAVE_TYPE_TONES[row.type];
              const flags = flagsFor?.(row) ?? [];
              const busy = busyId === row.id;
              return (
                <tr
                  key={row.id}
                  className="border-b border-fill transition-colors last:border-0 hover:bg-fill-faint"
                >
                  <td className={TD}>
                    <div className="flex flex-col">
                      <span className="font-semibold text-ink-900">{row.employeeName}</span>
                      {row.departmentName ? (
                        <span className="text-xs text-ink-500">{row.departmentName}</span>
                      ) : null}
                      <LeaveFlagPills flags={flags} className="mt-1.5" />
                    </div>
                  </td>
                  <td className={TD}>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
                      {LEAVE_TYPE_LABELS_SQ[row.type]}
                    </span>
                  </td>
                  <td className={`${TD} max-w-[160px] text-xs text-ink-500`}>
                    {LEAVE_SUBTYPE_LABELS_SQ[row.subtype]}
                  </td>
                  <td className={`${TD} tabular-nums`}>{formatSqDate(row.startDateIso)}</td>
                  <td className={`${TD} tabular-nums`}>{formatSqDate(row.endDateIso)}</td>
                  <td className={`${TD} text-right tabular-nums text-ink-500`}>
                    {row.workingDays ?? row.totalDays ?? "—"}
                  </td>
                  <td className={TD}>
                    <LeaveStatusBadge status={row.status} />
                  </td>
                  <td className={`${TD} max-w-[140px] text-xs leading-snug text-ink-500`}>
                    {payrollImpactLabel(row)}
                  </td>
                  <td className={TD}>
                    <LeaveDocumentCell row={row} onGenerate={onGenerate} />
                  </td>
                  <td className={`${TD} text-right`}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Veprime"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-fill-hover hover:text-ink-900"
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
                            <DropdownMenuItem disabled={busy || !canWriteLeave} onClick={() => onApprove(row.id)}>
                              Mirato
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={!canWriteLeave} onClick={() => onReject(row.id)}>
                              Refuzo…
                            </DropdownMenuItem>
                          </>
                        ) : null}
                        {row.status === "DRAFT" || row.status === "PENDING" ? (
                          <DropdownMenuItem disabled={busy || !canWriteLeave} onClick={() => onCancel(row.id)}>
                            Anulo kërkesën
                          </DropdownMenuItem>
                        ) : null}
                        {row.status === "APPROVED" ? (
                          <DropdownMenuItem disabled={!canWriteDocs} onClick={() => onGenerate(row.id)}>
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
