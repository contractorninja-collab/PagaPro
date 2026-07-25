/**
 * Ensures at least one company + baseline payroll parameter set for local dev.
 * Run: `npx prisma db seed` (or `npm run db:seed`)
 */
/* eslint-disable @typescript-eslint/no-require-imports -- Prisma seed runs as plain Node */
require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { randomInt } = require("node:crypto");
const bcrypt = require("bcryptjs");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL;
const databaseSchema =
  process.env.PAGAPRO_DATABASE_SCHEMA?.trim() ||
  (process.env.VERCEL ? "pagapro" : "public");
if (!connectionString) {
  console.error(
    "A PostgreSQL connection is required via DATABASE_URL or a Vercel Postgres environment variable.",
  );
  process.exit(1);
}

const seedConnectionString = (() => {
  if (!process.env.VERCEL) return connectionString;
  const url = new URL(connectionString);
  url.searchParams.set("uselibpqcompat", "true");
  return url.toString();
})();

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString: seedConnectionString },
    { schema: databaseSchema },
  ),
});

/** Keep in sync with `KOSOVO_OFFICIAL_FIXED_HOLIDAY_DEFINITIONS` in `src/modules/payroll/calendar/kosovo-public-holidays.ts`. */
const KOSOVO_OFFICIAL_FIXED_SEED = [
  { sourceCode: "XK_NEW_YEAR", month: 1, day: 1, name: "Viti i Ri" },
  { sourceCode: "XK_ORTHODOX_CHRISTMAS", month: 1, day: 7, name: "Krishtlindjet ortodokse" },
  { sourceCode: "XK_INDEPENDENCE_DAY", month: 2, day: 17, name: "Dita e Pavarësisë" },
  { sourceCode: "XK_LABOUR_DAY", month: 5, day: 1, name: "Dita Ndërkombëtare e Punës" },
  { sourceCode: "XK_CATHOLIC_CHRISTMAS", month: 12, day: 25, name: "Krishtlindjet katolike" },
];

/**
 * Dev bootstrap: match app behaviour — seed Kosovo FIXED holidays for UTC current year only when no rows exist.
 */
async function maybeSeedKosovoOfficialFixedForCurrentYearIfEmpty(companyId) {
  const calendarYear = new Date().getUTCFullYear();
  const existing = await prisma.companyHoliday.count({
    where: { companyId, calendarYear },
  });
  if (existing > 0) return;

  await prisma.companyHoliday.createMany({
    data: KOSOVO_OFFICIAL_FIXED_SEED.map((h) => ({
      companyId,
      calendarYear,
      observedOn: new Date(Date.UTC(calendarYear, h.month - 1, h.day, 12, 0, 0, 0)),
      name: h.name,
      category: "KOSOVO_OFFICIAL_FIXED",
      isActive: true,
      sourceCode: h.sourceCode,
    })),
  });
  console.log(`Seeded Kosovo official fixed holidays for ${calendarYear} (company ${companyId}).`);
}

function upsertDevCompanyIdInEnv(companyId) {
  if (process.env.VERCEL || process.env.NODE_ENV === "production") return false;

  const envPath = path.join(__dirname, "..", ".env");
  let raw = "";
  try {
    raw = fs.readFileSync(envPath, "utf8");
  } catch {
    raw = `DATABASE_URL="${connectionString}"\n`;
  }

  const lines = raw.split(/\r?\n/);
  let replaced = false;
  const out = lines.map((line) => {
    if (/^\s*DEV_DEFAULT_COMPANY_ID\s*=/.test(line)) {
      replaced = true;
      return `DEV_DEFAULT_COMPANY_ID=${companyId}`;
    }
    return line;
  });

  if (!replaced) {
    out.push(`DEV_DEFAULT_COMPANY_ID=${companyId}`);
  }

  fs.writeFileSync(envPath, `${out.join("\n").replace(/\s+$/, "")}\n`);
  return true;
}

