/**
 * DEMO USER — a permanent, stable demo tenant for sales demonstrations.
 *
 * Idempotent by slug: if the company already exists, NOTHING is touched, so
 * the demo stays exactly as configured no matter how many deploys run. Safe
 * to keep in vercel-build permanently. Runs BEFORE seed-templates.cjs in the
 * chain, so the new company receives all document templates in the same build.
 *
 * Mirrors provisionCompany (company row → full official holiday calendar,
 * fixed + known-date movable feasts → payroll parameter set → leave policy)
 * plus: one stable ADMIN login and 15 Albanian employees, none contractors.
 */
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const bcrypt = require("bcryptjs");

const DEMO_SLUG = "demo-user";
const DEMO_EMAIL = "demo@paga-pro.com";
const DEMO_PASSWORD = "Demo-PagaPRO-2026!";

/** Connection + schema must mirror src/lib/prisma.ts — see encrypt-bank-fields.cjs. */
function resolveConnectionString() {
  const raw =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    null;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!process.env.VERCEL) return trimmed;
  const url = new URL(trimmed);
  url.searchParams.set("uselibpqcompat", "true");
  return url.toString();
}

function resolveSchema() {
  return process.env.PAGAPRO_DATABASE_SCHEMA?.trim() || (process.env.VERCEL ? "pagapro" : "public");
}

/** Keep in sync with src/modules/payroll/calendar/kosovo-public-holidays.ts */
const FIXED_HOLIDAYS = [
  { sourceCode: "XK_NEW_YEAR", month: 1, day: 1, name: "Viti i Ri" },
  { sourceCode: "XK_ORTHODOX_CHRISTMAS", month: 1, day: 7, name: "Krishtlindjet ortodokse" },
  { sourceCode: "XK_INDEPENDENCE_DAY", month: 2, day: 17, name: "Dita e Pavarësisë" },
  { sourceCode: "XK_CONSTITUTION_DAY", month: 4, day: 9, name: "Dita e Kushtetutës" },
  { sourceCode: "XK_LABOUR_DAY", month: 5, day: 1, name: "Dita Ndërkombëtare e Punës" },
  { sourceCode: "XK_EUROPE_DAY", month: 5, day: 9, name: "Dita e Evropës" },
  { sourceCode: "XK_CATHOLIC_CHRISTMAS", month: 12, day: 25, name: "Krishtlindjet katolike" },
];

/**
 * Movable feasts (Bajramet, Pashkët) — seeded only for years whose date is
 * known; the Bajram dates come from the Islamic Community's announcement, so
 * unknown years are left for HR rather than estimated. Keep in sync with
 * KOSOVO_OFFICIAL_MOVABLE_HOLIDAY_DEFINITIONS in kosovo-public-holidays.ts.
 */
const MOVABLE_HOLIDAYS = [
  { sourceCode: "XK_BAJRAM_I_MADH", name: "Fitër Bajrami", datesByYear: { 2026: [3, 20] } },
  { sourceCode: "XK_CATHOLIC_EASTER", name: "Pashkët Katolike", datesByYear: { 2026: [4, 5] } },
  { sourceCode: "XK_ORTHODOX_EASTER", name: "Pashkët Ortodokse", datesByYear: { 2026: [4, 12] } },
  { sourceCode: "XK_BAJRAM_I_VOGEL", name: "Kurban Bajrami", datesByYear: { 2026: [5, 27] } },
];

/** 15 employees, Albanian names, no contractors. Deterministic — never changes. */
const EMPLOYEES = [
  { first: "Arben", last: "Gashi", title: "Menaxher i Përgjithshëm", dept: "Administratë", salary: "1450", hired: "2024-02-01" },
  { first: "Elira", last: "Krasniqi", title: "Menaxhere e Financave", dept: "Administratë", salary: "1250", hired: "2024-03-15" },
  { first: "Driton", last: "Berisha", title: "Menaxher i Shitjeve", dept: "Shitje", salary: "1100", hired: "2024-05-01" },
  { first: "Vjosa", last: "Hoxha", title: "Specialiste e Burimeve Njerëzore", dept: "Administratë", salary: "950", hired: "2024-06-10" },
  { first: "Liridon", last: "Morina", title: "Agjent Shitjesh", dept: "Shitje", salary: "700", hired: "2024-09-01" },
  { first: "Fjolla", last: "Shala", title: "Agjente Shitjesh", dept: "Shitje", salary: "700", hired: "2024-09-01" },
  { first: "Blerim", last: "Rexhepi", title: "Teknik i Prodhimit", dept: "Prodhim", salary: "650", hired: "2025-01-15" },
  { first: "Albulena", last: "Bytyqi", title: "Teknike e Prodhimit", dept: "Prodhim", salary: "650", hired: "2025-01-15" },
  { first: "Endrit", last: "Kelmendi", title: "Magazinier", dept: "Prodhim", salary: "580", hired: "2025-03-01" },
  { first: "Rina", last: "Ahmeti", title: "Asistente Administrative", dept: "Administratë", salary: "600", hired: "2025-04-01" },
  { first: "Valon", last: "Zeqiri", title: "Shofer", dept: "Prodhim", salary: "560", hired: "2025-06-01" },
  { first: "Diellza", last: "Statovci", title: "Marketing Specialiste", dept: "Shitje", salary: "800", hired: "2025-08-15" },
  { first: "Gentrit", last: "Salihu", title: "Teknik IT", dept: "Administratë", salary: "900", hired: "2025-10-01" },
  { first: "Arta", last: "Podrimqaku", title: "Kontabiliste", dept: "Administratë", salary: "850", hired: "2026-01-05" },
  { first: "Leutrim", last: "Maloku", title: "Agjent Shitjesh", dept: "Shitje", salary: "680", hired: "2026-03-01" },
];

