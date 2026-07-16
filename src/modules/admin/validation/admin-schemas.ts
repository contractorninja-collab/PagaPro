import { z } from "zod";
import { isValidCompanyDomain, normalizeCompanyDomain, normalizeCompanySlug } from "@/lib/company-url";

const emptyToNull = (v: unknown) => {
  if (typeof v !== "string") return v ?? null;
  const t = v.trim();
  return t === "" ? null : t;
};

const slugInputSchema = z.preprocess(
  emptyToNull,
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (typeof v === "string" ? normalizeCompanySlug(v) : null))
    .refine((v) => v === null || v.length >= 2, "Slug duhet të ketë të paktën 2 karaktere.")
    .refine((v) => v === null || /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(v), "Slug nuk është valid."),
);

const customDomainInputSchema = z.preprocess(
  emptyToNull,
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (typeof v === "string" ? normalizeCompanyDomain(v) : null))
    .refine((v) => v === null || isValidCompanyDomain(v), "Domain nuk është valid."),
);

/** Company (business customer) create/update payload — Albanian field labels in UI. */
export const companyUpsertSchema = z.object({
  legalName: z
    .string()
    .trim()
    .min(2, "Emri i biznesit duhet të ketë të paktën 2 karaktere.")
    .max(255, "Emri i biznesit është shumë i gjatë."),
  tradeName: z.preprocess(emptyToNull, z.string().max(255).nullable().optional()),
  slug: slugInputSchema,
  customDomain: customDomainInputSchema,
  /// NUI — numri unik identifikues (fiscal number)
  fiscalNumber: z.preprocess(emptyToNull, z.string().max(64).nullable().optional()),
  /// NRB — numri i regjistrimit të biznesit
  businessRegistrationNumber: z.preprocess(emptyToNull, z.string().max(64).nullable().optional()),
  email: z.preprocess(
    emptyToNull,
    z.union([z.string().email("Email jo valid"), z.null()]).optional(),
  ),
  phone: z.preprocess(emptyToNull, z.string().max(64).nullable().optional()),
  website: z.preprocess(emptyToNull, z.string().max(512).nullable().optional()),
  addressLine: z.preprocess(emptyToNull, z.string().max(500).nullable().optional()),
  city: z.preprocess(emptyToNull, z.string().max(120).nullable().optional()),
  postalCode: z.preprocess(emptyToNull, z.string().max(32).nullable().optional()),
});

export type CompanyUpsertInput = z.infer<typeof companyUpsertSchema>;

export const companyStatusSchema = z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]);

export const MEMBERSHIP_ROLES = ["OWNER", "ADMIN", "HR_MANAGER", "ACCOUNTANT", "READ_ONLY"] as const;

export const createCompanyUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email jo valid."),
  displayName: z.preprocess(emptyToNull, z.string().max(255).nullable().optional()),
  role: z.enum(MEMBERSHIP_ROLES),
});

export type CreateCompanyUserInput = z.infer<typeof createCompanyUserSchema>;

export function formatAdminFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] = out[key] ?? [];
    out[key].push(issue.message);
  }
  return out;
}
