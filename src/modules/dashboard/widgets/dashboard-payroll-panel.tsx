import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEur } from "@/modules/employees/components/employees-labels";
import { payrollMonthLabel } from "@/modules/payroll/helpers/month-label";
import type { DashboardPayrollSlice } from "../types/dashboard-types";
import { PAYROLL_STATUS_LABELS_SQ } from "../helpers/dashboard-labels";

export function DashboardPayrollPanel({ payroll }: { payroll: DashboardPayrollSlice }) {
  const label = payrollMonthLabel(payroll.year, payroll.month);
  const statusLabel = payroll.status ? PAYROLL_STATUS_LABELS_SQ[payroll.status] : null;

  return (
    <Card className="border-border/80 shadow-none">
      <CardHeader className="flex flex-col gap-2 border-b border-border/60 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Statusi i pagës</CardTitle>
          <CardDescription className="text-sm">
            Periudha: <span className="font-medium text-foreground">{label}</span>
          </CardDescription>
        </div>
        {payroll.status ? (
          <Badge
            variant={
              payroll.status === "LOCKED" || payroll.status === "APPROVED"
                ? "success"
                : payroll.status === "DRAFT"
                  ? "warning"
                  : "secondary"
            }
            className="w-fit shrink-0"
          >
            {statusLabel}
          </Badge>
        ) : (
          <Badge variant="outline" className="w-fit">
            Pa payroll
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Punonjës në spreadsheet</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{payroll.employeeCount}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Bruto totale</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatEur(payroll.totals.grossSalary)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Kosto punëdhënësi</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatEur(payroll.totals.employerTotalCost)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
          <Button size="sm" asChild>
            <Link href="/pagat">Hap pagat</Link>
          </Button>
          {payroll.payrollId ? (
            <>
              <Button size="sm" variant="secondary" asChild>
                <Link href={`/pagat/${payroll.payrollId}`}>Vazhdo shqyrtimin</Link>
              </Button>
              <Button size="sm" variant="secondary" asChild>
                <Link href={`/pagat/${payroll.payrollId}`}>Gjenero eksporte</Link>
              </Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" asChild>
              <Link href="/pagat">Krijo payroll për muajin</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
