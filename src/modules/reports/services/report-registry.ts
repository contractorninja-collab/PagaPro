import type { ReportOutputFormat, ReportType } from "@prisma/client";
import { z } from "zod";
import type { ReportCategory, FetchRowsResult, ReportFetcherContext } from "@/modules/reports/types";
import { REPORT_CATEGORY_LABEL_SQ, categoryForReportType } from "@/modules/reports/types";
import {
  contractExpiryFilterSchema,
  documentListFilterSchema,
  employeeListFilterSchema,
  emptyFilterSchema,
  leaveYearFilterSchema,
  payrollPeriodFilterSchema,
  terminationMonthFilterSchema,
} from "@/modules/reports/validators/report-schemas";
import {
  fetchEmployeeReport,
  fetchPayrollSummaryReport,
  fetchFinanceWorkbookData,
  fetchTrustTaxReport,
  fetchEmployerCostReport,
  fetchSalaryAdvanceReport,
  fetchAtkPreviewRows,
  fetchLeaveByEmployee,
  fetchAnnualLeaveUsed,
  fetchLeavePending,
  fetchMedicalLeave,
  fetchUnpaidLeave,
  fetchLeaveBalances,
  fetchCarryOverLeave,
  fetchGeneratedDocuments,
  fetchActiveContracts,
  fetchContractsNearExpiry,
  fetchDocumentsByEmployee,
  fetchTemplateUsage,
  fetchTerminationsByMonth,
  fetchTerminationsByReason,
  fetchFinalPayrollTerminations,
  fetchTerminationDocuments,
} from "@/modules/reports/services/report-data-fetchers";

export type CatalogRow = {
  type: ReportType;
  category: ReportCategory;
  categoryLabel: string;
  titleSq: string;
  descriptionSq: string;
  formats: ReportOutputFormat[];
};

function formatsFor(type: ReportType): ReportOutputFormat[] {
  switch (type) {
    case "FINANCE_PAYROLL_WORKBOOK":
    case "ATK_EXPORT_WORKBOOK":
      return ["XLSX"];
    case "LISTA_PER_NENSHKRIM_PA_SUMA":
      return ["PDF", "XLSX", "CSV"];
    default:
      return ["XLSX", "CSV", "PDF"];
  }
}

export function titleForType(type: ReportType): string {
  const map: Record<ReportType, string> = {
    LISTA_PUNONJESVE: "Lista e Punonjësve",
    PUNONJES_AKTIVE: "Punonjës Aktivë",
    PUNONJES_TE_LARGUAR: "Punonjës të Larguar",
    KONTRAKTORE: "Kontraktorë",
    PUNONJES_SIPAS_DEPARTAMENTIT: "Punonjës sipas Departamentit",
    PUNONJES_ME_DOKUMENTE_QE_MUNGOJNE: "Punonjës me Dokumente që Mungojnë",
    RAPORT_PAGAVE_MUJORE: "Raport i Pagave Mujore",
    LISTA_PAGAVE_ME_SUMA: "Lista e Pagave me Shuma",
    LISTA_PER_NENSHKRIM_PA_SUMA: "Lista për Nënshkrim pa Shuma",
    FINANCE_PAYROLL_WORKBOOK: "Finance Payroll Workbook",
    ATK_EXPORT_WORKBOOK: "ATK Export Workbook",
    TRUSTI_DHE_TATIMI: "Trusti & Tatimi",
    EMPLOYER_TOTAL_COST: "Employer Total Cost",
    SALARY_ADVANCE_DEDUCTIONS: "Salary Advance Deductions",
    PUSHIMET_SIPAS_PUNONJESIT: "Pushimet sipas Punonjësit",
    PUSHIMET_VJETORE_TE_SHFRYTEZUARA: "Pushimet Vjetore të Shfrytëzuara",
    PUSHIMET_NE_PRITJE: "Pushimet në Pritje",
    PUSHIMET_MJEKESORE: "Pushimet Mjekësore",
    PUSHIMET_PA_PAGESE: "Pushimet pa Pagesë",
    BALANCA_E_PUSHIMEVE: "Balanca e Pushimeve",
    CARRY_OVER_LEAVE: "Carry-over Leave",
    DOKUMENTET_E_GJENERUARA: "Dokumentet e Gjeneruara",
    KONTRATA_AKTIVE: "Kontratat Aktive",
    KONTRATA_AFER_SKADIMIT: "Kontratat Afër Skadimit",
    DOKUMENTET_SIPAS_PUNONJESIT: "Dokumentet sipas Punonjësit",
    TEMPLATES_TE_PERDORURA: "Templates të Përdorura",
    LARGIMET_SIPAS_MUAJIT: "Largimet sipas Muajit",
    LARGIMET_SIPAS_ARSYEVE: "Largimet sipas Arsyeve",
    FINAL_PAYROLL_REPORTS: "Final Payroll Reports",
    DOKUMENTET_E_LARGIMIT: "Dokumentet e Largimit",
  };
  return map[type];
}

