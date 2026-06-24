import { z } from "zod";

export const terminationTypeSchema = z.enum([
  "LARGIM_VULLNETAR",
  "PA_PARALAJMERIM",
  "MARREVESHJE_E_DYANSHME",
  "NGA_PUNEDHENESI",
  "MANUAL",
]);

export const terminationStatusSchema = z.enum([
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "COMPLETED",
  "CANCELLED",
]);

function refineReasonDetails(
  data: { type: z.infer<typeof terminationTypeSchema>; reason?: string | null; details?: string | null },
  ctx: z.RefinementCtx,
): void {
  if (data.type === "PA_PARALAJMERIM" || data.type === "NGA_PUNEDHENESI") {
    if (!(data.reason?.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Arsyeja është e detyrueshme për këtë lloj largimi.",
        path: ["reason"],
      });
    }
  }
  if (data.type === "MANUAL") {
    if (!(data.details?.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Detajet janë të detyrueshme për largim manual.",
        path: ["details"],
      });
    }
  }
}

export const terminationCreateSchema = z
  .object({
    employeeId: z.string().min(1),
    type: terminationTypeSchema,
    terminationDate: z.coerce.date(),
    noticeDate: z.coerce.date().optional().nullable(),
    lastWorkingDay: z.coerce.date(),
    noticeDays: z.coerce.number().int().min(0).optional().nullable(),
    severanceAmount: z.string().optional().nullable(),
    reason: z.string().optional().nullable(),
    details: z.string().optional().nullable(),
    finalPayrollRequired: z.boolean().optional().default(true),
  })
  .superRefine(refineReasonDetails);

export const terminationUpdateSchema = z
  .object({
    id: z.string().min(1),
    type: terminationTypeSchema.optional(),
    terminationDate: z.coerce.date().optional(),
    noticeDate: z.coerce.date().optional().nullable(),
    lastWorkingDay: z.coerce.date().optional(),
    noticeDays: z.coerce.number().int().min(0).optional().nullable(),
    severanceAmount: z.string().optional().nullable(),
    reason: z.string().optional().nullable(),
    details: z.string().optional().nullable(),
    finalPayrollRequired: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const type = data.type;
    if (!type) return;
    refineReasonDetails(
      {
        type,
        reason: data.reason,
        details: data.details,
      },
      ctx,
    );
  });

export const terminationIdSchema = z.object({
  id: z.string().min(1),
});

export const checklistToggleSchema = z.object({
  terminationId: z.string().min(1),
  itemKey: z.string().min(1),
  isCompleted: z.boolean(),
});
