"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
    <div id="leave-requests" className="scroll-mt-24 rounded-lg border border-border/80 bg-card">
      <div className="flex flex-col gap-2 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Pushimet</h2>
          <p className="text-xs text-muted-foreground">
            Sot: <span className="font-medium text-foreground">{props.today.approved}</span> miratuar ·{" "}
            <span className="font-medium text-foreground">{props.today.rejected}</span> refuzuar
          </p>
        </div>
      </div>
      {props.pending.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nuk ka kërkesa në pritje.</p>
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
                    <Badge variant="warning">Në pritje</Badge>
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
