import type { ReportType } from "@prisma/client";

export type ReportCategory =
  | "EMPLOYEE"
  | "PAYROLL"
  | "LEAVE"
  | "DOCUMENT"
  | "TERMINATION";

export const REPORT_CATEGORY_LABEL_SQ: Record<ReportCategory, string> = {
  EMPLOYEE: "Punonjës",
  PAYROLL: "Paga",
  LEAVE: "Pushime",
  DOCUMENT: "Dokumente",
  TERMINATION: "Largime",
};

export type ReportColumnDef = { key: string; headerSq: string };

export type ReportRow = Record<string, string | number | boolean | null>;

export type FetchRowsResult = {
  columns: ReportColumnDef[];
  rows: ReportRow[];
};

export type ReportFetcherContext = {
  companyId: string;
};

export function categoryForReportType(t: ReportType): ReportCategory {
  switch (t) {
    case "LISTA_PUNONJESVE":
    case "PUNONJES_AKTIVE":
    case "PUNONJES_TE_LARGUAR":
    case "KONTRAKTORE":
    case "PUNONJES_SIPAS_DEPARTAMENTIT":
    case "PUNONJES_ME_DOKUMENTE_QE_MUNGOJNE":
      return "EMPLOYEE";
    case "RAPORT_PAGAVE_MUJORE":
    case "LISTA_PAGAVE_ME_SUMA":
    case "LISTA_PER_NENSHKRIM_PA_SUMA":
    case "FINANCE_PAYROLL_WORKBOOK":
    case "ATK_EXPORT_WORKBOOK":
    case "TRUSTI_DHE_TATIMI":
    case "EMPLOYER_TOTAL_COST":
    case "SALARY_ADVANCE_DEDUCTIONS":
      return "PAYROLL";
    case "PUSHIMET_SIPAS_PUNONJESIT":
    case "PUSHIMET_VJETORE_TE_SHFRYTEZUARA":
    case "PUSHIMET_NE_PRITJE":
    case "PUSHIMET_MJEKESORE":
    case "PUSHIMET_PA_PAGESE":
    case "BALANCA_E_PUSHIMEVE":
    case "CARRY_OVER_LEAVE":
      return "LEAVE";
    case "DOKUMENTET_E_GJENERUARA":
    case "KONTRATA_AKTIVE":
    case "KONTRATA_AFER_SKADIMIT":
    case "DOKUMENTET_SIPAS_PUNONJESIT":
    case "TEMPLATES_TE_PERDORURA":
      return "DOCUMENT";
    case "LARGIMET_SIPAS_MUAJIT":
    case "LARGIMET_SIPAS_ARSYEVE":
    case "FINAL_PAYROLL_REPORTS":
    case "DOKUMENTET_E_LARGIMIT":
      return "TERMINATION";
    default:
      return "TERMINATION";
  }
}
