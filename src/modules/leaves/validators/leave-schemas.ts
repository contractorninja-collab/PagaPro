import { LeaveSubtype } from "@prisma/client";
import { z } from "zod";

export const leaveTypeSchema = z.enum([
  "PUSHIM_VJETOR",
  "PUSHIM_MJEKESOR",
  "PUSHIM_PERSONAL",
  "PUSHIM_PA_PAGESE",
  "PUSHIM_LEHONIE",
  "TJETER",
]);

export const leaveSubtypeSchema = z.nativeEnum(LeaveSubtype);

export const leaveRequestCreateSchema = z.object({
  employeeId: z.string().min(1),
  type: leaveTypeSchema,
  subtype: leaveSubtypeSchema.optional().nullable(),
  startDateIso: z.string().min(1),
  endDateIso: z.string().min(1),
  reason: z.string().optional().nullable(),
});
export const leaveRequestIdSchema = z.object({
  leaveId: z.string().min(1),
});

export const leaveRejectSchema = leaveRequestIdSchema.extend({
  rejectionReason: z
    .string()
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : "Refuzuar nga HR.")),
});

export const leaveRevokeSchema = leaveRequestIdSchema.extend({
  reason: z.string().optional().nullable(),
});

export const leaveGenerateDocSchema = z.object({
  leaveRequestId: z.string().min(1),
  documentTemplateId: z.string().min(1),
});

export const leaveInterruptLinkSchema = z.object({
  annualLeaveId: z.string().min(1),
  sickLeaveId: z.string().min(1),
});
