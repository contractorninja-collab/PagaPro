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
 * READ-ONLY by default. `--apply` performs one narrowly scoped correction, and
 * only that:
 *
 *   for companies whose Konfigurimet figure is UNSET — so they never chose a
 *   number and simply inherited whatever provisioning wrote — bring the ACTIVE
 *   parameter set up to the statutory default.
 *
 * It will not touch a company that typed a figure, and it will not touch a
 * historical parameter set. Both restrictions matter: the first is the
 * difference between correcting an inherited default and overriding a client's
 * decision; the second is because the minimum wage genuinely differed in the
 * past, and a closed date range is a record of that, not a mistake.
 *
 *   node -r dotenv/config scripts/report-minimum-wages.cjs            # dry run
 *   node -r dotenv/config scripts/report-minimum-wages.cjs --apply    # write
 */
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const APPLY = process.argv.includes("--apply");

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

  console.log(`[minimum-wages] ${APPLY ? "APPLY (writing)" : "DRY RUN (nothing is written)"} · schema "${schema}" · default ${STATUTORY_DEFAULT}`);

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
    select: { id: true, companyId: true, minimumMonthlyWage: true, effectiveFrom: true, effectiveTo: true },
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
  console.log(`  on a different figure : ${stale.length}${stale.length ? " — " + stale.join(", ") : ""}`);
  console.log(`  nothing anywhere : ${unset.length}${unset.length ? " — " + unset.join(", ") : ""}`);

  // ---- the correction, scoped to inherited defaults only -------------------
  const now = new Date();
  const candidates = [];
  const skippedChosen = [];
  const skippedHistorical = [];

  for (const c of companies) {
    if (c.configuration?.minimumSalaryCurrent != null) {
      skippedChosen.push(`${c.legalName} (chose ${c.configuration.minimumSalaryCurrent.toString()})`);
      continue;
    }
    const mine = sets.filter((s) => s.companyId === c.id);
    const active = mine.find((s) => s.effectiveFrom <= now && (s.effectiveTo == null || s.effectiveTo > now));
    for (const s of mine) {
      if (s !== active && s.minimumMonthlyWage.toString() !== STATUTORY_DEFAULT) {
        skippedHistorical.push(`${c.legalName} @ ${s.effectiveFrom.toISOString().slice(0, 10)} = ${s.minimumMonthlyWage.toString()}`);
      }
    }
    if (!active) continue;
    if (active.minimumMonthlyWage.toString() === STATUTORY_DEFAULT) continue;
    candidates.push({
      id: active.id,
      company: c.legalName,
      from: active.minimumMonthlyWage.toString(),
      effectiveFrom: active.effectiveFrom.toISOString().slice(0, 10),
    });
  }

  console.log(`\n--- correction: inherited defaults only ---`);
  if (candidates.length === 0) {
    console.log("  Nothing to correct.");
  } else {
    console.log(`  WOULD CHANGE ${candidates.length} active parameter set(s):\n`);
    for (const c of candidates) {
      console.log(`    ${c.company.padEnd(28)} ${c.from} -> ${STATUTORY_DEFAULT}   (active from ${c.effectiveFrom})`);
    }
  }
  if (skippedChosen.length > 0) {
    console.log(`\n  Left alone — the client chose a figure:`);
    for (const s of skippedChosen) console.log(`    ${s}`);
  }
  if (skippedHistorical.length > 0) {
    console.log(`\n  Left alone — historical parameter sets (past periods keep their own rate):`);
    for (const s of skippedHistorical) console.log(`    ${s}`);
  }

  if (!APPLY) {
    console.log(`\nDry run. Re-run with --apply to write these changes.`);
    await prisma.$disconnect();
    return;
  }

  let written = 0;
  for (const c of candidates) {
    await prisma.payrollParameterSet.update({
      where: { id: c.id },
      data: { minimumMonthlyWage: STATUTORY_DEFAULT },
    });
    written += 1;
  }
  console.log(`\nWrote ${written} parameter set(s).`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[minimum-wages] failed:", err);
  process.exitCode = 1;
});
