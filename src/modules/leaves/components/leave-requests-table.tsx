"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatSqDate } from "@/modules/employees/components/employees-labels";
import { LEAVE_TYPE_LABELS_SQ, LEAVE_SUBTYPE_LABELS_SQ } from "@/modules/leaves/helpers/leave-type-metadata";
import { payrollImpactLabel } from "@/modules/leaves/helpers/payroll-impact-label";
import { LEAVE_STATUS_LABELS_SQ } from "@/modules/leaves/helpers/leave-status-labels";
import type { PushimetLeaveRowDto } from "@/modules/leaves/types/pushimet";

function statusBadgeVariant(status: PushimetLeaveRowDto["status"]): "default" | "secondary" | "warning" | "destructive" | "outline" {
  switch (status) {
    case "APPROVED":
      return "default";
    case "PENDING":
      return "warning";
    case "REJECTED":
      return "destructive";
    case "DRAFT":
      return "secondary";
    default:
      return "outline";
  }
}

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
      <div className="rounded-xl border border-dashed border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
        Nuk u gjet asnjë kërkesë për filtrat e zgjedhur.
      </div>
    );
  }

  return (
    <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-sm md:block">
      <Table className="table-dense">
        <TableHeader>
          <TableRow>
            <TableHead>Punonjësi</TableHead>
            <TableHead>Lloji</TableHead>
            <TableHead>Nën-lloji</TableHead>
            <TableHead>Fillimi</TableHead>
            <TableHead>Mbarimi</TableHead>
            <TableHead>Ditë</TableHead>
            <TableHead>Statusi</TableHead>
            <TableHead>Payroll</TableHead>
            <TableHead className="text-right">Veprime</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">
                <div className="flex flex-col">
                  <span>{row.employeeName}</span>
                  {row.departmentName ? (
                    <span className="text-xs font-normal text-muted-foreground">{row.departmentName}</span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>{LEAVE_TYPE_LABELS_SQ[row.type]}</TableCell>
              <TableCell className="max-w-[160px] text-xs text-muted-foreground">
                {LEAVE_SUBTYPE_LABELS_SQ[row.subtype]}
              </TableCell>
              <TableCell className="tabular-nums">{formatSqDate(row.startDateIso)}</TableCell>
              <TableCell className="tabular-nums">{formatSqDate(row.endDateIso)}</TableCell>
              <TableCell className="tabular-nums text-muted-foreground">{row.workingDays ?? row.totalDays ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={statusBadgeVariant(row.status)}>{LEAVE_STATUS_LABELS_SQ[row.status]}</Badge>
              </TableCell>
              <TableCell className="max-w-[140px] text-xs leading-snug text-muted-foreground">
                {payrollImpactLabel(row)}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="sm" variant="secondary">
                      Menu
                    </Button>
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
                      <DropdownMenuItem onClick={() => onGenerate(row.id)}>Gjenero dokument…</DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
