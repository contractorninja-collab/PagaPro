import { randomUUID } from "node:crypto";
import { z } from "zod";

export const documentSubjectKindSchema = z.enum([
  "CONTRACT",
  "LEAVE",
  "TERMINATION",
  "WARNING",
  "PAYROLL",
  "OTHER",
]);

export const documentCategorySchema = z.enum([
  "CONTRACT",
  "LEAVE",
  "TERMINATION",
  "WARNING",
  "PAYROLL",
  "OTHER",
]);

function parseDocumentDate(v: unknown): Date {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function parseOptionalDocumentDate(v: unknown): Date | undefined {
  if (v == null || (typeof v === "string" && !v.trim())) return undefined;
  const d = parseDocumentDate(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export const documentTemplateSubtypeSchema = z.enum([
  "AFAT_I_CAKTUAR",
  "AFAT_I_PACAKTUAR",
  "PRAKTIKANT",
]);

/** Subtypes whose contracts are always fixed-term — an end date is mandatory. */
export const FIXED_TERM_SUBTYPES: ReadonlyArray<z.infer<typeof documentTemplateSubtypeSchema>> = [
  "AFAT_I_CAKTUAR",
  "PRAKTIKANT",
];

export const generateDocumentPayloadSchema = z.object({
  documentTemplateId: z.string().min(1),
  templateVersionId: z.string().optional(),
  subjectKind: documentSubjectKindSchema,
  subjectId: z.string().optional(),
  employeeId: z.string().optional().nullable(),
  payrollId: z.string().optional().nullable(),
  manualOverrides: z.record(z.string(), z.string()).optional(),
  documentDateIso: z.string().optional(),
  contractStartDateIso: z.string().optional(),
  contractEndDateIso: z.string().optional().nullable(),
  title: z.string().optional(),
  supersedesArtifactId: z.string().optional().nullable(),
});

export type GenerateDocumentPayloadInput = z.infer<typeof generateDocumentPayloadSchema>;

/** Mass generation: one final document per selected employee (CONTRACT/OTHER templates). */
export const bulkGenerateDocumentsSchema = z.object({
  documentTemplateId: z.string().min(1),
  employeeIds: z.array(z.string().min(1)).min(1, "Zgjidhni të paktën një punonjës.").max(200),
  documentDateIso: z.string().optional(),
  contractStartDateIso: z.string().optional(),
  contractEndDateIso: z.string().optional().nullable(),
});

export type BulkGenerateDocumentsInput = z.infer<typeof bulkGenerateDocumentsSchema>;

/** Contract generation by legal subtype (fixed-term / indefinite). */
export const generateContractDocumentsSchema = z
  .object({
    templateSubtype: documentTemplateSubtypeSchema,
    employeeIds: z.array(z.string().min(1)).min(1, "Zgjidhni të paktën një punonjës.").max(200),
    contractStartDateIso: z.string().min(1, "Zgjidhni datën e fillimit të kontratës."),
    contractEndDateIso: z.string().optional().nullable(),
    documentDateIso: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (FIXED_TERM_SUBTYPES.includes(val.templateSubtype) && !val.contractEndDateIso?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Për kontratën me afat të caktuar zgjidhni datën e mbarimit.",
        path: ["contractEndDateIso"],
      });
    }
  });

export type GenerateContractDocumentsInput = z.infer<typeof generateContractDocumentsSchema>;

export const generateHrDocumentsBatchSchema = z
  .object({
    documentTemplateId: z.string().min(1),
    templateVersionId: z.string().optional(),
    subjectKind: documentSubjectKindSchema,
    subjectIds: z.array(z.string().min(1)).min(1, "Zgjidhni të paktën një subjekt.").max(200),
    employeeIds: z.array(z.string().min(1)).optional(),
    documentDateIso: z.string().optional(),
    contractStartDateIso: z.string().optional(),
    contractEndDateIso: z.string().optional().nullable(),
    title: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.subjectKind === "CONTRACT" && !val.contractStartDateIso?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Për kontratat zgjidhni datën e fillimit.",
        path: ["contractStartDateIso"],
      });
    }
  });

export type GenerateHrDocumentsBatchInput = z.infer<typeof generateHrDocumentsBatchSchema>;

export function resolvedSubjectIdAndDate(input: GenerateDocumentPayloadInput): {
  subjectId: string;
  documentDate: Date;
  contractStartDate?: Date;
  contractEndDate?: Date | null;
} {
  let subjectId = input.subjectId?.trim() ?? "";
  if (!subjectId && input.subjectKind === "OTHER") {
    subjectId = randomUUID();
  }
  return {
    subjectId,
    documentDate: parseDocumentDate(input.documentDateIso ?? undefined),
    contractStartDate: parseOptionalDocumentDate(input.contractStartDateIso),
    contractEndDate:
      input.contractEndDateIso === null
        ? null
        : parseOptionalDocumentDate(input.contractEndDateIso ?? undefined),
  };
}

export const uploadTemplateVersionFormSchema = z.object({
  templateId: z.string().optional(),
  newTemplateName: z.string().optional(),
  documentCategory: documentCategorySchema.optional(),
  contractKind: z.enum(["EMPLOYMENT", "CONTRACTOR_AGREEMENT", "AMENDMENT"]).optional().nullable(),
  changelog: z.string().optional(),
});

export const publishTemplateVersionSchema = z.object({
  templateId: z.string().min(1),
  versionId: z.string().min(1),
});

export const setTemplateActiveSchema = z.object({
  templateId: z.string().min(1),
  isActive: z.boolean(),
});

export const updateTemplateTerminationKeySchema = z.object({
  templateId: z.string().min(1),
  terminationWorkflowKey: z
    .union([
      z.literal(""),
      z.enum([
        "LARGIM_VULLNETAR",
        "PA_PARALAJMERIM",
        "MARREVESHJE_E_DYANSHME",
        "NGA_PUNEDHENESI",
        "MANUAL",
      ]),
    ])
    .transform((v) => (v === "" ? null : v)),
});

export const archiveArtifactSchema = z.object({
  artifactId: z.string().min(1),
  archived: z.boolean(),
});

export const logDownloadSchema = z.object({
  artifactId: z.string().min(1),
});

const blankFieldMappingSchema = z.object({
  index: z.number().int().positive(),
  placeholderKey: z.string().min(1),
  label: z.string().optional(),
  required: z.boolean().optional(),
  fallback: z.string().optional(),
});

const placeholderFieldMappingSchema = z.object({
  key: z.string().min(1),
  required: z.boolean().optional(),
  fallback: z.string().optional(),
});

export const saveTemplateMappingSchema = z.object({
  templateId: z.string().min(1),
  versionId: z.string().min(1),
  mappingJson: z.object({
    blankFields: z.array(blankFieldMappingSchema),
    placeholders: z.array(placeholderFieldMappingSchema),
  }),
});

export const previewPlaceholderValuesSchema = z.object({
  templateVersionId: z.string().min(1),
  subjectKind: documentSubjectKindSchema,
  subjectId: z.string().min(1),
  employeeId: z.string().optional(),
  payrollId: z.string().optional(),
  documentDateIso: z.string().optional(),
  documentPlace: z.string().optional(),
  contractStartDateIso: z.string().optional(),
  contractEndDateIso: z.string().optional().nullable(),
  manualOverrides: z.record(z.string(), z.string()).optional(),
});
