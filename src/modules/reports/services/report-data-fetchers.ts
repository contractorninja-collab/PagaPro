import type {
  ContractStatus,
  DocumentCategory,
  EmploymentStatus,
  EmploymentType,
  LeaveRequestStatus,
  LeaveType,
  ReportType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EmployeeListFilters } from "@/modules/reports/validators/report-schemas";
import type { FetchRowsResult, ReportColumnDef, ReportFetcherContext, ReportRow } from "@/modules/reports/types";
import { resolvePayrollPeriodRows } from "@/modules/reports/services/payroll-report-source";
import { filterAtkEligibleRows } from "@/modules/payroll/atk/mappers/payroll-entry-to-atk-row";
import type {
  ContractExpiryFilters,
  DocumentListFilters,
  LeaveYearFilters,
  PayrollPeriodFilters,
  TerminationMonthFilters,
} from "@/modules/reports/validators/report-schemas";

const euro = (s: string) => s;

function employeeColumns(): ReportColumnDef[] {
  return [
    { key: "personalId", headerSq: "Numri personal" },
    { key: "firstName", headerSq: "Emri" },
    { key: "lastName", headerSq: "Mbiemri" },
    { key: "department", headerSq: "Departamenti" },
    { key: "jobTitle", headerSq: "Pozicioni" },
    { key: "employmentType", headerSq: "Lloji" },
    { key: "status", headerSq: "Statusi" },
    { key: "hireDate", headerSq: "Data e punësimit" },
    { key: "terminationDate", headerSq: "Data e largimit" },
    { key: "email", headerSq: "Email" },
    { key: "phone", headerSq: "Telefon" },
    { key: "documentsMissing", headerSq: "Dok. mungojnë" },
  ];
}

