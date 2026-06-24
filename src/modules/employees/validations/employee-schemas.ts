import { z } from "zod";

const emptyToNull = (v: unknown): unknown => {
  if (v === "" || v === undefined) return null;
  return v;
};

export const employmentTypeFieldSchema = z.enum(["EMPLOYEE", "CONTRACTOR"]);
export const employmentStatusFieldSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "ON_LEAVE",
  "SUSPENDED",
  "TERMINATED",
]);
export const workArrangementFieldSchema = z.enum(["ON_SITE", "REMOTE", "HYBRID"]);
export const genderFieldSchema = z.enum(["MALE", "FEMALE", "OTHER", "UNSPECIFIED"]);

function parseOptionalDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export const employeeUpsertSchema = z
  .object({
    firstName: z.string().trim().min(1, "Emri është i detyrueshëm"),
    lastName: z.string().trim().min(1, "Mbiemri është i detyrueshëm"),
    personalId: z.string().trim().min(1, "Numri personal është i detyrueshëm"),
    dateOfBirth: z.preprocess(parseOptionalDate, z.date().nullable().optional()),
    gender: z.preprocess((v) => (v === "" || v === undefined || v === null ? null : v), genderFieldSchema.nullable().optional()),
    phone: z.preprocess(emptyToNull, z.string().max(64).nullable().optional()),
    email: z.preprocess((v) => {
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      return t === "" ? null : t;
    }, z.union([z.string().email("Email jo valid"), z.null()]).optional()),
    addressLine: z.preprocess(emptyToNull, z.string().max(500).nullable().optional()),
    addressCity: z.preprocess(emptyToNull, z.string().max(120).nullable().optional()),
    addressCountry: z.preprocess(emptyToNull, z.string().max(64).nullable().optional()),

    departmentId: z.preprocess(emptyToNull, z.string().cuid().nullable().optional()),
    jobTitle: z.preprocess(emptyToNull, z.string().max(200).nullable().optional()),
    hireDate: z.preprocess((v) => {
      if (v instanceof Date) return v;
      if (typeof v === "string" && v.trim()) return new Date(v);
      return undefined;
    }, z.date({ message: "Data e punësimit është e detyrueshme" })),
    status: z.enum(["ACTIVE", "INACTIVE", "ON_LEAVE", "SUSPENDED"], {
      message: "Status i pavlefshëm",
    }),
    employmentType: employmentTypeFieldSchema,
    workArrangement: workArrangementFieldSchema,

    baseSalaryMonthly: z.coerce.number({ message: "Paga bruto duhet të jetë numër" }).nonnegative("Paga bruto nuk mund të jetë negative"),
    weeklyHours: z.coerce.number({ message: "Orët javore duhet të jenë numër" }).min(0).max(168).default(40),

    bankName: z.preprocess(emptyToNull, z.string().max(120).nullable().optional()),
    bankAccountIban: z.preprocess(emptyToNull, z.string().max(64).nullable().optional()),
    applyTrust: z.boolean(),
    applyTax: z.boolean(),

    emergencyContactName: z.string().trim().min(1, "Emri i kontaktit emergjent është i detyrueshëm"),
    emergencyContactPhone: z.string().trim().min(1, "Telefoni i kontaktit emergjent është i detyrueshëm"),
    emergencyContactRelationship: z.string().trim().min(1, "Raporti familjar është i detyrueshëm"),

    internalNotes: z.preprocess(emptyToNull, z.string().max(10000).nullable().optional()),
    documentsMissing: z.boolean(),
    terminationDate: z.preprocess(parseOptionalDate, z.date().nullable().optional()),
    terminationReason: z.preprocess(emptyToNull, z.string().max(5000).nullable().optional()),
  })
  .transform((data) => {
    if (data.employmentType === "CONTRACTOR") {
      return {
        ...data,
        applyTrust: false,
        applyTax: false,
        exemptFromMinimumSalary: true as const,
      };
    }
    return { ...data, exemptFromMinimumSalary: false as const };
  });

export type EmployeeUpsertInput = z.infer<typeof employeeUpsertSchema>;

export const terminateEmployeeSchema = z.object({
  employeeId: z.string().cuid(),
  terminationDate: z.preprocess((v) => {
    if (v instanceof Date) return v;
    if (typeof v === "string" && v.trim()) return new Date(v);
    return undefined;
  }, z.date({ message: "Data e largimit është e detyrueshme" })),
  terminationReason: z.string().trim().min(1, "Arsyeja e largimit është e detyrueshme"),
});

export function formatEmployeeFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_root";
    if (!out[path]) out[path] = [];
    out[path].push(issue.message);
  }
  return out;
}
