import Link from "next/link";
import { Badge } from "@/components/ui/badge";
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
import type { ContractExpiryRow } from "../types/dashboard-types";
import { CONTRACT_KIND_LABELS_SQ } from "../helpers/dashboard-labels";

export function DashboardContractExpiryTable({ rows }: { rows: ContractExpiryRow[] }) {
  return (
    <div id="contracts-expiry" className="scroll-mt-24 surface-card flex h-full flex-col">
      <PanelHeader
        title="Kontrata që skadojnë së shpejti"
        description="Lista operative për rinovim."
      />
      {rows.length === 0 ? (
        <p className="surface-card-body py-8 text-center text-sm text-muted-foreground">
          Nuk ka kontrata aktive me datë mbarimi në këtë dritare.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table className="table-dense">
            <TableHeader>
              <TableRow>
                <TableHead>Punonjësi</TableHead>
                <TableHead>Pozita</TableHead>
                <TableHead>Lloji</TableHead>
                <TableHead>Skadenca</TableHead>
                <TableHead className="text-right">Ditë</TableHead>
                <TableHead className="text-right">Veprime</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.contractId}>
                  <TableCell className="font-medium">{r.employeeName}</TableCell>
                  <TableCell className="text-muted-foreground">{r.jobTitle ?? "—"}</TableCell>
                  <TableCell>{CONTRACT_KIND_LABELS_SQ[r.contractKind]}</TableCell>
                  <TableCell className="tabular-nums">{formatSqDate(r.endDateIso)}</TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={r.urgency === "7" ? "destructive" : r.urgency === "14" ? "warning" : "muted"}
                    >
                      {r.daysRemaining}d
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href="/dokumentet"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Rinovo
                      </Link>
                      <Link
                        href={`/punonjesit/${r.employeeId}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Hap profilin
                      </Link>
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
