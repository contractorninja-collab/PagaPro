import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatEur } from "@/modules/employees/components/employees-labels";
import { payrollMonthLabel } from "@/modules/payroll/helpers/month-label";
import { PayrollStatusBadge } from "@/modules/payroll/components/payroll-status-badge";
import type { DashboardPayrollSlice } from "../types/dashboard-types";

export function DashboardPayrollPanel({ payroll }: { payroll: DashboardPayrollSlice }) {
  const label = payrollMonthLabel(payroll.year, payroll.month);
  const hasPayroll = payroll.payrollId != null && payroll.status != null;

  return (
    <section
      aria-labelledby="dashboard-payroll-hero-title"
      className="surface-card payroll-card"
    >
      <div className="payroll-card-content">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="dashboard-payroll-hero-title" className="text-lg font-bold leading-tight text-[#0f172a]">
            Payroll — {label}
          </h2>
          {payroll.status ? (
            <PayrollStatusBadge status={payroll.status} />
          ) : (
            <Badge variant="muted">Pa payroll</Badge>
          )}
        </div>

        <dl className="payroll-metrics">
          <div>
            <dt className="sr-only">Punonjës</dt>
            <dd className="payroll-metric">
              {payroll.employeeCount} punonjës
            </dd>
          </div>
          <div>
            <dt className="sr-only">Bruto totale</dt>
            <dd className="payroll-metric">{formatEur(payroll.totals.grossSalary)} bruto</dd>
          </div>
          <div>
            <dt className="sr-only">Kosto punëdhënësi</dt>
            <dd className="payroll-metric">{formatEur(payroll.totals.employerTotalCost)} kosto punëdhënësi</dd>
          </div>
        </dl>

        <div className="payroll-actions">
          <Button size="sm" asChild>
            <Link href="/pagat">Hap pagat</Link>
          </Button>
          {hasPayroll ? (
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
      </div>
    </section>
  );
}

export function DashboardPayrollPanelSkeleton() {
  return (
    <div aria-hidden className="surface-card payroll-card">
      <div className="payroll-card-content">
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-6 w-52 max-w-full rounded bg-muted" />
          <div className="h-6 w-20 rounded-full bg-muted" />
        </div>
        <div className="payroll-metrics">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-5 w-full max-w-[160px] rounded bg-muted" />
          ))}
        </div>
        <div className="payroll-actions">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 w-28 rounded-md bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
