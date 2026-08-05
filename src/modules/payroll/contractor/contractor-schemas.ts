import { z } from "zod";

const hoursField = z.coerce
  .number({ message: "Orët duhet të jenë numër" })
  .min(0, "Orët nuk mund të jenë negative")
  .max(744, "Orët e një muaji nuk mund t'i kalojnë 744");

export const contractorPeriodCreateSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const contractorPeriodIdSchema = z.object({
  periodId: z.string().cuid(),
});

export const contractorEntryHoursSchema = z.object({
  periodId: z.string().cuid(),
  entryId: z.string().cuid(),
  regularHours: hoursField,
  overtimeHours: hoursField,
  weekendHours: hoursField,
  holidayHours: hoursField,
  nightHours: hoursField,
  /// Paga mujore neto për kontraktorët me bazë fikse — injorohet për ata me orë.
  /// Baza vendoset nga entry-ja, jo nga kërkesa.
  monthlyFlatAmount: z.coerce
    .number({ message: "Paga mujore duhet të jetë numër" })
    .min(0, "Paga mujore nuk mund të jetë negative")
    .max(1_000_000, "Paga mujore duket e pabesueshme")
    .optional(),
  notes: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().max(2000).nullable().optional(),
    ),
});

export const contractorEntrySyncSchema = z.object({
  periodId: z.string().cuid(),
  entryId: z.string().cuid(),
});

export function formatContractorFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_root";
    if (!out[path]) out[path] = [];
    out[path].push(issue.message);
  }
  return out;
}