async function main() {
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    console.log("[seed-demo] no DATABASE_URL — skipping");
    return;
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }, { schema: resolveSchema() }),
  });
  const P = "[seed-demo]";
  try {
    const existing = await prisma.company.findUnique({ where: { slug: DEMO_SLUG }, select: { id: true } });
    if (existing) {
      console.log(`${P} DEMO USER already provisioned (${existing.id}) — untouched.`);
      return;
    }

    const company = await prisma.company.create({
      data: {
        legalName: "DEMO USER",
        tradeName: "DEMO USER",
        slug: DEMO_SLUG,
        city: "Prishtinë",
        addressLine: "Rr. Demonstrimi 1",
      },
      select: { id: true },
    });
    const companyId = company.id;
    console.log(`${P} company created: ${companyId}`);

    const year = new Date().getUTCFullYear();
    await prisma.companyHoliday.createMany({
      data: [
        ...FIXED_HOLIDAYS.map((h) => ({
          companyId,
          calendarYear: year,
          observedOn: new Date(Date.UTC(year, h.month - 1, h.day, 12, 0, 0, 0)),
          name: h.name,
          category: "KOSOVO_OFFICIAL_FIXED",
          isActive: true,
          sourceCode: h.sourceCode,
        })),
        ...MOVABLE_HOLIDAYS.flatMap((h) => {
          const known = h.datesByYear[year];
          if (!known) return [];
          const [month, day] = known;
          return [{
            companyId,
            calendarYear: year,
            observedOn: new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0)),
            name: h.name,
            category: "KOSOVO_OFFICIAL_MOVABLE",
            isActive: true,
            sourceCode: h.sourceCode,
          }];
        }),
      ],
    });

    await prisma.payrollParameterSet.create({
      data: {
        companyId,
        effectiveFrom: new Date("2020-01-01T00:00:00.000Z"),
        label: "Parametrat bazë (Kosovë)",
        minimumMonthlyWage: "500",
        pensionEmployeeRate: "0.05",
        pensionEmployerRate: "0.05",
      },
    });

    await prisma.leavePolicyParameterSet.create({
      data: { companyId, effectiveFrom: new Date("2000-01-01T00:00:00.000Z") },
    });

    // Stable demo login — never forced to change, so the demo never breaks.
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const user = await prisma.user.upsert({
      where: { email: DEMO_EMAIL },
      update: { status: "ACTIVE", passwordHash, mustChangePassword: false },
      create: {
        email: DEMO_EMAIL,
        displayName: "Demo PagaPRO",
        passwordHash,
        status: "ACTIVE",
        mustChangePassword: false,
      },
      select: { id: true },
    });
    await prisma.userCompanyMembership.create({
      data: { userId: user.id, companyId, role: "ADMIN", isActive: true },
    });

    const departments = {};
    for (const name of ["Administratë", "Shitje", "Prodhim"]) {
      const d = await prisma.department.create({ data: { companyId, name }, select: { id: true } });
      departments[name] = d.id;
    }

    let seq = 0;
    for (const e of EMPLOYEES) {
      seq += 1;
      const hireDate = new Date(`${e.hired}T12:00:00.000Z`);
      const employee = await prisma.employee.create({
        data: {
          companyId,
          departmentId: departments[e.dept],
          employmentType: "EMPLOYEE",
          status: "ACTIVE",
          workArrangement: "ON_SITE",
          firstName: e.first,
          lastName: e.last,
          jobTitle: e.title,
          personalId: `10009${String(seq).padStart(5, "0")}`,
          hireDate,
          weeklyHours: 40,
          baseSalaryMonthly: e.salary,
          applyTrust: true,
          applyTax: true,
          addressCountry: "XK",
          addressCity: "Prishtinë",
          documentsMissing: false,
        },
        select: { id: true },
      });
      await prisma.employmentPeriod.create({
        data: { companyId, employeeId: employee.id, startedAt: hireDate, reason: "HIRE" },
      });
      await prisma.employeeSalaryChange.create({
        data: {
          companyId,
          employeeId: employee.id,
          effectiveFrom: hireDate,
          newBaseSalary: e.salary,
          compensationBasis: "GROSS_MONTHLY",
          reason: "Rekord fillestar (demo)",
        },
      });
    }
    console.log(`${P} 15 employees created. Login: ${DEMO_EMAIL}`);
    // Templates are seeded by seed-templates.cjs later in this same build.
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  // A broken demo seed must never block a production deploy.
  console.error("[seed-demo] FAILED:", e?.message ?? e);
});
