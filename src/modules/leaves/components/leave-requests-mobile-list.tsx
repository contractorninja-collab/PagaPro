"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
      <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground md:hidden">
        Nuk ka të dhëna për këtë pamje.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 md:hidden">
      {rows.map((row) => (
        <Card key={row.id} className="overflow-hidden p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-foreground">{row.employeeName}</p>
              {row.departmentName ? (
                <p className="text-xs text-muted-foreground">{row.departmentName}</p>
              ) : null}
            </div>
            <Badge variant={statusBadgeVariant(row.status)}>{LEAVE_STATUS_LABELS_SQ[row.status]}</Badge>
          </div>
          <Separator className="my-3" />
          <dl className="grid grid-cols-2 gap-x-2 gap-y-2 text-xs">
            <div>
              <dt className="text-muted-foreground">Lloji</dt>
              <dd className="font-medium">{LEAVE_TYPE_LABELS_SQ[row.type]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Ditë pune</dt>
              <dd className="font-medium tabular-nums">{row.workingDays ?? row.totalDays ?? "—"}</dd>
            </div>
            {row.subtype !== "NONE" ? (
              <div className="col-span-2">
                <dt className="text-muted-foreground">Nën-lloji</dt>
                <dd className="font-medium">{LEAVE_SUBTYPE_LABELS_SQ[row.subtype]}</dd>
              </div>
            ) : null}
            <div className="col-span-2">
              <dt className="text-muted-foreground">Periudha</dt>
              <dd className="font-medium tabular-nums">
                {formatSqDate(row.startDateIso)} → {formatSqDate(row.endDateIso)}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Ndikimi në payroll</dt>
              <dd className="text-muted-foreground">{payrollImpactLabel(row)}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border/80 pt-4">
            <Button type="button" size="sm" variant="secondary" asChild>
              <Link href={`/pushimet/${row.id}`}>Detaje</Link>
            </Button>
            {row.status === "PENDING" ? (
              <>
                <Button type="button" size="sm" onClick={() => onApprove(row.id)}>
                  Mirato
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => onReject(row.id)}>
                  Refuzo
                </Button>
              </>
            ) : null}
            {row.status === "DRAFT" || row.status === "PENDING" ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => onCancel(row.id)}>
                Anulo
              </Button>
            ) : null}
            {row.status === "APPROVED" ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => onGenerate(row.id)}>
                Dokument
              </Button>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
