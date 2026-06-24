import { KOSOVO_MONTHLY_PIT_BANDS } from "@/modules/payroll/constants/kosovo-payroll";
import type { LegislationSnapshot, PitBandSnapshot, PremiumRules } from "../calculation/types";

export interface PitBracketRowInput {
  sequence: number;
  fromAmount: string;
  toAmount: string;
  rate: string;
}

export interface PayrollParameterSetRowInput {
  id?: string;
  minimumMonthlyWage: string;
  pensionEmployeeRate: string;
  pensionEmployerRate: string;
  premiumRules?: unknown | null;
  secondaryEmployerFlatRate?: string | null;
  secondaryEmployerPitBase?: "TAXABLE_AFTER_PENSION" | "GROSS" | null;
}

export interface MapSnapshotParams {
  rulesVersion: string;
  effectiveFromIso?: string;
  parameterSet: PayrollParameterSetRowInput;
  pitBracketRows: PitBracketRowInput[];
  minimumHourlyWage?: string;
  standardMonthlyHours?: string;
}

function parsePremiumRules(raw: unknown | null | undefined): PremiumRules {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const readString = (key: string): string | undefined =>
    typeof obj[key] === "string" ? (obj[key] as string) : undefined;

  return {
    overtimeHourMultiplier: readString("overtimeHourMultiplier"),
    holidayHourMultiplier: readString("holidayHourMultiplier"),
    weekendHourMultiplier: readString("weekendHourMultiplier"),
    nightHourMultiplier: readString("nightHourMultiplier"),
    stackPolicy:
      obj.stackPolicy === "additive" ||
      obj.stackPolicy === "max_only" ||
      obj.stackPolicy === "explicit_order"
        ? obj.stackPolicy
        : undefined,
  };
}

/** Converts ordered Prisma `PitBracket` rows into cumulative marginal ladder inputs. */
export function pitRowsToCumulativeBands(rows: PitBracketRowInput[]): PitBandSnapshot[] {
  const sorted = [...rows].sort((a, b) => a.sequence - b.sequence);
  return sorted.map((row) => ({
    cumulativeUpperInclusive: row.toAmount,
    rate: row.rate,
  }));
}

export function mapPayrollParameterSetToLegislationSnapshot(
  params: MapSnapshotParams,
): LegislationSnapshot {
  const premiumRules = parsePremiumRules(params.parameterSet.premiumRules);

  return {
    rulesVersion: params.rulesVersion,
    snapshotId: params.parameterSet.id,
    effectiveFromIso: params.effectiveFromIso,
    currency: "EUR",
    minimumMonthlyGross: params.parameterSet.minimumMonthlyWage,
    minimumHourlyWage: params.minimumHourlyWage,
    standardMonthlyHours: params.standardMonthlyHours,
    pensionEmployeeRate: params.parameterSet.pensionEmployeeRate,
    pensionEmployerRate: params.parameterSet.pensionEmployerRate,
    pitBands:
      params.pitBracketRows.length > 0
        ? pitRowsToCumulativeBands(params.pitBracketRows)
        : [...KOSOVO_MONTHLY_PIT_BANDS].map((b) => ({ ...b })),
    pitRules: { employeePensionReducesTaxableBase: true },
    secondaryEmployerFlatRate:
      params.parameterSet.secondaryEmployerFlatRate ?? "0.10",
    secondaryEmployerPitBase:
      params.parameterSet.secondaryEmployerPitBase ?? "TAXABLE_AFTER_PENSION",
    premiumRules,
  };
}