async function loadEmployees(
  companyId: string,
  filters: EmployeeListFilters,
  extraWhere?: { status?: EmploymentStatus; employmentType?: EmploymentType; documentsMissing?: boolean },
): Promise<ReportRow[]> {
  const rows = await prisma.employee.findMany({
    where: {
      companyId,
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.employeeId ? { id: filters.employeeId } : {}),
      ...(filters.employmentStatus ? { status: filters.employmentStatus } : {}),
      ...(filters.employmentType ? { employmentType: filters.employmentType } : {}),
      ...(extraWhere?.status ? { status: extraWhere.status } : {}),
      ...(extraWhere?.employmentType ? { employmentType: extraWhere.employmentType } : {}),
      ...(extraWhere?.documentsMissing !== undefined ? { documentsMissing: extraWhere.documentsMissing } : {}),
    },
    include: { department: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return rows.map((e) => ({
    personalId: e.personalId,
    firstName: e.firstName,
    lastName: e.lastName,
    department: e.department?.name ?? "",
    jobTitle: e.jobTitle ?? "",
    employmentType: e.employmentType,
    status: e.status,
    hireDate: e.hireDate.toISOString().slice(0, 10),
    terminationDate: e.terminationDate?.toISOString().slice(0, 10) ?? "",
    email: e.email ?? "",
    phone: e.phone ?? "",
    documentsMissing: e.documentsMissing ? "Po" : "Jo",
  }));
}

export async function fetchEmployeeReport(
  ctx: ReportFetcherContext,
  filters: EmployeeListFilters,
  kind: ReportType,
): Promise<FetchRowsResult> {
  const cols = employeeColumns();
  let rows: ReportRow[] = [];
  switch (kind) {
    case "LISTA_PUNONJESVE":
      rows = await loadEmployees(ctx.companyId, filters);
      break;
    case "PUNONJES_AKTIVE":
      rows = await loadEmployees(ctx.companyId, filters, { status: "ACTIVE" });
      break;
    case "PUNONJES_TE_LARGUAR":
      rows = await loadEmployees(ctx.companyId, filters, { status: "TERMINATED" });
      break;
    case "KONTRAKTORE":
      rows = await loadEmployees(ctx.companyId, filters, { employmentType: "CONTRACTOR" });
      break;
    case "PUNONJES_ME_DOKUMENTE_QE_MUNGOJNE":
      rows = await loadEmployees(ctx.companyId, filters, { documentsMissing: true });
      break;
    case "PUNONJES_SIPAS_DEPARTAMENTIT": {
      rows = await loadEmployees(ctx.companyId, filters);
      rows.sort((a, b) => String(a.department).localeCompare(String(b.department)));
      break;
    }
    default:
      rows = [];
  }
  return { columns: cols, rows };
}

export async function fetchPayrollSummaryReport(
  ctx: ReportFetcherContext,
  filters: PayrollPeriodFilters,
  withAmounts: boolean,
): Promise<FetchRowsResult> {
  const { rows } = await resolvePayrollPeriodRows(ctx.companyId, filters.payrollId);

  const colsFull: ReportColumnDef[] = [
    { key: "personalId", headerSq: "Numri personal" },
    { key: "employeeName", headerSq: "Punonjësi" },
    { key: "grossSalary", headerSq: "Bruto" },
    { key: "taxableIncome", headerSq: "Baza tatimore" },
    { key: "pitWithheld", headerSq: "PIT" },
    { key: "pensionEmployee", headerSq: "Pension (pun.)" },
    { key: "pensionEmployer", headerSq: "Pension (punëdh.)" },
    { key: "netPay", headerSq: "Neto" },
  ];

  const colsSign: ReportColumnDef[] = [
    { key: "personalId", headerSq: "Numri personal" },
    { key: "employeeName", headerSq: "Punonjësi" },
  ];

  const cols = withAmounts ? colsFull : colsSign;

  let mapped: ReportRow[];
  if (withAmounts) {
    mapped = rows.map((r) => ({
      personalId: r.personalId,
      employeeName: r.employeeName,
      grossSalary: euro(r.grossSalary),
      taxableIncome: euro(r.taxableIncome),
      pitWithheld: euro(r.pitWithheld),
      pensionEmployee: euro(r.pensionEmployee),
      pensionEmployer: euro(r.pensionEmployer),
      netPay: euro(r.netPay),
    }));
  } else {
    mapped = rows.map((r) => ({
      personalId: r.personalId,
      employeeName: r.employeeName,
    }));
  }

  return { columns: cols, rows: mapped };
}

export async function fetchFinanceWorkbookData(
  ctx: ReportFetcherContext,
  filters: PayrollPeriodFilters,
): Promise<{ summary: FetchRowsResult; detail: FetchRowsResult }> {
  const { rows } = await resolvePayrollPeriodRows(ctx.companyId, filters.payrollId);

  const summaryColumns: ReportColumnDef[] = [
    { key: "employeeName", headerSq: "Punonjësi" },
    { key: "grossSalary", headerSq: "Bruto" },
    { key: "netPay", headerSq: "Neto" },
    { key: "employerTotalCost", headerSq: "Kosto punëdhënës" },
    { key: "pitWithheld", headerSq: "PIT" },
    { key: "pensionEmployee", headerSq: "Pension pun." },
    { key: "pensionEmployer", headerSq: "Pension punëdh." },
  ];

  const summaryRows: ReportRow[] = rows.map((r) => ({
    employeeName: r.employeeName,
    grossSalary: euro(r.grossSalary),
    netPay: euro(r.netPay),
    employerTotalCost: euro(r.employerTotalCost || r.grossSalary),
    pitWithheld: euro(r.pitWithheld),
    pensionEmployee: euro(r.pensionEmployee),
    pensionEmployer: euro(r.pensionEmployer),
  }));

  const detailColumns: ReportColumnDef[] = [
    { key: "employeeName", headerSq: "Punonjësi" },
    { key: "personalId", headerSq: "NIPT personal" },
    { key: "grossSalary", headerSq: "Bruto" },
    { key: "bonuses", headerSq: "Bonus" },
    { key: "otherDeductions", headerSq: "Zbritje" },
    { key: "salaryAdvanceDeduction", headerSq: "Parapaguesë" },
    { key: "adjustmentsJson", headerSq: "Rregullime (JSON)" },
    { key: "breakdownJson", headerSq: "Breakdown (JSON)" },
  ];

  const detailRows: ReportRow[] = rows.map((r) => ({
    employeeName: r.employeeName,
    personalId: r.personalId,
    grossSalary: euro(r.grossSalary),
    bonuses: euro(r.bonuses),
    otherDeductions: euro(r.otherDeductions),
    salaryAdvanceDeduction: euro(r.salaryAdvanceDeduction),
    adjustmentsJson: r.adjustmentsJson.slice(0, 500),
    breakdownJson: r.breakdownJson.slice(0, 800),
  }));

  return {
    summary: { columns: summaryColumns, rows: summaryRows },
    detail: { columns: detailColumns, rows: detailRows },
  };
}

export async function fetchTrustTaxReport(ctx: ReportFetcherContext, filters: PayrollPeriodFilters): Promise<FetchRowsResult> {
  const { rows } = await resolvePayrollPeriodRows(ctx.companyId, filters.payrollId);
  const cols: ReportColumnDef[] = [
    { key: "employeeName", headerSq: "Punonjësi" },
    { key: "personalId", headerSq: "Numri personal" },
    { key: "applyTrust", headerSq: "Trust (Po/Jo)" },
    { key: "applyTax", headerSq: "Tatim (Po/Jo)" },
    { key: "taxableIncome", headerSq: "Baza tatimore" },
    { key: "pitWithheld", headerSq: "PIT të mbajtur" },
    { key: "pensionEmployee", headerSq: "Pension punënjës" },
    { key: "pensionEmployer", headerSq: "Pension punëdhënës" },
  ];
  const mapped = rows.map((r) => ({
    employeeName: r.employeeName,
    personalId: r.personalId,
    applyTrust: r.applyTrust ? "Po" : "Jo",
    applyTax: r.applyTax ? "Po" : "Jo",
    taxableIncome: euro(r.taxableIncome),
    pitWithheld: euro(r.pitWithheld),
    pensionEmployee: euro(r.pensionEmployee),
    pensionEmployer: euro(r.pensionEmployer),
  }));
  return { columns: cols, rows: mapped };
}

export async function fetchEmployerCostReport(ctx: ReportFetcherContext, filters: PayrollPeriodFilters): Promise<FetchRowsResult> {
  const { rows } = await resolvePayrollPeriodRows(ctx.companyId, filters.payrollId);
  const cols: ReportColumnDef[] = [
    { key: "employeeName", headerSq: "Punonjësi" },
    { key: "grossSalary", headerSq: "Bruto" },
    { key: "pensionEmployer", headerSq: "Pension punëdhënës" },
    { key: "otherEmployerCosts", headerSq: "Kosto të tjera" },
    { key: "employerTotalCost", headerSq: "Total kosto punëdhënës" },
  ];
  return {
    columns: cols,
    rows: rows.map((r) => ({
      employeeName: r.employeeName,
      grossSalary: euro(r.grossSalary),
      pensionEmployer: euro(r.pensionEmployer),
      otherEmployerCosts: euro(r.otherEmployerCosts),
      employerTotalCost: euro(r.employerTotalCost || r.grossSalary),
    })),
  };
}

export async function fetchSalaryAdvanceReport(ctx: ReportFetcherContext, filters: PayrollPeriodFilters): Promise<FetchRowsResult> {
  const { rows } = await resolvePayrollPeriodRows(ctx.companyId, filters.payrollId);
  const cols: ReportColumnDef[] = [
    { key: "employeeName", headerSq: "Punonjësi" },
    { key: "personalId", headerSq: "Numri personal" },
    { key: "salaryAdvanceDeduction", headerSq: "Zbritje parapaguesë" },
    { key: "netPay", headerSq: "Neto" },
  ];
  return {
    columns: cols,
    rows: rows.map((r) => ({
      employeeName: r.employeeName,
      personalId: r.personalId,
      salaryAdvanceDeduction: euro(r.salaryAdvanceDeduction),
      netPay: euro(r.netPay),
    })),
  };
}

export async function fetchAtkPreviewRows(ctx: ReportFetcherContext, filters: PayrollPeriodFilters): Promise<FetchRowsResult> {
  const payroll = await prisma.payroll.findFirst({
    where: { id: filters.payrollId, companyId: ctx.companyId },
    include: {
      entries: {
        include: {
          employee: { select: { firstName: true, lastName: true, personalId: true, applyTrust: true, applyTax: true } },
        },
      },
    },
  });
  if (!payroll) throw new Error("Payroll nuk u gjet.");
  if (payroll.status !== "APPROVED" && payroll.status !== "LOCKED") {
    throw new Error("Preview ATK kërkon payroll APPROVED ose LOCKED.");
  }
  const eligible = filterAtkEligibleRows(payroll.entries);
  const cols: ReportColumnDef[] = [
    { key: "firstName", headerSq: "Emri" },
    { key: "lastName", headerSq: "Mbiemri" },
    { key: "personalId", headerSq: "Numri personal" },
    { key: "grossSalary", headerSq: "Bruto" },
    { key: "pensionEmployee", headerSq: "Pension pun." },
    { key: "pensionEmployer", headerSq: "Pension punëdh." },
  ];
  return {
    columns: cols,
    rows: eligible.map((e) => ({
      firstName: e.employee.firstName,
      lastName: e.employee.lastName,
      personalId: e.employee.personalId,
      grossSalary: e.grossSalary.toString(),
      pensionEmployee: e.pensionEmployee.toString(),
      pensionEmployer: e.pensionEmployer.toString(),
    })),
  };
}

export async function fetchLeaveByEmployee(ctx: ReportFetcherContext, filters: LeaveYearFilters): Promise<FetchRowsResult> {
  const reqs = await prisma.leaveRequest.findMany({
    where: {
      companyId: ctx.companyId,
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      startDate: {
        gte: new Date(`${filters.year}-01-01`),
        lte: new Date(`${filters.year}-12-31T23:59:59.999Z`),
      },
      ...(filters.departmentId ? { employee: { departmentId: filters.departmentId } } : {}),
    },
    include: { employee: { include: { department: true } } },
    orderBy: [{ startDate: "asc" }],
  });

  const cols: ReportColumnDef[] = [
    { key: "employeeName", headerSq: "Punonjësi" },
    { key: "department", headerSq: "Departamenti" },
    { key: "type", headerSq: "Lloji" },
    { key: "status", headerSq: "Statusi" },
    { key: "startDate", headerSq: "Nga" },
    { key: "endDate", headerSq: "Deri" },
    { key: "workingDays", headerSq: "Ditë pune" },
    { key: "isPaid", headerSq: "E paguar" },
  ];

  return {
    columns: cols,
    rows: reqs.map((r) => ({
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      department: r.employee.department?.name ?? "",
      type: r.type,
      status: r.status,
      startDate: r.startDate.toISOString().slice(0, 10),
      endDate: r.endDate.toISOString().slice(0, 10),
      workingDays: r.workingDays?.toString() ?? "",
      isPaid: r.isPaid ? "Po" : "Jo",
    })),
  };
}

export async function fetchAnnualLeaveUsed(ctx: ReportFetcherContext, filters: LeaveYearFilters): Promise<FetchRowsResult> {
  const reqs = await prisma.leaveRequest.findMany({
    where: {
      companyId: ctx.companyId,
      type: "PUSHIM_VJETOR" satisfies LeaveType,
      status: "APPROVED" satisfies LeaveRequestStatus,
      startDate: {
        gte: new Date(`${filters.year}-01-01`),
        lte: new Date(`${filters.year}-12-31T23:59:59.999Z`),
      },
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    },
    include: { employee: true },
  });

  const cols: ReportColumnDef[] = [
    { key: "employeeName", headerSq: "Punonjësi" },
    { key: "totalWorkingDays", headerSq: "Ditë të shfrytëzuara" },
    { key: "requests", headerSq: "Numri kërkesave" },
  ];

  const map = new Map<string, { days: number; count: number }>();
  for (const r of reqs) {
    const name = `${r.employee.firstName} ${r.employee.lastName}`;
    const d = Number(r.workingDays ?? r.totalDays ?? 0);
    const prev = map.get(name) ?? { days: 0, count: 0 };
    map.set(name, { days: prev.days + d, count: prev.count + 1 });
  }

  const rows: ReportRow[] = [...map.entries()].map(([employeeName, v]) => ({
    employeeName,
    totalWorkingDays: v.days,
    requests: v.count,
  }));

  return { columns: cols, rows };
}

export async function fetchLeavePending(ctx: ReportFetcherContext, filters: LeaveYearFilters): Promise<FetchRowsResult> {
  const reqs = await prisma.leaveRequest.findMany({
    where: {
      companyId: ctx.companyId,
      status: { in: ["DRAFT", "PENDING"] },
      startDate: {
        gte: new Date(`${filters.year}-01-01`),
        lte: new Date(`${filters.year}-12-31T23:59:59.999Z`),
      },
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    },
    include: { employee: { include: { department: true } } },
    orderBy: { startDate: "asc" },
  });

  const cols: ReportColumnDef[] = [
    { key: "employeeName", headerSq: "Punonjësi" },
    { key: "type", headerSq: "Lloji" },
    { key: "status", headerSq: "Statusi" },
    { key: "startDate", headerSq: "Nga" },
    { key: "endDate", headerSq: "Deri" },
  ];

  return {
    columns: cols,
    rows: reqs.map((r) => ({
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      type: r.type,
      status: r.status,
      startDate: r.startDate.toISOString().slice(0, 10),
      endDate: r.endDate.toISOString().slice(0, 10),
    })),
  };
}

export async function fetchMedicalLeave(ctx: ReportFetcherContext, filters: LeaveYearFilters): Promise<FetchRowsResult> {
  const reqs = await prisma.leaveRequest.findMany({
    where: {
      companyId: ctx.companyId,
      type: "PUSHIM_MJEKESOR",
      startDate: {
        gte: new Date(`${filters.year}-01-01`),
        lte: new Date(`${filters.year}-12-31T23:59:59.999Z`),
      },
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    },
    include: { employee: true },
    orderBy: { startDate: "desc" },
  });
  const cols: ReportColumnDef[] = [
    { key: "employeeName", headerSq: "Punonjësi" },
    { key: "status", headerSq: "Statusi" },
    { key: "startDate", headerSq: "Nga" },
    { key: "endDate", headerSq: "Deri" },
    { key: "workingDays", headerSq: "Ditë pune" },
  ];
  return {
    columns: cols,
    rows: reqs.map((r) => ({
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      status: r.status,
      startDate: r.startDate.toISOString().slice(0, 10),
      endDate: r.endDate.toISOString().slice(0, 10),
      workingDays: r.workingDays?.toString() ?? "",
    })),
  };
}

export async function fetchUnpaidLeave(ctx: ReportFetcherContext, filters: LeaveYearFilters): Promise<FetchRowsResult> {
  const reqs = await prisma.leaveRequest.findMany({
    where: {
      companyId: ctx.companyId,
      OR: [{ type: "PUSHIM_PA_PAGESE" }, { isPaid: false }],
      startDate: {
        gte: new Date(`${filters.year}-01-01`),
        lte: new Date(`${filters.year}-12-31T23:59:59.999Z`),
      },
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    },
    include: { employee: true },
    orderBy: { startDate: "desc" },
  });
  const cols: ReportColumnDef[] = [
    { key: "employeeName", headerSq: "Punonjësi" },
    { key: "type", headerSq: "Lloji" },
    { key: "status", headerSq: "Statusi" },
    { key: "startDate", headerSq: "Nga" },
    { key: "endDate", headerSq: "Deri" },
    { key: "isPaid", headerSq: "E paguar" },
  ];
  return {
    columns: cols,
    rows: reqs.map((r) => ({
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      type: r.type,
      status: r.status,
      startDate: r.startDate.toISOString().slice(0, 10),
      endDate: r.endDate.toISOString().slice(0, 10),
      isPaid: r.isPaid ? "Po" : "Jo",
    })),
  };
}

export async function fetchLeaveBalances(ctx: ReportFetcherContext, filters: LeaveYearFilters): Promise<FetchRowsResult> {
  const bals = await prisma.leaveBalance.findMany({
    where: {
      companyId: ctx.companyId,
      year: filters.year,
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.departmentId ? { employee: { departmentId: filters.departmentId } } : {}),
    },
    include: { employee: { include: { department: true } } },
    orderBy: [{ employee: { lastName: "asc" } }],
  });

  const cols: ReportColumnDef[] = [
    { key: "employeeName", headerSq: "Punonjësi" },
    { key: "department", headerSq: "Departamenti" },
    { key: "leaveType", headerSq: "Lloji i pushimit" },
    { key: "yearlyQuota", headerSq: "Kuota vjetore" },
    { key: "usedDays", headerSq: "Ditë të përdorura" },
    { key: "remainingDays", headerSq: "Të mbetura" },
    { key: "carryOverDays", headerSq: "Carry-over" },
    { key: "carryIn", headerSq: "Carry-in" },
    { key: "carryExpiresAt", headerSq: "Skadenca carry" },
  ];

  return {
    columns: cols,
    rows: bals.map((b) => ({
      employeeName: `${b.employee.firstName} ${b.employee.lastName}`,
      department: b.employee.department?.name ?? "",
      leaveType: b.leaveType,
      yearlyQuota: b.yearlyQuota.toString(),
      usedDays: b.usedDays.toString(),
      remainingDays: b.remainingDays.toString(),
      carryOverDays: b.carryOverDays.toString(),
      carryIn: b.carryIn.toString(),
      carryExpiresAt: b.carryExpiresAt?.toISOString().slice(0, 10) ?? "",
    })),
  };
}

export async function fetchCarryOverLeave(ctx: ReportFetcherContext, filters: LeaveYearFilters): Promise<FetchRowsResult> {
  const bals = await prisma.leaveBalance.findMany({
    where: {
      companyId: ctx.companyId,
      year: filters.year,
      carryIn: { gt: 0 },
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    },
    include: { employee: true },
  });

  const cols: ReportColumnDef[] = [
    { key: "employeeName", headerSq: "Punonjësi" },
    { key: "leaveType", headerSq: "Lloji" },
    { key: "carryIn", headerSq: "Carry-in ditë" },
    { key: "carryExpiresAt", headerSq: "Skadenca" },
  ];

  return {
    columns: cols,
    rows: bals.map((b) => ({
      employeeName: `${b.employee.firstName} ${b.employee.lastName}`,
      leaveType: b.leaveType,
      carryIn: b.carryIn.toString(),
      carryExpiresAt: b.carryExpiresAt?.toISOString().slice(0, 10) ?? "",
    })),
  };
}

export async function fetchGeneratedDocuments(ctx: ReportFetcherContext, filters: DocumentListFilters): Promise<FetchRowsResult> {
  const whereCat = filters.documentCategory
    ? { documentCategory: filters.documentCategory as DocumentCategory }
    : {};

  const arts = await prisma.documentGenerationArtifact.findMany({
    where: {
      companyId: ctx.companyId,
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...whereCat,
      ...(filters.includeArchived ? {} : { isArchived: false }),
      generationStatus: "SUCCEEDED",
    },
    include: {
      employee: true,
      templateVersion: { include: { template: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const cols: ReportColumnDef[] = [
    { key: "createdAt", headerSq: "Data" },
    { key: "title", headerSq: "Titulli" },
    { key: "category", headerSq: "Kategoria" },
    { key: "employeeName", headerSq: "Punonjësi" },
    { key: "templateName", headerSq: "Shablloni" },
    { key: "displayFilename", headerSq: "Skedari" },
    { key: "archived", headerSq: "Arkivuar" },
  ];

  return {
    columns: cols,
    rows: arts.map((a) => ({
      createdAt: a.createdAt.toISOString(),
      title: a.title,
      category: a.documentCategory,
      employeeName: a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : "",
      templateName: a.templateVersion.template.name,
      displayFilename: a.displayFilename,
      archived: a.isArchived ? "Po" : "Jo",
    })),
  };
}

export async function fetchActiveContracts(ctx: ReportFetcherContext, filters: EmployeeListFilters): Promise<FetchRowsResult> {
  const statuses: ContractStatus[] = ["ACTIVE"];
  const contracts = await prisma.contract.findMany({
    where: {
      companyId: ctx.companyId,
      status: { in: statuses },
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.departmentId ? { employee: { departmentId: filters.departmentId } } : {}),
    },
    include: { employee: { include: { department: true } }, documentTemplate: true },
    orderBy: { endDate: "asc" },
  });

  const cols: ReportColumnDef[] = [
    { key: "referenceCode", headerSq: "Referenca" },
    { key: "employeeName", headerSq: "Punonjësi" },
    { key: "department", headerSq: "Departamenti" },
    { key: "kind", headerSq: "Lloji" },
    { key: "effectiveDate", headerSq: "Nga" },
    { key: "endDate", headerSq: "Deri" },
    { key: "template", headerSq: "Shabllon" },
  ];

  return {
    columns: cols,
    rows: contracts.map((c) => ({
      referenceCode: c.referenceCode ?? "",
      employeeName: `${c.employee.firstName} ${c.employee.lastName}`,
      department: c.employee.department?.name ?? "",
      kind: c.kind,
      effectiveDate: c.effectiveDate.toISOString().slice(0, 10),
      endDate: c.endDate?.toISOString().slice(0, 10) ?? "",
      template: c.documentTemplate?.name ?? "",
    })),
  };
}

export async function fetchContractsNearExpiry(
  ctx: ReportFetcherContext,
  filters: ContractExpiryFilters,
): Promise<FetchRowsResult> {
  const now = new Date();
  const until = new Date(now);
  until.setDate(until.getDate() + filters.daysAhead);

  const contracts = await prisma.contract.findMany({
    where: {
      companyId: ctx.companyId,
      status: "ACTIVE",
      endDate: { not: null, gte: now, lte: until },
      ...(filters.departmentId ? { employee: { departmentId: filters.departmentId } } : {}),
    },
    include: { employee: { include: { department: true } }, documentTemplate: true },
    orderBy: { endDate: "asc" },
  });

  const cols: ReportColumnDef[] = [
    { key: "employeeName", headerSq: "Punonjësi" },
    { key: "department", headerSq: "Departamenti" },
    { key: "endDate", headerSq: "Skadon më" },
    { key: "daysLeft", headerSq: "Ditë të mbetura" },
    { key: "kind", headerSq: "Lloji kontrate" },
  ];

  return {
    columns: cols,
    rows: contracts.map((c) => {
      const end = c.endDate!.getTime();
      const daysLeft = Math.ceil((end - now.getTime()) / 86400000);
      return {
        employeeName: `${c.employee.firstName} ${c.employee.lastName}`,
        department: c.employee.department?.name ?? "",
        endDate: c.endDate!.toISOString().slice(0, 10),
        daysLeft,
        kind: c.kind,
      };
    }),
  };
}

export async function fetchDocumentsByEmployee(ctx: ReportFetcherContext, filters: DocumentListFilters): Promise<FetchRowsResult> {
  if (!filters.employeeId) {
    throw new Error("Zgjidh punonjësin për këtë raport.");
  }
  return fetchGeneratedDocuments(ctx, { ...filters, employeeId: filters.employeeId });
}

export async function fetchTemplateUsage(ctx: ReportFetcherContext): Promise<FetchRowsResult> {
  const grouped = await prisma.documentGenerationArtifact.groupBy({
    by: ["documentTemplateId"],
    where: {
      companyId: ctx.companyId,
      documentTemplateId: { not: null },
    },
    _count: { id: true },
  });

  const templateIds = grouped.map((g) => g.documentTemplateId!).filter(Boolean);
  const templates = await prisma.documentTemplate.findMany({
    where: { id: { in: templateIds }, companyId: ctx.companyId },
  });
  const nameById = new Map(templates.map((t) => [t.id, t.name]));

  const cols: ReportColumnDef[] = [
    { key: "templateName", headerSq: "Shablloni" },
    { key: "category", headerSq: "Kategoria" },
    { key: "usageCount", headerSq: "Përdorime" },
  ];

  const rows: ReportRow[] = grouped.map((g) => ({
    templateName: nameById.get(g.documentTemplateId!) ?? g.documentTemplateId ?? "",
    category: templates.find((t) => t.id === g.documentTemplateId)?.documentCategory ?? "",
    usageCount: g._count.id,
  }));

  return { columns: cols, rows };
}

export async function fetchTerminationsByMonth(
  ctx: ReportFetcherContext,
  filters: TerminationMonthFilters,
): Promise<FetchRowsResult> {
  const start = new Date(Date.UTC(filters.year, filters.month - 1, 1));
  const end = new Date(Date.UTC(filters.year, filters.month, 0, 23, 59, 59, 999));

  const terms = await prisma.termination.findMany({
    where: {
      companyId: ctx.companyId,
      status: { not: "CANCELLED" },
      terminationDate: { gte: start, lte: end },
    },
    include: { employee: { include: { department: true } } },
    orderBy: { terminationDate: "desc" },
  });

  const cols: ReportColumnDef[] = [
    { key: "employeeName", headerSq: "Punonjësi" },
    { key: "department", headerSq: "Departamenti" },
    { key: "type", headerSq: "Lloji" },
    { key: "status", headerSq: "Statusi" },
    { key: "terminationDate", headerSq: "Data largimit" },
    { key: "lastWorkingDay", headerSq: "Dita e fundit" },
  ];

  return {
    columns: cols,
    rows: terms.map((t) => ({
      employeeName: `${t.employee.firstName} ${t.employee.lastName}`,
      department: t.employee.department?.name ?? "",
      type: t.type,
      status: t.status,
      terminationDate: t.terminationDate.toISOString().slice(0, 10),
      lastWorkingDay: t.lastWorkingDay.toISOString().slice(0, 10),
    })),
  };
}

export async function fetchTerminationsByReason(ctx: ReportFetcherContext): Promise<FetchRowsResult> {
  const terms = await prisma.termination.findMany({
    where: { companyId: ctx.companyId, status: { not: "CANCELLED" } },
    include: { employee: true },
    orderBy: { terminationDate: "desc" },
    take: 5000,
  });

  const cols: ReportColumnDef[] = [
    { key: "employeeName", headerSq: "Punonjësi" },
    { key: "type", headerSq: "Lloji / arsyeja" },
    { key: "reason", headerSq: "Arsyeja (tekst)" },
    { key: "terminationDate", headerSq: "Data" },
    { key: "status", headerSq: "Statusi" },
  ];

  return {
    columns: cols,
    rows: terms.map((t) => ({
      employeeName: `${t.employee.firstName} ${t.employee.lastName}`,
      type: t.type,
      reason: (t.reason ?? t.details ?? "").slice(0, 500),
      terminationDate: t.terminationDate.toISOString().slice(0, 10),
      status: t.status,
    })),
  };
}

export async function fetchFinalPayrollTerminations(ctx: ReportFetcherContext): Promise<FetchRowsResult> {
  const terms = await prisma.termination.findMany({
    where: {
      companyId: ctx.companyId,
      finalPayrollId: { not: null },
      status: "COMPLETED",
    },
    include: {
      employee: true,
      finalPayroll: true,
    },
    orderBy: { terminationDate: "desc" },
  });

  const cols: ReportColumnDef[] = [
    { key: "employeeName", headerSq: "Punonjësi" },
    { key: "payrollPeriod", headerSq: "Periudha e pagës finale" },
    { key: "completedAt", headerSq: "Përfunduar më" },
  ];

  return {
    columns: cols,
    rows: terms.map((t) => ({
      employeeName: `${t.employee.firstName} ${t.employee.lastName}`,
      payrollPeriod: t.finalPayroll ? `${t.finalPayroll.year}-${String(t.finalPayroll.month).padStart(2, "0")}` : "",
      completedAt: t.completedAt?.toISOString() ?? "",
    })),
  };
}

export async function fetchTerminationDocuments(ctx: ReportFetcherContext): Promise<FetchRowsResult> {
  const terms = await prisma.termination.findMany({
    where: {
      companyId: ctx.companyId,
      generatedDocumentId: { not: null },
      status: { not: "CANCELLED" },
    },
    include: {
      employee: true,
      generatedDocument: true,
    },
    orderBy: { terminationDate: "desc" },
    take: 3000,
  });

  const cols: ReportColumnDef[] = [
    { key: "employeeName", headerSq: "Punonjësi" },
    { key: "terminationDate", headerSq: "Data largimit" },
    { key: "documentTitle", headerSq: "Dokumenti" },
    { key: "filename", headerSq: "Skedari" },
  ];

  return {
    columns: cols,
    rows: terms.map((t) => ({
      employeeName: `${t.employee.firstName} ${t.employee.lastName}`,
      terminationDate: t.terminationDate.toISOString().slice(0, 10),
      documentTitle: t.generatedDocument?.title ?? "",
      filename: t.generatedDocument?.displayFilename ?? "",
    })),
  };
}