export function listReportCatalog(): CatalogRow[] {
  const all: ReportType[] = [
    "LISTA_PUNONJESVE",
    "PUNONJES_AKTIVE",
    "PUNONJES_TE_LARGUAR",
    "KONTRAKTORE",
    "PUNONJES_SIPAS_DEPARTAMENTIT",
    "PUNONJES_ME_DOKUMENTE_QE_MUNGOJNE",
    "RAPORT_PAGAVE_MUJORE",
    "LISTA_PAGAVE_ME_SUMA",
    "LISTA_PER_NENSHKRIM_PA_SUMA",
    "FINANCE_PAYROLL_WORKBOOK",
    "ATK_EXPORT_WORKBOOK",
    "TRUSTI_DHE_TATIMI",
    "EMPLOYER_TOTAL_COST",
    "SALARY_ADVANCE_DEDUCTIONS",
    "PUSHIMET_SIPAS_PUNONJESIT",
    "PUSHIMET_VJETORE_TE_SHFRYTEZUARA",
    "PUSHIMET_NE_PRITJE",
    "PUSHIMET_MJEKESORE",
    "PUSHIMET_PA_PAGESE",
    "BALANCA_E_PUSHIMEVE",
    "CARRY_OVER_LEAVE",
    "DOKUMENTET_E_GJENERUARA",
    "KONTRATA_AKTIVE",
    "KONTRATA_AFER_SKADIMIT",
    "DOKUMENTET_SIPAS_PUNONJESIT",
    "TEMPLATES_TE_PERDORURA",
    "LARGIMET_SIPAS_MUAJIT",
    "LARGIMET_SIPAS_ARSYEVE",
    "FINAL_PAYROLL_REPORTS",
    "DOKUMENTET_E_LARGIMIT",
  ];

  const descriptions: Partial<Record<ReportType, string>> = {
    LISTA_PUNONJESVE: "Të gjithë punonjësit me kolona kryesore HR.",
    RAPORT_PAGAVE_MUJORE: "Rreshtat e pagës për periudhën (snapshot nëse payroll është kyçur).",
    LISTA_PER_NENSHKRIM_PA_SUMA: "Lista për nënshkrim pa shuma.",
    FINANCE_PAYROLL_WORKBOOK: "Excel me përmbledhje dhe detaje linjash.",
    ATK_EXPORT_WORKBOOK: "Eksport zyrtar ATK nga payroll APPROVED/LOCKED.",
    KONTRATA_AFER_SKADIMIT: "Kontrata aktive që skadojnë brenda dritares së zgjedhur.",
    PUSHIMET_SIPAS_PUNONJESIT: "Të gjitha kërkesat e pushimit për vitin.",
    DOKUMENTET_E_GJENERUARA: "Artefakte dokumentesh të gjeneruara nga motori.",
  };

  return all.map((type) => {
    const cat = categoryForReportType(type);
    return {
      type,
      category: cat,
      categoryLabel: REPORT_CATEGORY_LABEL_SQ[cat],
      titleSq: titleForType(type),
      descriptionSq: descriptions[type] ?? "Raport operativ nga të dhënat e sistemit.",
      formats: formatsFor(type),
    };
  });
}

export function parseReportFilters(type: ReportType, raw: unknown): unknown {
  switch (type) {
    case "LISTA_PUNONJESVE":
    case "PUNONJES_AKTIVE":
    case "PUNONJES_TE_LARGUAR":
    case "KONTRAKTORE":
    case "PUNONJES_SIPAS_DEPARTAMENTIT":
    case "PUNONJES_ME_DOKUMENTE_QE_MUNGOJNE":
      return z.object(employeeListFilterSchema.shape).parse(raw ?? {});
    case "RAPORT_PAGAVE_MUJORE":
    case "LISTA_PAGAVE_ME_SUMA":
    case "LISTA_PER_NENSHKRIM_PA_SUMA":
    case "FINANCE_PAYROLL_WORKBOOK":
    case "ATK_EXPORT_WORKBOOK":
    case "TRUSTI_DHE_TATIMI":
    case "EMPLOYER_TOTAL_COST":
    case "SALARY_ADVANCE_DEDUCTIONS":
      return payrollPeriodFilterSchema.parse(raw ?? {});
    case "PUSHIMET_SIPAS_PUNONJESIT":
    case "PUSHIMET_VJETORE_TE_SHFRYTEZUARA":
    case "PUSHIMET_NE_PRITJE":
    case "PUSHIMET_MJEKESORE":
    case "PUSHIMET_PA_PAGESE":
    case "BALANCA_E_PUSHIMEVE":
    case "CARRY_OVER_LEAVE":
      return leaveYearFilterSchema.parse(raw ?? {});
    case "DOKUMENTET_E_GJENERUARA":
    case "DOKUMENTET_SIPAS_PUNONJESIT":
      return documentListFilterSchema.parse(raw ?? {});
    case "KONTRATA_AKTIVE":
      return z.object(employeeListFilterSchema.shape).parse(raw ?? {});
    case "KONTRATA_AFER_SKADIMIT":
      return contractExpiryFilterSchema.parse(raw ?? {});
    case "TEMPLATES_TE_PERDORURA":
    case "LARGIMET_SIPAS_ARSYEVE":
    case "FINAL_PAYROLL_REPORTS":
    case "DOKUMENTET_E_LARGIMIT":
      return emptyFilterSchema.parse(raw ?? {});
    case "LARGIMET_SIPAS_MUAJIT":
      return terminationMonthFilterSchema.parse(raw ?? {});
    default: {
      const _: never = type;
      void _;
      throw new Error("Lloj raporti i panjohur.");
    }
  }
}

