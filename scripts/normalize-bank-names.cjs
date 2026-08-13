/**
 * Maps bank names already in the database onto the ten licensed Kosovo banks.
 *
 * The employee form and the CSV import both normalise now, but records written
 * before that keep whatever was typed — the dev database alone held "RBKO",
 * "PCB", "pcb" and "Raiffeisen Bank": four spellings for two banks.
 *
 * READ-ONLY BY DEFAULT. It prints exactly what it would change and touches
 * nothing unless run with --apply. A name that matches no bank is reported and
 * left alone, never blanked — losing a bank is worse than an odd spelling.
 *
 *   node -r dotenv/config scripts/normalize-bank-names.cjs            # dry run
 *   node -r dotenv/config scripts/normalize-bank-names.cjs --apply    # write
 *
 * The matching rules live in src/modules/employees/constants/kosovo-banks.ts
 * and are mirrored here because this runs as plain CommonJS outside the bundle;
 * kosovo-banks.test.ts is what keeps the two honest.
 */
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const APPLY = process.argv.includes("--apply");

const BANKS = [
  ["NLB", "NLB Banka SH.A.", ["nlb", "nlb prishtina", "nlb banka prishtina", "nova ljubljanska banka"]],
  ["BpB", "Banka për Biznes SH.A.", ["bpb", "bpbbank", "banka per biznes", "per biznes"]],
  ["Banka Ekonomike", "Banka Ekonomike SH.A.", ["ekonomike", "bek", "b ekonomike"]],
  ["Raiffeisen", "Raiffeisen Bank Kosovo J.S.C.", ["raiffeisen", "rbko", "rbk", "raiffeisen kosovo", "rzb"]],
  ["ProCredit", "ProCredit Bank SH.A.", ["procredit", "pcb", "pro credit", "procredit holding"]],
  ["TEB", "TEB SH.A.", ["teb", "teb sh a", "turk ekonomi bankasi"]],
  ["BKT", "Banka Kombëtare Tregtare Kosovë SH.A.", ["bkt", "banka kombetare tregtare", "kombetare tregtare"]],
  ["Ziraat", "Ziraat Bank Kosova SH.A.", ["ziraat", "ziraat bankasi", "turkiye cumhuriyeti ziraat"]],
  ["Credins", "Banka Credins Kosovë SH.A.", ["credins", "banka credins"]],
  ["Pribank", "Pribank SH.A.", ["pribank", "pri bank"]],
];

const NOISE = new Set([
  "bank", "banka", "bankasi", "sh", "a", "sha", "shpk", "jsc", "j", "s", "c",
  "kosova", "kosove", "kosovo", "ks", "xk", "dega", "deget", "filiala",
]);

function fold(raw) {
  return String(raw)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 0 && !NOISE.has(t))
    .join(" ");
}

const BY_FOLDED = new Map();
for (const [code, official, aliases] of BANKS) {
  for (const candidate of [code, official, ...aliases]) {
    const key = fold(candidate);
    if (key) BY_FOLDED.set(key, code);
  }
}

function normalize(raw) {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) return { value: null, matched: false };
  const hit = BY_FOLDED.get(fold(trimmed));
  return hit ? { value: hit, matched: true } : { value: trimmed, matched: false };
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
    console.warn("[normalize-bank-names] no DATABASE_URL — skipping.");
    return;
  }
  const schema = resolveSchema();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }, { schema }) });

  const mode = APPLY ? "APPLY (writing)" : "DRY RUN (nothing is written)";
  console.log(`[normalize-bank-names] ${mode} · schema "${schema}"`);

  const employees = await prisma.employee.findMany({
    where: { bankName: { not: null } },
    select: { id: true, firstName: true, lastName: true, bankName: true, companyId: true },
    orderBy: [{ lastName: "asc" }],
  });
  const accounts = await prisma.employeeBankAccount.findMany({
    where: { bankName: { not: null } },
    select: { id: true, bankName: true, employeeId: true },
  });

  const changes = [];
  const unmatched = new Map();
  const alreadyGood = [];

  for (const e of employees) {
    const res = normalize(e.bankName);
    const who = `${e.firstName} ${e.lastName}`.trim();
    if (res.matched && res.value !== e.bankName) {
      changes.push({ table: "Employee", id: e.id, who, from: e.bankName, to: res.value });
    } else if (res.matched) {
      alreadyGood.push(e.bankName);
    } else {
      unmatched.set(e.bankName, (unmatched.get(e.bankName) ?? 0) + 1);
    }
  }
  for (const a of accounts) {
    const res = normalize(a.bankName);
    if (res.matched && res.value !== a.bankName) {
      changes.push({ table: "EmployeeBankAccount", id: a.id, who: a.employeeId, from: a.bankName, to: res.value });
    } else if (res.matched) {
      alreadyGood.push(a.bankName);
    } else {
      unmatched.set(a.bankName, (unmatched.get(a.bankName) ?? 0) + 1);
    }
  }

  console.log(
    `\nScanned ${employees.length} employee row(s) and ${accounts.length} bank-account row(s) with a bank name.\n`,
  );

  if (changes.length === 0) {
    console.log("Nothing to change — every recognised name is already canonical.");
  } else {
    console.log(`WOULD CHANGE ${changes.length} row(s):\n`);
    for (const c of changes) {
      console.log(`  ${c.table.padEnd(20)} ${String(c.from).padEnd(22)} -> ${c.to}     (${c.who})`);
    }
  }

  if (alreadyGood.length > 0) {
    const counts = alreadyGood.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map());
    console.log(
      `\nAlready canonical (${alreadyGood.length}): ` +
        [...counts].map(([v, n]) => `${v}×${n}`).join(", "),
    );
  }

  if (unmatched.size > 0) {
    console.log("\nLEFT UNTOUCHED — matches no licensed bank, needs a human:");
    for (const [value, n] of unmatched) console.log(`  "${value}" × ${n}`);
  }

  if (!APPLY) {
    console.log("\nDry run only. Re-run with --apply to write these changes.");
    await prisma.$disconnect();
    return;
  }

  let written = 0;
  for (const c of changes) {
    if (c.table === "Employee") {
      await prisma.employee.update({ where: { id: c.id }, data: { bankName: c.to } });
    } else {
      await prisma.employeeBankAccount.update({ where: { id: c.id }, data: { bankName: c.to } });
    }
    written += 1;
  }
  console.log(`\nWrote ${written} row(s).`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[normalize-bank-names] failed:", err);
  process.exitCode = 1;
});
