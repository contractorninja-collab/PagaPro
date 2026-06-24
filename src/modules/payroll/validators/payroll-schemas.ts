import { z } from "zod";

export const payrollCreateSchema = z.object({
  year: z.number().int().min(1990).max(2100),
  month: z.number().int().min(1).max(12),
  employeeIds: z.array(z.string().min(1)).optional(),
});

export type PayrollCreateInput = z.infer<typeof payrollCreateSchema>;

/** Shared editable spreadsheet fields (partial patches allowed). */
export const payrollSpreadsheetFieldsSchema = z.object({
  bonuses: z.string().optional(),
  otherDeductions: z.string().optional(),
  salaryAdvanceDeduction: z.string().optional(),
  actualRegularHours: z.string().optional(),
  paidLeaveHours: z.string().optional(),
  sickLeaveHours: z.string().optional(),
  unpaidLeaveHours: z.string().optional(),
  overtimeHours: z.string().optional(),
  weekendHours: z.string().optional(),
  holidayHours: z.string().optional(),
  nightHours: z.string().optional(),
  manualGrossOverride: z.string().nullable().optional(),
  manualNetOverride: z.string().nullable().optional(),
  manualGrossReason: z.string().nullable().optional(),
  manualNetReason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const payrollEntryPatchSchema = payrollSpreadsheetFieldsSchema.extend({
  payrollId: z.string().min(1),
  entryId: z.string().min(1),
});

export type PayrollEntryPatchInput = z.infer<typeof payrollEntryPatchSchema>;

export const payrollBulkPatchSchema = z.object({
  payrollId: z.string().min(1),
  rows: z
    .array(
      z
        .object({
          entryId: z.string().min(1),
        })
        .merge(payrollSpreadsheetFieldsSchema.partial()),
    )
    .min(1),
});

export type PayrollBulkPatchInput = z.infer<typeof payrollBulkPatchSchema>;

export const payrollCorrectionCreateSchema = z.object({
  payrollId: z.string().min(1),
  employeeId: z.string().min(1),
  kind: z.enum(["NET_ADJUSTMENT", "GROSS_ADJUSTMENT", "TAX_ADJUSTMENT", "PENSION_ADJUSTMENT", "OTHER"]),
  amount: z.string().min(1),
  reason: z.string().min(3),
});

export type PayrollCorrectionCreateInput = z.infer<typeof payrollCorrectionCreateSchema>;

export const payrollSelectionPreviewSchema = z.object({
  year: z.number().int().min(1990).max(2100),
  month: z.number().int().min(1).max(12),
});

export type PayrollSelectionPreviewInput = z.infer<typeof payrollSelectionPreviewSchema>;

export function formatPayrollFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_root";
    if (!out[path]) out[path] = [];
    out[path].push(issue.message);
  }
  return out;
}
