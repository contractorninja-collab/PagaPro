import { z } from "zod";

export const annexChangeCategorySchema = z.enum([
  "SALARY",
  "JOB_TITLE",
  "JOB_DESCRIPTION",
  "DEPARTMENT",
  "HOURS",
  "WORKPLACE",
  "CONTRACT_TERM",
]);

export const annexChangeSchema = z.object({
  category: annexChangeCategorySchema,
  label: z.string().min(1),
  from: z.string(),
  to: z.string(),
});

export const contractTermTypeSchema = z.enum(["INDEFINITE", "FIXED_TERM", "SPECIFIC_TASK"]);

export const createAnnexSchema = z.object({
  employeeId: z.string().min(1),
  /** ISO date (yyyy-mm-dd) when the amendment takes effect. */
  effectiveDate: z.string().min(1),
  changes: z.array(annexChangeSchema).min(1, "Zgjidhni të paktën një ndryshim."),
  /** Renewal — new contract end date (yyyy-mm-dd) or null to clear (indefinite). */
  contractEndDate: z.string().nullable().optional(),
  contractType: contractTermTypeSchema.optional(),
});

export const employeeIdSchema = z.object({ employeeId: z.string().min(1) });
