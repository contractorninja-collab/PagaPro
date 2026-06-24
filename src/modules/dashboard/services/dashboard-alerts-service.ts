import { payrollMonthLabel } from "@/modules/payroll/helpers/month-label";
import type { DashboardOperationalPayload, OperationalAlert } from "../types/dashboard-types";
export type AlertBuilderInput = Omit<DashboardOperationalPayload, "alerts"> & {
  payrollSettingsPresent: boolean;
  belowMinimumEmployees: number;
  documentsMissingEmployees: number;
  openPayrollCorrections: number;
  expiringContractsTotal: number;
  payrollRowExists: boolean;
};

export function buildOperationalAlerts(input: AlertBuilderInput): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  const periodLabel = payrollMonthLabel(input.filters.year, input.filters.month);

  if (input.expiringContractsTotal > 0) {
    alerts.push({
      id: "contracts-expiring",
      severity: input.contractExpiries.some((c) => c.urgency === "7") ? "critical" : "warning",
      title: `${input.expiringContractsTotal} kontrata në skadencë (30 ditë)`,
      detail: "Rishikoni listën dhe planifikoni rinovimin.",
      href: "#contracts-expiry",
    });
  }

  if (input.payrollRowExists && input.payroll.status === "DRAFT") {
    alerts.push({
      id: "payroll-draft",
      severity: "warning",
      title: `Pagë «${periodLabel}» ende në draft`,
      detail: "Plotësoni shpërndarjen dhe kaloni në shqyrtim ose miratim.",
      href: input.payroll.payrollId ? `/pagat/${input.payroll.payrollId}` : "/pagat",
    });
  }

  if (input.payrollRowExists && input.payroll.status === "REVIEWED") {
    alerts.push({
      id: "payroll-reviewed",
      severity: "info",
      title: `Pagë «${periodLabel}» në shqyrtim`,
      detail: "Miratoni para kyçjes përfundimtare.",
      href: input.payroll.payrollId ? `/pagat/${input.payroll.payrollId}` : "/pagat",
    });
  }

  if (!input.payrollSettingsPresent) {
    alerts.push({
      id: "payroll-settings-missing",
      severity: "warning",
      title: "Parametrat operativë të pagës mungojnë",
      detail: "Plotësoni konfigurimin e kompanisë / pagës për validimin e minimaljes.",
      href: "/konfigurime",
    });
  }

  if (input.belowMinimumEmployees > 0) {
    alerts.push({
      id: "below-minimum-salary",
      severity: "critical",
      title: `${input.belowMinimumEmployees} punonjës nën pagën minimale të konfiguruar`,
      detail: "Verifikoni bazën mujore bruto kundrejt politikës aktive.",
      href: "/punonjesit",
    });
  }

  if (input.documentsMissingEmployees > 0) {
    alerts.push({
      id: "documents-missing-flag",
      severity: "warning",
      title: `${input.documentsMissingEmployees} punonjës me dokumentacion të shënuar si «mungon»`,
      detail: "Plotësoni dosjet për përputhshmëri operative.",
      href: "/punonjesit",
    });
  }

  if (input.openPayrollCorrections > 0) {
    alerts.push({
      id: "payroll-corrections-open",
      severity: "info",
      title: `${input.openPayrollCorrections} korrigjime pagë në payroll të hapura`,
      detail: "Shqyrtimi i korrigjimeve përpara kyçjes përfundimtare.",
      href: "/pagat",
    });
  }

  if (input.summary.leaveRequestsPending > 0) {
    alerts.push({
      id: "leave-backlog",
      severity: "info",
      title: `${input.summary.leaveRequestsPending} kërkesa pushimi në pritje`,
      detail: "Miratoni ose refuzoni për të mbajtur kalendarin të saktë.",
      href: "#leave-requests",
    });
  }

  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}