/** Canonical placeholder catalog for Dokumentet (aligned with `engine/placeholders/registry.ts`). */
const PLACEHOLDER_REGISTRY_SEEDS = [
  { placeholderKey: "employee_name", label: "Emri i punonjësit", category: "employee", isRequired: true, sourcePath: "employee.firstName+lastName" },
  { placeholderKey: "employee_first_name", label: "Emri", category: "employee", isRequired: false, sourcePath: "employee.firstName" },
  { placeholderKey: "employee_last_name", label: "Mbiemri", category: "employee", isRequired: false, sourcePath: "employee.lastName" },
  { placeholderKey: "employee_full_name", label: "Emri i plotë", category: "employee", isRequired: true, sourcePath: "employee.firstName+lastName" },
  { placeholderKey: "employee_personal_number", label: "Numri personal", category: "employee", isRequired: true, sourcePath: "employee.personalId" },
  { placeholderKey: "employee_birth_date", label: "Data e lindjes", category: "employee", isRequired: false, sourcePath: "employee.dateOfBirth" },
  { placeholderKey: "employee_gender", label: "Gjinia", category: "employee", isRequired: false, sourcePath: "employee.gender" },
  { placeholderKey: "employee_phone", label: "Telefoni", category: "employee", isRequired: false, sourcePath: "employee.phone" },
  { placeholderKey: "employee_email", label: "Email", category: "employee", isRequired: false, sourcePath: "employee.email" },
  { placeholderKey: "employee_address", label: "Adresa e punonjësit", category: "employee", isRequired: false, sourcePath: "employee.addressLine" },
  { placeholderKey: "employee_city", label: "Qyteti i punonjësit", category: "employee", isRequired: false, sourcePath: "employee.addressCity" },
  { placeholderKey: "employee_position", label: "Pozita", category: "employee", isRequired: false, sourcePath: "employee.jobTitle" },
  { placeholderKey: "employee_job_description", label: "Përshkrimi i punës", category: "employee", isRequired: false, sourcePath: "employee.jobTitleProfile.description" },
  { placeholderKey: "employee_job_responsibilities", label: "Përgjegjësitë e punës", category: "employee", isRequired: false, sourcePath: "employee.jobTitleProfile.responsibilities" },
  { placeholderKey: "employee_job_requirements", label: "Kërkesat e punës", category: "employee", isRequired: false, sourcePath: "employee.jobTitleProfile.requirements" },
  { placeholderKey: "employee_department", label: "Departamenti", category: "employee", isRequired: false, sourcePath: "employee.department.name" },
  { placeholderKey: "workplace", label: "Vendi i punës", category: "employee", isRequired: false, sourcePath: "employee.workplace" },
  { placeholderKey: "salary_gross", label: "Paga bruto", category: "payroll", isRequired: true, sourcePath: "employee.baseSalaryMonthly" },
  { placeholderKey: "salary_gross_words", label: "Paga bruto me fjalë", category: "payroll", isRequired: false, sourcePath: "employee.baseSalaryMonthly" },
  { placeholderKey: "daily_hours", label: "Orët ditore", category: "payroll", isRequired: false, sourcePath: "employee.weeklyHours/5" },
  { placeholderKey: "weekly_hours", label: "Orët javore", category: "payroll", isRequired: false, sourcePath: "employee.weeklyHours" },
  { placeholderKey: "monthly_hours", label: "Orët mujore", category: "payroll", isRequired: false, sourcePath: "employee.standardMonthlyHours" },
  { placeholderKey: "bank_name", label: "Banka", category: "payroll", isRequired: false, sourcePath: "employee.bankName" },
  { placeholderKey: "iban", label: "Numri i llogarisë", category: "payroll", isRequired: false, sourcePath: "employeeBankAccount.iban" },
  { placeholderKey: "apply_pension", label: "Apliko pensionin", category: "payroll", isRequired: false, sourcePath: "employee.applyTrust" },
  { placeholderKey: "apply_tax", label: "Apliko tatimin", category: "payroll", isRequired: false, sourcePath: "employee.applyTax" },
  { placeholderKey: "company_name", label: "Emri i kompanisë", category: "company", isRequired: true, sourcePath: "company.legalName" },
  { placeholderKey: "company_nui", label: "NUI (numri fiskal)", category: "company", isRequired: false, sourcePath: "company.fiscalNumber" },
  { placeholderKey: "company_nrb", label: "NRB", category: "company", isRequired: false, sourcePath: "company.businessRegistrationNumber" },
  { placeholderKey: "company_address", label: "Adresa e kompanisë", category: "company_setting", isRequired: false, sourcePath: "companySetting.companyAddressLine" },
  { placeholderKey: "company_city", label: "Qyteti i kompanisë", category: "company", isRequired: false, sourcePath: "company.city" },
  { placeholderKey: "company_phone", label: "Telefoni i kompanisë", category: "company", isRequired: false, sourcePath: "company.phone" },
  { placeholderKey: "company_email", label: "Email i kompanisë", category: "company", isRequired: false, sourcePath: "company.email" },
  { placeholderKey: "company_website", label: "Website", category: "company", isRequired: false, sourcePath: "company.website" },
  {
    placeholderKey: "authorized_person",
    label: "Personi i autorizuar",
    category: "authorized_rep",
    isRequired: false,
    sourcePath: "companySetting.authorizedRepresentativeName",
  },
  {
    placeholderKey: "authorized_person_name",
    label: "Emri i personit të autorizuar",
    category: "authorized_rep",
    isRequired: false,
    sourcePath: "companySetting.authorizedRepresentativeName",
  },
  {
    placeholderKey: "authorized_position",
    label: "Pozita e personit të autorizuar",
    category: "authorized_rep",
    isRequired: false,
    sourcePath: "companySetting.authorizedRepresentativePosition",
  },
  {
    placeholderKey: "authorized_person_position",
    label: "Pozita e personit të autorizuar",
    category: "authorized_rep",
    isRequired: false,
    sourcePath: "companySetting.authorizedRepresentativePosition",
  },
  { placeholderKey: "document_date", label: "Data e dokumentit", category: "document_metadata", isRequired: false, sourcePath: "input.documentDate" },
  { placeholderKey: "document_place", label: "Vendi i nënshkrimit", category: "document_metadata", isRequired: false, sourcePath: "input.documentPlace" },
  {
    placeholderKey: "company_registered_address",
    label: "Adresa e regjistruar",
    category: "company_setting",
    isRequired: false,
  },
  { placeholderKey: "contract_start_date", label: "Data e fillimit të kontratës", category: "contract", isRequired: true, sourcePath: "input.contractStartDate" },
  { placeholderKey: "contract_end_date", label: "Data e mbarimit të kontratës", category: "contract", isRequired: false, sourcePath: "input.contractEndDate" },
  { placeholderKey: "contract_duration", label: "Kohëzgjatja e kontratës", category: "contract", isRequired: false },
  { placeholderKey: "employment_start_date", label: "Fillimi i punësimit", category: "employment", isRequired: false, sourcePath: "employee.hireDate" },
  { placeholderKey: "probation_end_date", label: "Mbarimi i punës provuese", category: "contract", isRequired: false, sourcePath: "input.contractStartDate+6m" },
  { placeholderKey: "probation_months", label: "Muajt e punës praktike", category: "contract", isRequired: false, sourcePath: "employee.probationMonths" },
  { placeholderKey: "travel_compensation", label: "Kompensimi i udhëtimit zyrtar", category: "contract", isRequired: false },
  { placeholderKey: "employment_end_date", label: "Mbarimi i punësimit", category: "employment", isRequired: false, sourcePath: "employee.terminationDate" },
  { placeholderKey: "employment_type", label: "Lloji i punësimit", category: "employment", isRequired: false, sourcePath: "employee.employmentType" },
  { placeholderKey: "work_type", label: "Mënyra e punës", category: "employment", isRequired: false, sourcePath: "employee.workArrangement" },
  { placeholderKey: "contract_type", label: "Lloji i kontratës", category: "contract", isRequired: false, sourcePath: "template.templateSubtype" },
  { placeholderKey: "probation_period", label: "Periudha e punës praktike", category: "contract", isRequired: false, sourcePath: "employee.probationMonths" },
  { placeholderKey: "notes", label: "Shënime", category: "document_metadata", isRequired: false },
  { placeholderKey: "leave_start_date", label: "Fillimi i pushimit", category: "leave", isRequired: true },
  { placeholderKey: "leave_end_date", label: "Mbarimi i pushimit", category: "leave", isRequired: true },
  { placeholderKey: "leave_type", label: "Lloji i pushimit", category: "leave", isRequired: false },
  { placeholderKey: "leave_status", label: "Statusi i kërkesës", category: "leave", isRequired: false },
  { placeholderKey: "leave_note", label: "Shënim", category: "leave", isRequired: false },
  {
    placeholderKey: "termination_last_working_day",
    label: "Dita e fundit e punës",
    category: "termination",
    isRequired: true,
  },
  { placeholderKey: "termination_type", label: "Lloji i ndërprerjes", category: "termination", isRequired: false },
  {
    placeholderKey: "termination_notice_days",
    label: "Ditët e njoftimit",
    category: "termination",
    isRequired: false,
  },
  { placeholderKey: "termination_severance", label: "Kompensimi", category: "termination", isRequired: false },
  { placeholderKey: "termination_reason", label: "Arsyeja", category: "termination", isRequired: false },
  { placeholderKey: "termination_status", label: "Statusi", category: "termination", isRequired: false },
  { placeholderKey: "warning_issued_at", label: "Data e lëshimit", category: "warning", isRequired: true },
  { placeholderKey: "warning_summary", label: "Përmbledhje", category: "warning", isRequired: true },
  { placeholderKey: "warning_severity", label: "Rëndësia", category: "warning", isRequired: false },
  { placeholderKey: "warning_status", label: "Statusi", category: "warning", isRequired: false },
  { placeholderKey: "payroll_month_name", label: "Muaji i pagës", category: "payroll", isRequired: false },
  { placeholderKey: "payroll_year", label: "Viti", category: "payroll", isRequired: false },
  { placeholderKey: "payroll_period_label", label: "Periudha", category: "payroll", isRequired: false },
  { placeholderKey: "document_title", label: "Titulli", category: "document_metadata", isRequired: false },
];

