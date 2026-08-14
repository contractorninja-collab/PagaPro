/**
 * Finds and fills the official movable feasts missing from existing companies.
 *
 * Provisioning used to seed the fixed dates only, so companies created through
 * the admin console before that was fixed have no Bajram and no Easter rows —
 * which means payroll counts those days as ordinary working days. New companies
 * get the full calendar now; this brings the older ones into line.
 *
 * Mirrors KOSOVO_OFFICIAL_MOVABLE_HOLIDAY_DEFINITIONS in
 * src/modules/payroll/calendar/kosovo-public-holidays.ts — keep the two in step.
 *
 * How "missing" is decided, and why it is careful:
 *
 *   - A feast counts as present if a row carries its sourceCode, OR if any row
 *     already sits on the date it would occupy. The second test matters: HR may
 *     have added the day by hand through the Festat panel under their own name
 *     and category, and seeding a second row for the same day would both
 *     duplicate the holiday and collide with the (companyId, year, date)
 *     uniqueness.
 *   - Only years the company already keeps a calendar for are considered, and
 *     only years whose date we actually know. It will not invent 2027.
 *
 * A filled day REDUCES the expected working days of its month, so the report
 * names any payroll period covering it — a locked or approved period keeps the
 * snapshot it was calculated with, but a DRAFT would change on recompute.
 *
 *   node -r dotenv/config scripts/backfill-movable-holidays.cjs            # dry run
 *   node -r dotenv/config scripts/backfill-movable-holidays.cjs --apply    # write
 */
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const APPLY = process.argv.includes("--apply");

const MOVABLE = [
  { sourceCode: "XK_BAJRAM_I_MADH", name: "Fitër Bajrami", datesByYear: { 2026: [3, 20] } },
  { sourceCode: "XK_CATHOLIC_EASTER", name: "Pashkët Katolike", datesByYear: { 2026: [4, 5] } },
  { sourceCode: "XK_ORTHODOX_EASTER", name: "Pashkët Ortodokse", datesByYear: { 2026: [4, 12] } },
  { sourceCode: "XK_BAJRAM_I_VOGEL", name: "Kurban Bajrami", datesByYear: { 2026: [5, 27] } },
];

/** The seeder stores observed dates at 12:00 UTC — match it exactly. */
function utcDateOnly(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

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

async function main() {
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    console.warn("[movable-holidays] no DATABASE_URL — skipping.");
    return;
  }
  const schema = resolveSchema();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }, { schema }) });

  console.log(`[movable-holidays] ${APPLY ? "APPLY (writing)" : "DRY RUN (nothing is written)"} · schema "${schema}"`);

  const companies = await prisma.company.findMany({
    select: { id: true, legalName: true, status: true },
    orderBy: { legalName: "asc" },
  });
  const holidays = await prisma.companyHoliday.findMany({
    select: { companyId: true, calendarYear: true, observedOn: true, sourceCode: true, name: true },
  });
  const payrolls = await prisma.payroll.findMany({
    select: { companyId: true, year: true, month: true, status: true },
  });

  const planned = [];
  const alreadyThere = [];
  const byHand = [];

  for (const c of companies) {
    const mine = holidays.filter((h) => h.companyId === c.id);
    const years = [...new Set(mine.map((h) => h.calendarYear))].sort();
    if (years.length === 0) continue; // no calendar at all — provisioning handles it

    for (const year of years) {
      for (const def of MOVABLE) {
        const known = def.datesByYear[year];
        if (!known) continue; // we do not invent dates

        const [month, day] = known;
        const observedOn = utcDateOnly(year, month, day);

        const byCode = mine.find((h) => h.calendarYear === year && h.sourceCode === def.sourceCode);
        if (byCode) {
          alreadyThere.push(`${c.legalName} ${year} ${def.name}`);
          continue;
        }
        const onDate = mine.find(
          (h) => h.calendarYear === year && h.observedOn.getTime() === observedOn.getTime(),
        );
        if (onDate) {
          byHand.push(`${c.legalName} ${year}: ${observedOn.toISOString().slice(0, 10)} already held by "${onDate.name}"`);
          continue;
        }

        const period = payrolls.find((p) => p.companyId === c.id && p.year === year && p.month === month);
        planned.push({
          companyId: c.id,
          company: c.legalName,
          status: c.status,
          year,
          month,
          day,
          observedOn,
          sourceCode: def.sourceCode,
          name: def.name,
          payroll: period ? `${period.status}` : null,
        });
      }
    }
  }

  console.log(`\n${companies.length} companies scanned.\n`);

  if (planned.length === 0) {
    console.log("Nothing missing.");
  } else {
    console.log(`WOULD ADD ${planned.length} holiday row(s):\n`);
    let current = "";
    for (const p of planned) {
      if (p.company !== current) {
        current = p.company;
        console.log(`  ${p.company}  [${p.status}]`);
      }
      const warn = p.payroll ? `   << payroll for this month exists and is ${p.payroll}` : "";
      console.log(`      ${p.observedOn.toISOString().slice(0, 10)}  ${p.name}${warn}`);
    }
  }

  if (byHand.length > 0) {
    console.log(`\nLeft alone — the day is already taken by an existing row:`);
    for (const b of byHand) console.log(`  ${b}`);
  }
  if (alreadyThere.length > 0) console.log(`\nAlready present by source code: ${alreadyThere.length}`);

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to write these changes.");
    await prisma.$disconnect();
    return;
  }

  let written = 0;
  for (const p of planned) {
    await prisma.companyHoliday.create({
      data: {
        companyId: p.companyId,
        calendarYear: p.year,
        observedOn: p.observedOn,
        name: p.name,
        category: "KOSOVO_OFFICIAL_MOVABLE",
        isActive: true,
        sourceCode: p.sourceCode,
      },
    });
    written += 1;
  }
  console.log(`\nAdded ${written} holiday row(s).`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[movable-holidays] failed:", err);
  process.exitCode = 1;
});
