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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
      <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">Nuk ka punonjës për filtrat aktualë.</p>
        <p className="mt-2 text-sm text-muted-foreground">Shtoni punonjës të rinj ose ndryshoni kriteret e kërkimit.</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Emri dhe mbiemri</TableHead>
              <TableHead>Pozita</TableHead>
              <TableHead>Departamenti</TableHead>
              <TableHead>Statusi</TableHead>
              <TableHead>Lloji</TableHead>
              <TableHead className="text-right">Paga bruto</TableHead>
              <TableHead>Punësimi</TableHead>
              <TableHead className="w-[72px] text-right">Veprime</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <Link href={`/punonjesit/${row.id}`} className="text-primary hover:underline">
                    {row.firstName} {row.lastName}
                  </Link>
                  <p className="text-xs text-muted-foreground">{row.personalId}</p>
                </TableCell>
                <TableCell>{row.jobTitle ?? "—"}</TableCell>
                <TableCell>{row.departmentName ?? "—"}</TableCell>
                <TableCell>
                  <EmployeeStatusBadge status={row.status} employmentType={row.employmentType} />
                </TableCell>
                <TableCell>
                  <EmployeeTypeBadge employmentType={row.employmentType} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatEur(row.baseSalaryMonthly)}</TableCell>
                <TableCell>{formatSqDate(row.hireDate)}</TableCell>
                <TableCell className="text-right">
                  <RowActions row={row} onEdit={onEdit} onRefresh={() => router.refresh()} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <div key={row.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link href={`/punonjesit/${row.id}`} className="text-base font-semibold text-primary hover:underline">
                  {row.firstName} {row.lastName}
                </Link>
                <p className="text-xs text-muted-foreground">{row.personalId}</p>
              </div>
              <RowActions row={row} onEdit={onEdit} onRefresh={() => router.refresh()} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Pozita</dt>
                <dd>{row.jobTitle ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Departamenti</dt>
                <dd>{row.departmentName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Statusi</dt>
                <dd className="mt-1">
                  <EmployeeStatusBadge status={row.status} employmentType={row.employmentType} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Lloji</dt>
                <dd className="mt-1">
                  <EmployeeTypeBadge employmentType={row.employmentType} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Paga bruto</dt>
                <dd className="tabular-nums font-medium">{formatEur(row.baseSalaryMonthly)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Data e punësimit</dt>
                <dd>{formatSqDate(row.hireDate)}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}
