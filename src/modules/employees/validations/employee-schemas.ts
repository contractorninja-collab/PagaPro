import { z } from "zod";

const emptyToNull = (v: unknown): unknown => {
  if (v === undefined) return null;
  // A field left as spaces is an empty field: store null, not "".
  if (typeof v === "string" && v.trim() === "") return null;
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
export const employerPrimacyFieldSchema = z.enum(["PRIMARY", "SECONDARY"]);
/**
 * Only the two the form offers. The column's enum still carries OTHER and
 * UNSPECIFIED so records saved before this keep their value and still display,
 * but nothing can write them again.
 */
export const genderFieldSchema = z.enum(["MALE", "FEMALE"]);

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

/**
 * Kosovo bank account numbers are 16 digits. Exported so the form can say the
 * same thing while the client types that the server says on submit — one rule,
 * one message, no chance of the two drifting apart.
 */
export const BANK_ACCOUNT_NUMBER_PATTERN = /^\d{16}$/;
export const BANK_ACCOUNT_NUMBER_MESSAGE = "Numri i llogarisë duhet të ketë 16 shifra.";

/** True when a typed value is present and not yet 16 digits — for live feedback. */
export function bankAccountNumberError(raw: string): string | null {
  const compact = raw.replace(/\s+/g, "");
  if (compact.length === 0) return null;
  return BANK_ACCOUNT_NUMBER_PATTERN.test(compact) ? null : BANK_ACCOUNT_NUMBER_MESSAGE;
}

/**
 * Brings a written account number to the sixteen digits the rule requires, or
 * refuses it. For bulk paths (CSV import) where nobody is at the keyboard to be
 * told what to retype.
 *
 * Two conversions are safe, because both change the presentation and not the
 * number:
 *
 *   - separators come out — spreadsheets group digits with spaces, dots,
 *     dashes and slashes;
 *   - a Kosovo IBAN loses its XK and two check digits, because an XK IBAN IS
 *     the account number with a country prefix. "XK05 1212 0123 4567 8906" and
 *     "1212012345678906" are the same account, which is why the app used to
 *     store either and why the register carried both forms until they were
 *     reconciled.
 *
 * Everything else is refused. Padding a short number or truncating a long one
 * would produce a well-formed account number belonging to somebody else, and a
 * salary would follow it there.
 */
export function normalizeBankAccountNumber(raw: string): { value: string | null; error: string | null } {
  const compact = raw.replace(/[\s.\-/]/g, "").toUpperCase();
  if (compact === "") return { value: null, error: null };
  if (BANK_ACCOUNT_NUMBER_PATTERN.test(compact)) return { value: compact, error: null };
  if (/^XK\d{18}$/.test(compact)) return { value: compact.slice(4), error: null };
  return { value: null, error: BANK_ACCOUNT_NUMBER_MESSAGE };
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
    jobTitleId: z.string().cuid("Zgjidhni një pozitë valide"),
    jobTitle: z.string().trim().max(200).optional(),
    probationMonths: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : v),
      z.coerce
        .number()
        .int("Muajt e punës praktike duhet të jenë numër i plotë")
        .min(0, "Muajt e punës praktike nuk mund të jenë negativ")
        .nullable()
        .optional(),
    ),
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

    /// Si jepet paga bruto e punonjësit: MONTHLY = shumë mujore fikse (administrata),
    /// HOURLY = €/orë (punëtorë fabrike) — payroll-i pastaj paguan orë × tarifë.
    salaryBasis: z.enum(["MONTHLY", "HOURLY"]).default("MONTHLY"),

    /// Tarifa orare — e detyrueshme praktikisht vetëm për kontraktorët (payroll-i i tyre
    /// llogaritet orë × tarifë); për punonjësit e rregullt mbetet bosh.
    hourlyRate: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : v),
      z.coerce
        .number({ message: "Tarifa orare duhet të jetë numër" })
        .nonnegative("Tarifa orare nuk mund të jetë negative")
        .nullable()
        .optional(),
    ),
    weeklyHours: z.coerce.number({ message: "Orët javore duhet të jenë numër" }).min(0).max(168).default(40),

    bankName: z.preprocess(emptyToNull, z.string().max(120).nullable().optional()),
    bankAccountIban: z.preprocess(
      // Spaces are how people read a 16-digit number out loud, so accept them
      // and strip rather than rejecting "1234 5678 9012 3456".
      (v) => (typeof v === "string" ? emptyToNull(v.replace(/\s+/g, "")) : emptyToNull(v)),
      z
        .string()
        .regex(BANK_ACCOUNT_NUMBER_PATTERN, BANK_ACCOUNT_NUMBER_MESSAGE)
        .nullable()
        .optional(),
    ),
    applyTrust: z.boolean(),
    applyTax: z.boolean(),

    /// A punonjësi këtu kompaninë kryesore apo dytësore? Sekondar = tatim me normë fikse
    /// (Ligji mbi TAP). Punonjësi vetë mban përgjegjësinë t'ia deklarojë punëdhënësit të vet.
    employerPrimacy: employerPrimacyFieldSchema.default("PRIMARY"),

    /// Shtetas i huaj (qëndrim i përkohshëm) — the form auto-sets applyTrust=false.
    isForeignNational: z.boolean().default(false),
    residencePermitExpiryDate: z.preprocess(parseOptionalDate, z.date().nullable().optional()),

    /// Vendi i punës (Neni 11.1.4) — bosh = selia e kompanisë.
    workplace: z.preprocess(emptyToNull, z.string().trim().max(200).nullable().optional()),

    /// Kualifikimi (Neni 11.1.3) — shkollimi/përgatitja profesionale, printohet në kontratë.
    qualification: z.preprocess(emptyToNull, z.string().trim().max(200).nullable().optional()),

    /// Vite të plota përvojë pune para kësaj kompanie (Neni 37.2: +1 ditë pushimi / 5 vjet
    /// përvojë totale). Vërtetohet me vërtetim përvoje ose regjistrat e Trustit.
    priorWorkExperienceYears: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? 0 : v),
      z.coerce
        .number({ message: "Përvoja duhet të jetë numër" })
        .int("Përvoja shënohet në vite të plota")
        .min(0, "Përvoja nuk mund të jetë negative")
        .max(50, "Maksimumi 50 vjet"),
    ).default(0),

    /// Kodi i kartelës së skanimit — unik brenda kompanisë, vetëm kur ora e punës është aktive.
    badgeCode: z.preprocess(emptyToNull, z.string().trim().max(64).nullable().optional()),

    emergencyContactName: z.preprocess(emptyToNull, z.string().trim().max(200).nullable().optional()),
    emergencyContactPhone: z.preprocess(emptyToNull, z.string().trim().max(64).nullable().optional()),
    emergencyContactRelationship: z.preprocess(emptyToNull, z.string().trim().max(120).nullable().optional()),

    internalNotes: z.preprocess(emptyToNull, z.string().max(10000).nullable().optional()),
    documentsMissing: z.boolean(),
    terminationDate: z.preprocess(parseOptionalDate, z.date().nullable().optional()),
    terminationReason: z.preprocess(emptyToNull, z.string().max(5000).nullable().optional()),
  })
  .superRefine((data, ctx) => {
    if (data.salaryBasis === "HOURLY" && (data.hourlyRate == null || data.hourlyRate <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hourlyRate"],
        message:
          data.employmentType === "CONTRACTOR"
            ? "Vendosni tarifën neto orare (€/orë)."
            : "Vendosni tarifën orare bruto (€/orë).",
      });
    }
    // A contractor on the flat basis is exempt from the minimum-salary floor, so
    // nothing else would stop a fee of 0 from being saved and paid.
    if (
      data.employmentType === "CONTRACTOR" &&
      data.salaryBasis === "MONTHLY" &&
      data.baseSalaryMonthly <= 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["baseSalaryMonthly"],
        message: "Vendosni pagën neto mujore të kontraktorit.",
      });
    }
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

export const rehireEmployeeSchema = z.object({
  employeeId: z.string().cuid(),
  rehireDate: z.preprocess((v) => {
    if (v instanceof Date) return v;
    if (typeof v === "string" && v.trim()) return new Date(v);
    return undefined;
  }, z.date({ message: "Data e rikthimit është e detyrueshme" })),
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
