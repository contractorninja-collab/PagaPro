import { z } from "zod";

const emptyToNull = (v: unknown): unknown => {
  if (v === "" || v === undefined) return null;
  return v;
};

/**
 * Representative row — the signatory is selected from the company's employees.
 * `fullName`/`position` are derived server-side from the linked employee; storage
 * keys may come from existing DB or new uploads merged server-side.
 */
export const konfigurimeRepresentativeSchema = z.object({
  employeeId: z.string().cuid("Zgjidhni një punonjës për përfaqësuesin"),
  fullName: z.preprocess(emptyToNull, z.string().max(200).nullable().optional()),
  position: z.preprocess(emptyToNull, z.string().max(200).nullable().optional()),
  signatureStorageKey: z.preprocess(emptyToNull, z.string().max(512).nullable().optional()),
  stampStorageKey: z.preprocess(emptyToNull, z.string().max(512).nullable().optional()),
});

const optionalMoney = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : null;
}, z.number().nonnegative().nullable());

const optionalPercent = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : null;
}, z.number().min(0).max(100).nullable());

const optionalHours = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : null;
}, z.number().min(0).max(168).nullable());

const optionalLeaveDays = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : null;
}, z.number().min(0).max(366).nullable());

export const konfigurimeConfigurationSchema = z.object({
  minimumSalaryCurrent: optionalMoney,
  minimumSalaryFromJuly1: optionalMoney,
  trustContributionPercent: optionalPercent,
  standardWeeklyHours: optionalHours,
  contractReferencePrefix: z.preprocess(emptyToNull, z.string().max(48).nullable().optional()),
  payrollPdfPrefix: z.preprocess(emptyToNull, z.string().max(48).nullable().optional()),
  generalDocumentPrefix: z.preprocess(emptyToNull, z.string().max(48).nullable().optional()),
  annualLeaveDaysDefault: optionalLeaveDays,
  personalLeaveDaysDefault: optionalLeaveDays,
  medicalLeaveDaysDefault: optionalLeaveDays,
  workingDaysPerWeek: z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
    return Number.isFinite(n) ? n : null;
  }, z.number().min(1).max(7).nullable()),
  annualLeaveAccrualMode: z.enum(["UPFRONT", "MONTHLY", "STATUTORY_FIRST_YEAR"]).optional(),
  annualLeaveRoundingMode: z.enum(["NONE", "HALF_DAY", "FULL_DAY"]).optional(),
  allowNegativeAnnualLeaveBalance: z.boolean().optional(),
  medicalLeavePolicyNote: z.preprocess(emptyToNull, z.string().max(5000).nullable().optional()),
  notifyContractExpiring: z.boolean(),
  notifyPayrollReminders: z.boolean(),
  notifyLeaveApprovals: z.boolean(),
  notifyEmployeeWarnings: z.boolean(),
});

export const konfigurimeCompanySchema = z.object({
  legalName: z.string().min(1, "Emri i kompanisë është i detyrueshëm").max(300),
  fiscalNumber: z.preprocess(emptyToNull, z.string().max(64).nullable().optional()),
  businessRegistrationNumber: z.preprocess(emptyToNull, z.string().max(64).nullable().optional()),
  addressLine: z.preprocess(emptyToNull, z.string().max(500).nullable().optional()),
  email: z.preprocess((v) => {
    if (v === "" || v === undefined) return undefined;
    if (typeof v !== "string") return v;
    const t = v.trim();
    return t === "" ? null : t;
  }, z.union([z.string().email("Email jo valid"), z.null()]).optional()),
  phone: z.preprocess(emptyToNull, z.string().max(64).nullable().optional()),
  website: z.preprocess(emptyToNull, z.string().max(512).nullable().optional()),
});

export const konfigurimePayloadSchema = z.object({
  companyLogoStorageKey: z.preprocess(emptyToNull, z.string().max(512).nullable().optional()),
  company: konfigurimeCompanySchema,
  representatives: z.array(konfigurimeRepresentativeSchema).min(1, "Duhet të përcaktohet të paku një përfaqësues"),
  configuration: konfigurimeConfigurationSchema,
});

export type KonfigurimePayloadInput = z.input<typeof konfigurimePayloadSchema>;
export type KonfigurimePayloadValidated = z.infer<typeof konfigurimePayloadSchema>;

export function formatKonfigurimeFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_root";
    if (!out[path]) out[path] = [];
    out[path].push(issue.message);
  }
  return out;
}
