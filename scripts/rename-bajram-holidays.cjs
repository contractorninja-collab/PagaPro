/**
 * Renames the two Bajram holidays on companies that already have them.
 *
 * They were seeded as "Bajrami i Madh (Fitër Bajrami)" and "Bajrami i Vogël
 * (Kurban Bajrami)" — with the i Madh / i Vogël prefixes on the wrong feast,
 * since 20 March is the end of Ramadan. New companies now get the plain names;
 * this brings the existing ones into line.
 *
 * Two deliberate restrictions:
 *
 *   - It only touches rows whose name is still EXACTLY one of the old seeded
 *     labels. If HR has renamed a holiday to their own wording, that is a human
 *     decision and this leaves it alone.
 *   - It writes the `name` column and nothing else. Dates, active flags and
 *     categories are untouched, so no payroll day count can move.
 *
 * Matching is by sourceCode, which is the stable identity of a holiday row —
 * the codes themselves keep their original (now misleading) spelling, so read
 * XK_BAJRAM_I_MADH as "the Ramadan feast" and XK_BAJRAM_I_VOGEL as "the
 * sacrifice feast".
 *
 *   node -r dotenv/config scripts/rename-bajram-holidays.cjs            # dry run
 *   node -r dotenv/config scripts/rename-bajram-holidays.cjs --apply    # write
 */
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const APPLY = process.argv.includes("--apply");

/** sourceCode -> { oldNames it is safe to overwrite, the new name } */
const RENAMES = [
  {
    sourceCode: "XK_BAJRAM_I_MADH",
    oldNames: ["Bajrami i Madh (Fitër Bajrami)", "Bajrami i Madh"],
    newName: "Fitër Bajrami",
  },
  {
    sourceCode: "XK_BAJRAM_I_VOGEL",
    oldNames: ["Bajrami i Vogël (Kurban Bajrami)", "Bajrami i Vogel (Kurban Bajrami)", "Bajrami i Vogël"],
    newName: "Kurban Bajrami",
  },
];

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
    console.warn("[bajram-rename] no DATABASE_URL — skipping.");
    return;
  }
  const schema = resolveSchema();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }, { schema }) });

  console.log(`[bajram-rename] ${APPLY ? "APPLY (writing)" : "DRY RUN (nothing is written)"} · schema "${schema}"`);

  const rows = await prisma.companyHoliday.findMany({
    where: { sourceCode: { in: RENAMES.map((r) => r.sourceCode) } },
    select: {
      id: true,
      name: true,
      sourceCode: true,
      calendarYear: true,
      observedOn: true,
      company: { select: { legalName: true } },
    },
    orderBy: [{ calendarYear: "asc" }, { observedOn: "asc" }],
  });

  const toChange = [];
  const alreadyRight = [];
  const humanNamed = [];

  for (const row of rows) {
    const rule = RENAMES.find((r) => r.sourceCode === row.sourceCode);
    if (!rule) continue;
    if (row.name === rule.newName) {
      alreadyRight.push(`${row.company.legalName} ${row.calendarYear}`);
    } else if (rule.oldNames.includes(row.name)) {
      toChange.push({ id: row.id, company: row.company.legalName, year: row.calendarYear, from: row.name, to: rule.newName });
    } else {
      humanNamed.push(`${row.company.legalName} ${row.calendarYear}: "${row.name}"`);
    }
  }

  console.log(`\nScanned ${rows.length} Bajram row(s).\n`);

  if (toChange.length === 0) {
    console.log("Nothing to rename.");
  } else {
    console.log(`WOULD RENAME ${toChange.length} row(s):\n`);
    for (const c of toChange) {
      console.log(`  ${c.company} ${c.year}`);
      console.log(`      "${c.from}"  ->  "${c.to}"`);
    }
  }
  if (alreadyRight.length > 0) console.log(`\nAlready correct: ${alreadyRight.length}`);
  if (humanNamed.length > 0) {
    console.log(`\nLeft alone — renamed by hand, not ours to overwrite:`);
    for (const h of humanNamed) console.log(`  ${h}`);
  }

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to write these changes.");
    await prisma.$disconnect();
    return;
  }

  let written = 0;
  for (const c of toChange) {
    await prisma.companyHoliday.update({ where: { id: c.id }, data: { name: c.to } });
    written += 1;
  }
  console.log(`\nRenamed ${written} row(s). Dates and active flags untouched.`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[bajram-rename] failed:", err);
  process.exitCode = 1;
});