async function seedPlaceholderRegistryIfNeeded() {
  for (const r of PLACEHOLDER_REGISTRY_SEEDS) {
    await prisma.placeholderRegistry.upsert({
      where: { placeholderKey: r.placeholderKey },
      create: {
        placeholderKey: r.placeholderKey,
        label: r.label,
        category: r.category,
        isRequired: r.isRequired,
        sourcePath: r.sourcePath ?? null,
        isActive: true,
      },
      update: {
        label: r.label,
        category: r.category,
        isRequired: r.isRequired,
        sourcePath: r.sourcePath ?? null,
        isActive: true,
      },
    });
  }
  console.log(`Synced placeholder_registry (${PLACEHOLDER_REGISTRY_SEEDS.length} keys).`);
}

/** Readable random password (no ambiguous chars) for the bootstrap admin when env doesn't provide one. */
function generateBootstrapPassword() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const block = () =>
    Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join("");
  return `${block()}-${block()}-${block()}`;
}

/** Bootstraps the first platform super-admin (backstage console) if none exists. */
async function maybeSeedPlatformAdmin() {
  const existing = await prisma.user.findFirst({
    where: { isPlatformAdmin: true },
    select: { email: true },
  });
  if (existing) {
    console.log(`Platform admin already exists: ${existing.email}`);
    return;
  }

  const email = (process.env.SEED_ADMIN_EMAIL || "admin@pagapro.local").trim().toLowerCase();
  const envPassword = process.env.SEED_ADMIN_PASSWORD?.trim();
  const password = envPassword || generateBootstrapPassword();
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { isPlatformAdmin: true, status: "ACTIVE", passwordHash },
    create: {
      email,
      displayName: "Administratori i PagaPRO",
      status: "ACTIVE",
      isPlatformAdmin: true,
      passwordHash,
      mustChangePassword: !envPassword,
    },
  });

  console.log("\n=== Platform admin (backstage console) ===");
  console.log(`Email:    ${email}`);
  if (envPassword) {
    console.log("Password: (from SEED_ADMIN_PASSWORD)");
  } else {
    console.log(`Password: ${password}`);
    console.log("Save this password now — it is shown only once and must be changed on first login.");
  }
  const adminPath =
    process.env.NEXT_PUBLIC_PAGAPRO_ADMIN_PATH || "/admin-console";
  console.log(`Login at /hyrje, console at ${adminPath}.\n`);
}

