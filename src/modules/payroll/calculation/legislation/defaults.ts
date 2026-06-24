import type { LegislationSnapshot, PitBandSnapshot } from "../types";
import {
  KOSOVO_DEFAULT_PENSION_EMPLOYEE_RATE,
  KOSOVO_DEFAULT_PENSION_EMPLOYER_RATE,
  KOSOVO_MONTHLY_PIT_BANDS,
} from "@/modules/payroll/constants/kosovo-payroll";

export const KOSOVO_RULES_VERSION_2026_ATK = "kosovo-2026-atk" as const;

/** Kosovo monthly progressive PIT when DB `PitBracket` rows are missing. */
export const KOSOVO_DEFAULT_PIT_BANDS: PitBandSnapshot[] = [...KOSOVO_MONTHLY_PIT_BANDS];

/** Kosovo payroll defaults per project specification — amend via DB snapshot when legislation updates. */
export function kosovo2026AtkDefaults(snapshot?: Partial<LegislationSnapshot>): LegislationSnapshot {
  return {
    rulesVersion: snapshot?.rulesVersion ?? KOSOVO_RULES_VERSION_2026_ATK,
    snapshotId: snapshot?.snapshotId,
    effectiveFromIso: snapshot?.effectiveFromIso,
    currency: snapshot?.currency ?? "EUR",
    minimumMonthlyGross: snapshot?.minimumMonthlyGross ?? "450",
    minimumHourlyWage: snapshot?.minimumHourlyWage,
    standardMonthlyHours: snapshot?.standardMonthlyHours,
    pensionEmployeeRate: snapshot?.pensionEmployeeRate ?? KOSOVO_DEFAULT_PENSION_EMPLOYEE_RATE,
    pensionEmployerRate: snapshot?.pensionEmployerRate ?? KOSOVO_DEFAULT_PENSION_EMPLOYER_RATE,
    pitBands: snapshot?.pitBands ?? KOSOVO_DEFAULT_PIT_BANDS,
    pitRules: snapshot?.pitRules ?? {
      employeePensionReducesTaxableBase: true,
    },
    secondaryEmployerFlatRate: snapshot?.secondaryEmployerFlatRate ?? "0.10",
    secondaryEmployerPitBase:
      snapshot?.secondaryEmployerPitBase ?? "TAXABLE_AFTER_PENSION",
    premiumRules: snapshot?.premiumRules ?? {},
  };
}
