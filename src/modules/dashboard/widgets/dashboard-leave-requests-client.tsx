"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LeaveStatusBadge } from "@/modules/leaves/components/leave-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatSqDate } from "@/modules/employees/components/employees-labels";
import { PanelHeader } from "@/components/patterns/page-header";
import {
  approveLeaveRequestAction,
  rejectLeaveRequestAction,
} from "@/modules/leaves/actions/leave-actions";
import type { LeavePendingRow, LeaveTodayCounts } from "../types/dashboard-types";
import { LEAVE_TYPE_LABELS_SQ } from "../helpers/dashboard-labels";

export function DashboardLeaveRequestsClient(props: {
  pending: LeavePendingRow[];
  today: LeaveTodayCounts;
}) {
  const router = useRouter();

  async function run(id: string, mode: "approve" | "reject") {
    const fn = mode === "approve" ? approveLeaveRequestAction : rejectLeaveRequestAction;
    const r = await fn(id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(mode === "approve" ? "Pushimi u miratua." : "Pushimi u refuzua.");
    router.refresh();
  }

  return (
    <div id="leave-requests" className="scroll-mt-24 surface-card">
      <PanelHeader
        title="Pushimet"
        description={`Sot: ${props.today.approved} miratuar · ${props.today.rejected} refuzuar`}
      />
      {props.pending.length === 0 ? (
        <p className="surface-card-body py-8 text-center text-sm text-muted-foreground">Nuk ka kërkesa në pritje.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table className="table-dense">
            <TableHeader>
              <TableRow>
                <TableHead>Punonjësi</TableHead>
                <TableHead>Lloji</TableHead>
                <TableHead>Fillim</TableHead>
                <TableHead>Mbarim</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Veprime</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.pending.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.employeeName}</TableCell>
                  <TableCell>{LEAVE_TYPE_LABELS_SQ[row.type]}</TableCell>
                  <TableCell className="tabular-nums">{formatSqDate(row.startDateIso)}</TableCell>
                  <TableCell className="tabular-nums">{formatSqDate(row.endDateIso)}</TableCell>
                  <TableCell>
                    <LeaveStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="button" size="sm" onClick={() => void run(row.id, "approve")}>
                        Mirato
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void run(row.id, "reject")}
                      >
                        Refuzo
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/punonjesit/${row.employeeId}`}>Hap</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
