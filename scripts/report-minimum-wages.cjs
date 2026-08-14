/**
 * Reports the minimum wage each company is actually measured against.
 *
 * Three places can hold it and they do not have to agree:
 *   CompanyConfiguration.minimumSalaryCurrent   what the client typed in Konfigurimet
 *   PayrollSettings.minimumSalaryMonthly        the synced copy
 *   PayrollParameterSet.minimumMonthlyWage      what the engine actually checks against
 *
 * KOSOVO_MINIMUM_MONTHLY_GROSS is only a *default*: it applies to companies that
 * never set their own. A company holding an older figure keeps it, which is
 * correct — it chose that — but if the statutory rate has moved, its
 * "below minimum wage" warnings are measured against a stale number. This says
 * which companies those are.
 *
 * STRICTLY READ-ONLY. There is deliberately no --apply: overwriting a figure a
 * client chose is a decision for a human, not a build step.
 *
 *   node -r dotenv/config scripts/report-minimum-wages.cjs
 */
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

// Mirrors src/modules/payroll/calculation/legislation/minimum-wage.ts.
const STATUTORY_DEFAULT = "500";

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

const show = (v) => (v == null ? "(unset)" : v.toString());

async function main() {
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    console.warn("[minimum-wages] no DATABASE_URL — skipping.");
    return;
  }
  const schema = resolveSchema();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }, { schema }) });

  console.log(`[minimum-wages] READ-ONLY report · schema "${schema}" · default ${STATUTORY_DEFAULT}`);

  const companies = await prisma.company.findMany({
    select: {
      id: true,
      legalName: true,
      status: true,
      configuration: { select: { minimumSalaryCurrent: true } },
      payrollSettings: { select: { minimumSalaryMonthly: true } },
    },
    orderBy: { legalName: "asc" },
  });

  const sets = await prisma.payrollParameterSet.findMany({
    select: { companyId: true, minimumMonthlyWage: true, effectiveFrom: true },
    orderBy: { effectiveFrom: "desc" },
  });

  const enforcedByCompany = new Map();
  for (const s of sets) {
    if (!enforcedByCompany.has(s.companyId)) enforcedByCompany.set(s.companyId, s.minimumMonthlyWage);
  }

  const stale = [];
  const unset = [];
  const current = [];

  console.log(`\n${companies.length} compan${companies.length === 1 ? "y" : "ies"}:\n`);
  for (const c of companies) {
    const typed = c.configuration?.minimumSalaryCurrent ?? null;
    const synced = c.payrollSettings?.minimumSalaryMonthly ?? null;
    const enforced = enforcedByCompany.get(c.id) ?? null;

    console.log(`  ${c.legalName}  [${c.status}]`);
    console.log(`      Konfigurimet : ${show(typed)}`);
    console.log(`      PayrollSettings : ${show(synced)}`);
    console.log(`      engine checks against : ${show(enforced)}`);

    const effective = enforced ?? typed ?? synced;
    if (effective == null) unset.push(c.legalName);
    else if (effective.toString() !== STATUTORY_DEFAULT) stale.push(`${c.legalName} (${effective.toString()})`);
    else current.push(c.legalName);

    const values = [typed, synced, enforced].filter((v) => v != null).map((v) => v.toString());
    if (new Set(values).size > 1) {
      console.log(`      ^^ THE THREE DISAGREE — the engine figure is the one that counts`);
    }
  }

  console.log(`\nSummary against the statutory default of ${STATUTORY_DEFAULT}:`);
  console.log(`  already at ${STATUTORY_DEFAULT} : ${current.length}${current.length ? " — " + current.join(", ") : ""}`);
  console.log(`  holding an older figure : ${stale.length}${stale.length ? " — " + stale.join(", ") : ""}`);
  console.log(`  nothing set, so they take the default : ${unset.length}${unset.length ? " — " + unset.join(", ") : ""}`);
  console.log(`\nRead-only. Changing a figure a client chose is a human decision, not a build step.`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[minimum-wages] failed:", err);
  process.exitCode = 1;
});