async function main() {
  await seedPlaceholderRegistryIfNeeded();
  await maybeSeedPlatformAdmin();

  let companyCreated = false;
  let company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });

  if (!company) {
    company = await prisma.company.create({
      data: {
        legalName: "PagaPRO Dev Kompania",
      },
    });
    companyCreated = true;
    console.log(`Created company: ${company.id}`);
  } else {
    console.log(`Using existing company: ${company.id}`);
  }

  if (companyCreated) {
    await maybeSeedKosovoOfficialFixedForCurrentYearIfEmpty(company.id);
  }

  const params = await prisma.payrollParameterSet.findFirst({
    where: { companyId: company.id },
  });

  if (!params) {
    await prisma.payrollParameterSet.create({
      data: {
        companyId: company.id,
        effectiveFrom: new Date("2020-01-01T00:00:00.000Z"),
        label: "Dev baseline",
        minimumMonthlyWage: "350",
        pensionEmployeeRate: "0.05",
        pensionEmployerRate: "0.05",
      },
    });
    console.log("Created default PayrollParameterSet for dev.");
  }

  const leavePolicy = await prisma.leavePolicyParameterSet.findFirst({
    where: { companyId: company.id },
  });

  if (!leavePolicy) {
    await prisma.leavePolicyParameterSet.create({
      data: {
        companyId: company.id,
        effectiveFrom: new Date("2000-01-01T00:00:00.000Z"),
      },
    });
    console.log("Created default LeavePolicyParameterSet.");
  }

  if (upsertDevCompanyIdInEnv(company.id)) {
  console.log(`\nUpdated .env → DEV_DEFAULT_COMPANY_ID=${company.id}`);

  }

  const { seedContractTemplates } = require("../scripts/seed-contract-templates.cjs");
  await seedContractTemplates(prisma);
  const { seedLeaveTemplates } = require("../scripts/seed-leave-templates.cjs");
  await seedLeaveTemplates(prisma);
  const { seedTerminationTemplates } = require("../scripts/seed-termination-templates.cjs");
  await seedTerminationTemplates(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