export async function fetchRowsForReport(
  type: ReportType,
  ctx: ReportFetcherContext,
  filters: unknown,
): Promise<FetchRowsResult> {
  switch (type) {
    case "LISTA_PUNONJESVE":
    case "PUNONJES_AKTIVE":
    case "PUNONJES_TE_LARGUAR":
    case "KONTRAKTORE":
    case "PUNONJES_SIPAS_DEPARTAMENTIT":
    case "PUNONJES_ME_DOKUMENTE_QE_MUNGOJNE":
      return fetchEmployeeReport(ctx, filters as z.infer<typeof employeeListFilterSchema>, type);
    case "RAPORT_PAGAVE_MUJORE":
    case "LISTA_PAGAVE_ME_SUMA":
      return fetchPayrollSummaryReport(ctx, filters as z.infer<typeof payrollPeriodFilterSchema>, true);
    case "LISTA_PER_NENSHKRIM_PA_SUMA":
      return fetchPayrollSummaryReport(ctx, filters as z.infer<typeof payrollPeriodFilterSchema>, false);
    case "FINANCE_PAYROLL_WORKBOOK": {
      const fd = await fetchFinanceWorkbookData(ctx, filters as z.infer<typeof payrollPeriodFilterSchema>);
      return fd.summary;
    }
    case "TRUSTI_DHE_TATIMI":
      return fetchTrustTaxReport(ctx, filters as z.infer<typeof payrollPeriodFilterSchema>);
    case "EMPLOYER_TOTAL_COST":
      return fetchEmployerCostReport(ctx, filters as z.infer<typeof payrollPeriodFilterSchema>);
    case "SALARY_ADVANCE_DEDUCTIONS":
      return fetchSalaryAdvanceReport(ctx, filters as z.infer<typeof payrollPeriodFilterSchema>);
    case "ATK_EXPORT_WORKBOOK":
      return fetchAtkPreviewRows(ctx, filters as z.infer<typeof payrollPeriodFilterSchema>);
    case "PUSHIMET_SIPAS_PUNONJESIT":
      return fetchLeaveByEmployee(ctx, filters as z.infer<typeof leaveYearFilterSchema>);
    case "PUSHIMET_VJETORE_TE_SHFRYTEZUARA":
      return fetchAnnualLeaveUsed(ctx, filters as z.infer<typeof leaveYearFilterSchema>);
    case "PUSHIMET_NE_PRITJE":
      return fetchLeavePending(ctx, filters as z.infer<typeof leaveYearFilterSchema>);
    case "PUSHIMET_MJEKESORE":
      return fetchMedicalLeave(ctx, filters as z.infer<typeof leaveYearFilterSchema>);
    case "PUSHIMET_PA_PAGESE":
      return fetchUnpaidLeave(ctx, filters as z.infer<typeof leaveYearFilterSchema>);
    case "BALANCA_E_PUSHIMEVE":
      return fetchLeaveBalances(ctx, filters as z.infer<typeof leaveYearFilterSchema>);
    case "CARRY_OVER_LEAVE":
      return fetchCarryOverLeave(ctx, filters as z.infer<typeof leaveYearFilterSchema>);
    case "DOKUMENTET_E_GJENERUARA":
      return fetchGeneratedDocuments(ctx, filters as z.infer<typeof documentListFilterSchema>);
    case "KONTRATA_AKTIVE":
      return fetchActiveContracts(ctx, filters as z.infer<typeof employeeListFilterSchema>);
    case "KONTRATA_AFER_SKADIMIT":
      return fetchContractsNearExpiry(ctx, filters as z.infer<typeof contractExpiryFilterSchema>);
    case "DOKUMENTET_SIPAS_PUNONJESIT":
      return fetchDocumentsByEmployee(ctx, filters as z.infer<typeof documentListFilterSchema>);
    case "TEMPLATES_TE_PERDORURA":
      return fetchTemplateUsage(ctx);
    case "LARGIMET_SIPAS_MUAJIT":
      return fetchTerminationsByMonth(ctx, filters as z.infer<typeof terminationMonthFilterSchema>);
    case "LARGIMET_SIPAS_ARSYEVE":
      return fetchTerminationsByReason(ctx);
    case "FINAL_PAYROLL_REPORTS":
      return fetchFinalPayrollTerminations(ctx);
    case "DOKUMENTET_E_LARGIMIT":
      return fetchTerminationDocuments(ctx);
    default: {
      const _: never = type;
      void _;
      throw new Error("Lloj raporti i panjohur.");
    }
  }
}
