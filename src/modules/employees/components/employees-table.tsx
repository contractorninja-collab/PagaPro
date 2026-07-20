"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  archiveEmployeeAction,
  deleteEmployeeAction,
} from "@/modules/employees/actions/employee-actions";
import type { EmployeeListRowDto } from "@/modules/employees/types";
import {
  formatEur,
  formatSqDate,
} from "@/modules/employees/components/employees-labels";
import { EmployeeStatusBadge, EmployeeTypeBadge } from "@/modules/employees/components/employee-status-badge";
import { TerminateEmployeeDialog } from "@/modules/employees/components/terminate-employee-dialog";

const TH =
  "h-10 whitespace-nowrap px-4 text-left align-middle text-[11px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]";

function EmployeeAvatar({ row }: { row: EmployeeListRowDto }) {
  const initials = `${row.firstName.charAt(0)}${row.lastName.charAt(0)}`.toUpperCase();
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-navy text-[12px] font-semibold text-white"
    >
      {initials}
    </span>
  );
}

function RowActions(props: {
  row: EmployeeListRowDto;
  onEdit: (row: EmployeeListRowDto) => void;
  onRefresh: () => void;
}) {
  const { row, onEdit, onRefresh } = props;
  const router = useRouter();
  const [termOpen, setTermOpen] = useState(false);
  const [confirmInactiveOpen, setConfirmInactiveOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const label = `${row.firstName} ${row.lastName}`;

  const inactive = async () => {
    setPending(true);
    try {
      const res = await archiveEmployeeAction(row.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Punonjësi u shënua si jo aktiv.");
      setConfirmInactiveOpen(false);
      router.refresh();
      onRefresh();
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    setPending(true);
    try {
      const res = await deleteEmployeeAction(row.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Punonjësi u fshi.");
      setConfirmDeleteOpen(false);
      router.refresh();
      onRefresh();
    } finally {
      setPending(false);
    }
  };

  const terminated = row.status === "TERMINATED";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Veprime">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={`/punonjesit/${row.id}`}>Shiko profilin</Link>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={terminated} onClick={() => onEdit(row)}>
            Ndrysho
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={terminated || row.status === "INACTIVE"} onClick={() => setConfirmInactiveOpen(true)}>
            Shëno jo aktiv
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={terminated}
            className="text-destructive focus:text-destructive"
            onClick={() => setTermOpen(true)}
          >
            Largo punonjësin
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={terminated}
            className="text-destructive focus:text-destructive"
            onClick={() => setConfirmDeleteOpen(true)}
          >
            Fshi (kushte)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TerminateEmployeeDialog
        employeeId={row.id}
        employeeLabel={label}
        open={termOpen}
        onOpenChange={setTermOpen}
        onSuccess={() => {
          router.refresh();
          onRefresh();
        }}
      />

      <Dialog open={confirmInactiveOpen} onOpenChange={setConfirmInactiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Jo aktiv?</DialogTitle>
            <DialogDescription>
              {label} do të shfaqet si jo aktiv. Mund të riaktivizohet më vonë duke përditur statusin në formularin e
              ndryshimit.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setConfirmInactiveOpen(false)}>
              Anulo
            </Button>
            <Button type="button" disabled={pending} onClick={() => void inactive()}>
              {pending ? "…" : "Konfirmo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fshi punonjësin?</DialogTitle>
            <DialogDescription>
              Lejohet vetëm nëse nuk ka hyrje payroll dhe nuk ka kontrata të lidhura. Ky veprim është i pakthyeshëm.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setConfirmDeleteOpen(false)}>
              Anulo
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={() => void remove()}>
              {pending ? "…" : "Fshi përfundimisht"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EmployeesTable(props: {
  rows: EmployeeListRowDto[];
  onEdit: (row: EmployeeListRowDto) => void;
}) {
  const { rows, onEdit } = props;
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-white px-6 py-16 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
        <p className="text-sm font-semibold text-[#0f172a]">Nuk ka punonjës për filtrat aktualë.</p>
        <p className="mt-2 text-[13px] text-[#64748b]">Shtoni punonjës të rinj ose ndryshoni kriteret e kërkimit.</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)] md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] caption-bottom">
            <thead>
              <tr className="border-b border-[#eef2f7] bg-[#f8fafc]">
                <th className={TH}>Punonjësi</th>
                <th className={TH}>Pozita</th>
                <th className={TH}>Departamenti</th>
                <th className={TH}>Statusi</th>
                <th className={TH}>Lloji</th>
                <th className={cn(TH, "text-right")}>Paga bruto</th>
                <th className={TH}>Punësimi</th>
                <th className={cn(TH, "w-10 text-right")}>
                  <span className="sr-only">Veprime</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/punonjesit/${row.id}`)}
                  className="cursor-pointer border-b border-[#f1f5f9] transition-colors last:border-0 hover:bg-[#f8fafc]"
                >
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <EmployeeAvatar row={row} />
                      <div className="min-w-0">
                        <Link
                          href={`/punonjesit/${row.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block truncate text-[13.5px] font-semibold text-[#0f172a] hover:text-brand-blue"
                        >
                          {row.firstName} {row.lastName}
                        </Link>
                        <p className="truncate text-xs tabular-nums text-[#94a3b8]">{row.personalId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[#334155]">{row.jobTitle ?? "—"}</td>
                  <td className="px-4 py-3 text-[13px] text-[#64748b]">{row.departmentName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <EmployeeStatusBadge status={row.status} employmentType={row.employmentType} />
                  </td>
                  <td className="px-4 py-3">
                    <EmployeeTypeBadge employmentType={row.employmentType} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-[#0f172a]">
                    {formatEur(row.baseSalaryMonthly)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] tabular-nums text-[#64748b]">
                    {formatSqDate(row.hireDate)}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <RowActions row={row} onEdit={onEdit} onRefresh={() => router.refresh()} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[#eef2f7] px-4 py-3">
          <p className="text-[12.5px] text-[#64748b]">
            Shfaqen <span className="font-semibold text-[#0f172a]">{rows.length}</span> punonjës
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <div
            key={row.id}
            className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <EmployeeAvatar row={row} />
                <div className="min-w-0">
                  <Link
                    href={`/punonjesit/${row.id}`}
                    className="block truncate text-[15px] font-semibold text-[#0f172a] hover:text-brand-blue"
                  >
                    {row.firstName} {row.lastName}
                  </Link>
                  <p className="truncate text-xs tabular-nums text-[#94a3b8]">{row.personalId}</p>
                </div>
              </div>
              <RowActions row={row} onEdit={onEdit} onRefresh={() => router.refresh()} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-[#f1f5f9] pt-3 text-sm">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">Pozita</dt>
                <dd className="text-[13px] text-[#334155]">{row.jobTitle ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">Departamenti</dt>
                <dd className="text-[13px] text-[#334155]">{row.departmentName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">Statusi</dt>
                <dd className="mt-1">
                  <EmployeeStatusBadge status={row.status} employmentType={row.employmentType} />
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">Lloji</dt>
                <dd className="mt-1">
                  <EmployeeTypeBadge employmentType={row.employmentType} />
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">Paga bruto</dt>
                <dd className="text-[13px] font-semibold tabular-nums text-[#0f172a]">
                  {formatEur(row.baseSalaryMonthly)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">
                  Data e punësimit
                </dt>
                <dd className="text-[13px] tabular-nums text-[#334155]">{formatSqDate(row.hireDate)}</dd>
              </div>
            </dl>
          </div>
        ))}
        <p className="px-1 text-[12.5px] text-[#64748b]">
          Shfaqen <span className="font-semibold text-[#0f172a]">{rows.length}</span> punonjës
        </p>
      </div>
    </>
  );
}
