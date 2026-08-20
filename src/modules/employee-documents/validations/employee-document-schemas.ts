import { z } from "zod";

const EMPLOYEE_DOCUMENT_CATEGORIES = [
  "IDENTIFIKIM",
  "KONTRATA_TE_NENSHKRUARA",
  "KUALIFIKIME",
  "MJEKESORE",
  "DISIPLINORE",
  "DEKLARATA_PELQIME",
  "TJERA",
] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datë e pavlefshme.")
  .transform((v) => new Date(`${v}T00:00:00.000Z`));

/** The JSON half of the upload FormData; the file arrives beside it. */
export const uploadEmployeeDocumentPayloadSchema = z.object({
  employeeId: z.string().min(1),
  category: z.enum(EMPLOYEE_DOCUMENT_CATEGORIES),
  title: z.string().trim().min(2, "Titulli duhet të ketë të paktën 2 shkronja.").max(160),
  note: z.string().trim().max(2000).optional(),
  issuedAt: isoDate.optional(),
  expiresAt: isoDate.optional(),
  supersedesId: z.string().min(1).optional(),
});

export const archiveEmployeeDocumentSchema = z.object({
  documentId: z.string().min(1),
  archived: z.boolean(),
});
