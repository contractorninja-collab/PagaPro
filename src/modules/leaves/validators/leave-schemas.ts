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
  /// Aprovimi me shkrim i menaxhmentit për tejkalim bilanci (emri/pozita) —
  /// vetëm kur kërkesa kalon ditët e akumuluara.
  balanceOverrideApprovedBy: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().min(3, "Shkruani kush e aprovoi tejkalimin.").max(200).nullable().optional(),
  ),
});
export const leaveRequestIdSchema = z.object({
  leaveId: z.string().min(1),
});

/**
 * Bulk approval takes the visible queue, which the server pins at 200 rows —
 * the cap follows from that, not from taste. Duplicates are rejected rather
 * than deduplicated silently: a client sending the same id twice is confused,
 * and approving is not the place to guess what it meant.
 */
export const leaveBulkApproveSchema = z.object({
  leaveIds: z
    .array(z.string().min(1))
    .min(1, "Zgjidhni të paktën një kërkesë.")
    .max(200, "Maksimumi 200 kërkesa në një veprim.")
    .refine((ids) => new Set(ids).size === ids.length, "Lista përmban ID të përsëritura."),
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

/** Read-only preview of a range before the request exists — no side effects. */
export const leaveRangePreviewSchema = z.object({
  employeeId: z.string().min(1),
  type: leaveTypeSchema,
  startDateIso: z.string().min(1),
  endDateIso: z.string().min(1),
});
