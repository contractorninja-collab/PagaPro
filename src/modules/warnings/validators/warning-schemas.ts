import { z } from "zod";
import { WARNING_MEASURES } from "@/modules/warnings/types";

const optionalDate = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  const parsed = new Date(String(v));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}, z.date().nullable());

export const warningCreateSchema = z.object({
  employeeId: z.string().min(1),
  measure: z.enum(WARNING_MEASURES),
  issuedAt: z.preprocess((v) => {
    if (v instanceof Date) return v;
    const parsed = new Date(String(v));
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }, z.date()),
  summary: z.string().trim().min(10, "Përshkrimi i shkeljes duhet të ketë së paku 10 karaktere.").max(4000),
  improvementDeadline: optionalDate,
});

export type WarningCreateInput = z.infer<typeof warningCreateSchema>;

/** Same warning issued to several employees at once (one record each). */
export const warningBulkCreateSchema = warningCreateSchema
  .omit({ employeeId: true })
  .extend({ employeeIds: z.array(z.string().min(1)).min(1, "Zgjidhni së paku një punonjës.") });

export type WarningBulkCreateInput = z.infer<typeof warningBulkCreateSchema>;

export const warningDeleteSchema = z.object({
  warningId: z.string().min(1),
});
