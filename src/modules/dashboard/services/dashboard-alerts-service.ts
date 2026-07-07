import { payrollMonthLabel } from "@/modules/payroll/helpers/month-label";
import type { DashboardOperationalPayload, DocumentsMissingEmployeeRef, OperationalAlert } from "../types/dashboard-types";
import { missingDocsHref } from "./dashboard-missing-docs-routing";
export type AlertBuilderInput = Omit<DashboardOperationalPayload, "alerts" | "recommendedActions"> & {
  payrollSettingsPresent: boolean;
  belowMinimumEmployees: number;
  documentsMissingEmployees: DocumentsMissingEmployeeRef[];
  openPayrollCorrections: number;
  expiringContractsTotal: number;
  payrollRowExists: boolean;
  registerPdfGenerated: boolean;
};

export function buildOperationalAlerts(input: AlertBuilderInput): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  const periodLabel = payrollMonthLabel(input.filters.year, input.filters.month);
  const payrollHref = input.payroll.payrollId ? `/pagat/${input.payroll.payrollId}` : "/pagat";
  const status = input.payroll.status;

  if (!input.payrollRowExists) {
    alerts.push({
      id: "payroll-missing",
      severity: "warning",
      title: `Nuk ka payroll për ${periodLabel}`,
      detail: "Krijoni payroll-in për periudhën e zgjedhur.",
      href: "/pagat",
      actionLabel: "Krijo payroll-in",
    });
  }

  if (input.expiringContractsTotal > 0) {
    alerts.push({
      id: "contracts-expiring",
      severity: input.contractExpiries.some((c) => c.urgency === "7") ? "critical" : "warning",
      title: `${input.expiringContractsTotal} kontrata në skadencë (30 ditë)`,
      detail: "Rishikoni listën dhe planifikoni rinovimin.",
      href: "#contracts-expiry",
      actionLabel: "Shiko kontratat",
    });
  }

  if (input.payrollRowExists && input.payroll.status === "DRAFT") {
    alerts.push({
      id: "payroll-draft",
      severity: "warning",
      title: `Pagë «${periodLabel}» ende në draft`,
      detail: "Plotësoni shpërndarjen dhe kaloni në shqyrtim ose miratim.",
      href: input.payroll.payrollId ? `/pagat/${input.payroll.payrollId}` : "/pagat",
      actionLabel: "Vazhdo payroll-in",
    });
  }

  if (input.payrollRowExists && input.payroll.status === "REVIEWED") {
    alerts.push({
      id: "payroll-reviewed",
      severity: "info",
      title: `Pagë «${periodLabel}» në shqyrtim`,
      detail: "Miratoni para kyçjes përfundimtare.",
      href: payrollHref,
      actionLabel: "Mirato pagat",
    });
  }

  if (input.payrollRowExists && input.payroll.status === "APPROVED") {
    alerts.push({
      id: "payroll-approved",
      severity: "warning",
      title: `Pagë «${periodLabel}» e miratuar — kërkon kyçje`,
      detail: "Përfundoni miratimin përpara eksportit zyrtar.",
      href: payrollHref,
      actionLabel: "Përfundo pagat",
    });
  }

  if (
    input.payrollRowExists &&
    input.payroll.payrollId &&
    !input.registerPdfGenerated &&
    status != null &&
    ["REVIEWED", "APPROVED", "LOCKED"].includes(status)
  ) {
    alerts.push({
      id: "register-pdf-missing",
      severity: "info",
      title: "Lista e pagave për financa nuk është gjeneruar",
      detail: "Gjeneroni PDF-in me totale për departamentin financiar.",
      href: payrollHref,
      actionLabel: "Gjenero listën",
    });
  }

  if (!input.payrollSettingsPresent) {
    alerts.push({
      id: "payroll-settings-missing",
      severity: "warning",
      title: "Parametrat operativë të pagës mungojnë",
      detail: "Plotësoni konfigurimin e kompanisë për validimin e pagës.",
      href: "/konfigurime",
      actionLabel: "Hap konfigurimin",
    });
  }

  if (input.belowMinimumEmployees > 0) {
    const n = input.belowMinimumEmployees;
    alerts.push({
      id: "below-minimum-salary",
      severity: "critical",
      title:
        n === 1
          ? "1 punonjës nën pagën minimale të konfiguruar"
          : `${n} punonjës nën pagën minimale të konfiguruar`,
      detail: "Verifikoni bazën mujore bruto kundrejt politikës aktive.",
      href: "/punonjesit",
      actionLabel: "Shiko punonjësit",
    });
  }

  if (input.documentsMissingEmployees.length > 0) {
    const employees = input.documentsMissingEmployees;
    const n = employees.length;
    const single = n === 1 ? employees[0]! : null;
    alerts.push({
      id: "documents-missing-flag",
      severity: "warning",
      title:
        single != null
          ? `${single.fullName} ka dokumentacion të paplotë`
          : `${n} punonjës kanë dokumentacion të paplotë`,
      detail: "Kjo mund të ndikojë në raportet operative.",
      href: missingDocsHref(employees),
      actionLabel: n === 1 ? "Rishiko punonjësin" : "Rishiko punonjësit",
    });
  }

  if (input.openPayrollCorrections > 0) {
    alerts.push({
      id: "payroll-corrections-open",
      severity: "info",
      title: `${input.openPayrollCorrections} korrigjime pagë të hapura`,
      detail: "Shqyrtimi i korrigjimeve përpara kyçjes përfundimtare.",
      href: "/pagat",
      actionLabel: "Shiko korrigjimet",
    });
  }

  if (input.summary.leaveRequestsPending > 0) {
    const n = input.summary.leaveRequestsPending;
    alerts.push({
      id: "leave-backlog",
      severity: "info",
      title:
        n === 1 ? "1 kërkesë pushimi në pritje" : `${n} kërkesa pushimi në pritje`,
      detail: "Miratoni ose refuzoni për të mbajtur kalendarin të saktë.",
      href: "#leave-requests",
      actionLabel: "Shiko pushimet",
    });
  }

  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  if (alerts.length === 0 && input.payrollRowExists && status === "LOCKED") {
    alerts.push({
      id: "payroll-locked-ok",
      severity: "info",
      title: `Pagë «${periodLabel}» e kyçur`,
      detail: "Asnjë veprim i menjëhershëm — mund të shikoni detajet ose eksportet.",
      href: payrollHref,
      actionLabel: "Shiko payroll-in",
    });
  }

  return alerts;
}
