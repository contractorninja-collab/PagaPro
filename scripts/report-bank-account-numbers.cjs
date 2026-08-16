/**
 * Reports bank account numbers that fail the 16-digit rule, and can repair the
 * ones whose repair is unambiguous.
 *
 * The rule (BANK_ACCOUNT_NUMBER_PATTERN, /^\d{16}$/) went in after these rows
 * were written, so it guards new edits and nothing else. The employee form is
 * the only writer that enforces it: the CSV import still accepts anything
 * matching /^[A-Z0-9][A-Z0-9./-]{2,63}$/, so bad numbers can still arrive.
 *
 * NOTHING PRINTS AN ACCOUNT NUMBER. Bank details are the reason field-level
 * encryption exists (src/lib/field-crypto.ts), and a Vercel build log is not
 * the place to undo it. Rows are described by length and defect only; names
 * appear solely for the ones a human has to chase, because you cannot chase a
 * row you cannot identify.
 *
 * Both columns are read AND EACH IS CLASSIFIED AGAINST ITS OWN VALUE, which is
 * the whole game. The form writes both — employee-service.ts
 * syncPrimaryBankAccount mirrors Employee.bankAccountIban into a fresh
 * EmployeeBankAccount row on every save — but they are stored independently,
 * and it is the EmployeeBankAccount row that pays: payroll-pdf-service prefers
 * it and resolve-placeholder-values reads only it. Judging one column and
 * repairing both would let a clean profile vouch for a broken row, and would
 * let a repair derived from the profile overwrite the number payroll actually
 * pays into. So:
 *
 *   - a row is repaired only when both columns hold the SAME value and that
 *     value is unambiguously repairable;
 *   - where the two disagree, nothing is written. A divergence asks which
 *     account is current, and reformatting does not answer that question — a
 *     person does.
 *
 * Classification, and why only two kinds are safe to repair:
 *
 *   OK           exactly 16 digits.
 *   SEPARATORS   16 digits once spaces, dots, dashes and slashes come out.
 *                Repairable: no digit is invented or dropped.
 *   XK_IBAN      XK + 2 check digits + 16 digits. The Kosovo IBAN is literally
 *                the account number with a country prefix, so the last 16 are
 *                it. Repairable: same digits, prefix removed.
 *   MALFORMED_XK an XK value of the wrong length. There is a real 16-digit
 *                number in there, but recovering it means guessing which
 *                character is wrong, so a human reads it off the bank slip.
 *   FOREIGN_IBAN some other country's IBAN. NOT repairable and arguably not
 *                even wrong — a foreign national paid to a foreign bank has no
 *                16-digit Kosovo number. Flagged for a human, not a rule.
 *   WRONG_LENGTH all digits, but not 16. A human has to supply the real one;
 *                padding or truncating would send money somewhere.
 *   OTHER        anything else.
 *   UNREADABLE   decrypt returned the "***" placeholder — wrong key or a
 *                corrupted row. Repairing this would overwrite a value we
 *                cannot read, so it is only ever reported.
 *
 *   node -r dotenv/config scripts/report-bank-account-numbers.cjs           # report
 *   node -r dotenv/config scripts/report-bank-account-numbers.cjs --apply   # repair
 */
const { createCipheriv, createDecipheriv, randomBytes } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const APPLY = process.argv.includes("--apply");
const PREFIX = "enc1:";

/** Must match BANK_ACCOUNT_NUMBER_PATTERN in employee-schemas.ts. */
const SIXTEEN_DIGITS = /^\d{16}$/;
const SEPARATORS = /[\s.\-/]/g;

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

function loadKey() {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  return key.length === 32 ? key : null;
}

/** Mirrors decryptField in src/lib/field-crypto.ts, placeholder included. */
function decryptField(stored, key) {
  if (!stored.startsWith(PREFIX)) return stored;
  if (!key) return "***";
  try {
    const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(":");
    if (!ivB64 || !tagB64 || !dataB64) return "***";
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "***";
  }
}

function encryptField(plain, key) {
  if (!plain || !key) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${ct.toString("base64")}`;
}

/** @returns {{kind: string, repaired: string|null, detail: string}} */
function classify(plain) {
  if (plain === "***") {
    return { kind: "UNREADABLE", repaired: null, detail: "decrypt failed — wrong key or corrupted row" };
  }
  const compact = plain.replace(/\s+/g, "");
  if (compact === "") return { kind: "EMPTY", repaired: null, detail: "blank" };
  if (SIXTEEN_DIGITS.test(compact)) return { kind: "OK", repaired: null, detail: "" };

  const upper = compact.toUpperCase();

  const stripped = plain.replace(SEPARATORS, "");
  if (SIXTEEN_DIGITS.test(stripped)) {
    return { kind: "SEPARATORS", repaired: stripped, detail: "16 digits behind separators" };
  }

  if (/^XK\d{18}$/.test(upper)) {
    return { kind: "XK_IBAN", repaired: upper.slice(4), detail: "Kosovo IBAN — last 16 digits are the account" };
  }
  // An XK value that is not exactly 20 characters is a mistyped Kosovo IBAN,
  // not a foreign one. Calling it FOREIGN would tell you a Kosovo employee
  // banks abroad and send you looking for the wrong explanation — and unlike a
  // genuinely foreign account, this one does have a 16-digit number behind it,
  // just not one we can recover without guessing which character is wrong.
  if (upper.startsWith("XK")) {
    return { kind: "MALFORMED_XK", repaired: null, detail: `Kosovo IBAN of ${upper.length} chars, should be 20` };
  }
  if (/^[A-Z]{2}\d{2}[A-Z0-9]{6,30}$/.test(upper)) {
    return { kind: "FOREIGN_IBAN", repaired: null, detail: `${upper.slice(0, 2)} IBAN, ${upper.length} chars` };
  }

  const digitsOnly = plain.replace(/\D/g, "");
  if (digitsOnly.length === compact.length) {
    return { kind: "WRONG_LENGTH", repaired: null, detail: `${digitsOnly.length} digits, needs 16` };
  }
  return {
    kind: "OTHER",
    repaired: null,
    detail: `${compact.length} chars, ${digitsOnly.length} of them digits`,
  };
}

const REPAIRABLE = new Set(["SEPARATORS", "XK_IBAN"]);

/**
 * Free-text columns are printed to identify a row, and free text can contain
 * anything. Kosovo payment slips write the bank and the account number on one
 * line, the CSV import's "Banka" and "Numri i llogarisë" are adjacent columns,
 * and bankName is stored verbatim with no charset rule — so a Banka cell
 * reading "TEB - llogaria 1234567890123456" would print a whole account number
 * from the one field this script never treats as sensitive. Digits are masked
 * so the no-digits rule is a property of the code and not of the data.
 */
function safeText(value) {
  return String(value ?? "").replace(/\d/g, "•");
}

function describe(verdict) {
  return verdict ? verdict.kind : "empty";
}

async function main() {
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    console.warn("[bank-accounts] no DATABASE_URL — skipping.");
    return;
  }
  const schema = resolveSchema();
  const key = loadKey();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }, { schema }) });

  console.log(`[bank-accounts] ${APPLY ? "APPLY (writing)" : "REPORT (nothing is written)"} · schema "${schema}"`);
  if (!key) {
    // Without the key every encrypted row reads back as "***" and the whole run
    // would report a false catastrophe. Refuse rather than mislead.
    console.error("[bank-accounts] FIELD_ENCRYPTION_KEY missing or not 32 bytes — cannot read the column. Aborting.");
    await prisma.$disconnect();
    return;
  }

  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true,
      bankName: true,
      bankAccountIban: true,
      company: { select: { legalName: true } },
      bankAccounts: { select: { id: true, iban: true, isPrimary: true } },
    },
    orderBy: [{ company: { legalName: "asc" } }, { lastName: "asc" }],
  });

  const counts = {};
  const bump = (k) => {
    counts[k] = (counts[k] ?? 0) + 1;
  };
  const needHuman = [];
  const divergent = [];
  const repairs = [];
  let withNumber = 0;

  for (const e of employees) {
    const who = safeText(`${e.firstName} ${e.lastName}`.trim());
    const where = safeText(e.company?.legalName ?? "(pa kompani)");
    const bank = safeText(e.bankName ?? "—");

    // Trimmed before the emptiness tests: a whitespace-only column is not a
    // number, and treating it as one made it classify EMPTY and then fall out
    // of every list while still counting toward the total.
    const profile = (e.bankAccountIban ? decryptField(e.bankAccountIban, key) : "").trim();
    const primary = e.bankAccounts.find((a) => a.isPrimary) ?? e.bankAccounts[0] ?? null;
    const row = primary ? decryptField(primary.iban, key).trim() : "";

    if (!profile && !row) continue;
    withNumber += 1;

    // EACH COLUMN AGAINST ITS OWN VALUE. The form writes both together, but a
    // verdict read off one says nothing about the other, and it is the
    // EmployeeBankAccount row that payroll pays: payroll-pdf-service prefers it
    // and resolve-placeholder-values reads only it. Classifying one and
    // repairing both would let a clean profile vouch for a broken row — or
    // worse, overwrite a good row with a number derived from somewhere else.
    const profileVerdict = profile ? classify(profile) : null;
    const rowVerdict = row ? classify(row) : null;
    const paying = rowVerdict ?? profileVerdict;

    // A divergence is a question — which of these two accounts is the current
    // one? — and no amount of reformatting answers it. Never repaired. It is
    // counted as the divergence rather than as the paying column's format, so
    // the table never reports a row as OK that the list below says needs
    // chasing; every employee lands in exactly one bucket.
    if (profile && row && profile !== row) {
      bump("COLUMNS_DISAGREE");
      divergent.push({ where, who, note: `profile ${describe(profileVerdict)} · payslip row ${describe(rowVerdict)}` });
      needHuman.push({
        where, who, status: e.status, bank,
        kind: "COLUMNS_DISAGREE",
        detail: "the two stored numbers differ — somebody must say which account is current",
      });
      continue;
    }
    if (profile && !primary) {
      bump("NO_PAYSLIP_ROW");
      needHuman.push({
        where, who, status: e.status, bank,
        kind: "NO_PAYSLIP_ROW",
        detail: "profile holds a number but no bank row exists — the payslip has nothing to print",
      });
      continue;
    }
    bump(paying.kind);
    if (!profile && row) {
      divergent.push({ where, who, note: "payslip row has a number, profile does not" });
    }

    if (paying.kind === "OK") continue;

    if (REPAIRABLE.has(paying.kind)) {
      repairs.push({
        employeeId: e.id,
        bankAccountId: primary?.id ?? null,
        repaired: paying.repaired,
        who,
        where,
        kind: paying.kind,
      });
    } else {
      needHuman.push({ where, who, status: e.status, bank, kind: paying.kind, detail: paying.detail });
    }
  }

  console.log(`\n${employees.length} employees scanned · ${withNumber} have a bank account number.\n`);

  const order = ["OK", "EMPTY", "SEPARATORS", "XK_IBAN", "MALFORMED_XK", "FOREIGN_IBAN", "WRONG_LENGTH", "COLUMNS_DISAGREE", "NO_PAYSLIP_ROW", "OTHER", "UNREADABLE"];
  for (const k of order) {
    if (counts[k]) console.log(`  ${k.padEnd(13)} ${counts[k]}`);
  }

  const summed = Object.values(counts).reduce((a, b) => a + b, 0);
  if (summed !== withNumber) {
    console.log(`
  !! ${withNumber - summed} row(s) counted but not classified — the table below is incomplete.`);
  }

  if (repairs.length > 0) {
    console.log(`\nREPAIRABLE WITHOUT ASKING ANYONE — ${repairs.length}:`);
    const byKind = {};
    for (const r of repairs) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
    for (const [k, n] of Object.entries(byKind)) console.log(`  ${k}: ${n}`);
  }

  if (needHuman.length > 0) {
    console.log(`\nNEEDS A HUMAN — ${needHuman.length}. No account digits are printed:`);
    let current = "";
    for (const n of needHuman) {
      if (n.where !== current) {
        current = n.where;
        console.log(`  ${n.where}`);
      }
      console.log(`      ${n.who} [${n.status}] · ${n.bank} · ${n.kind}: ${n.detail}`);
    }
  }

  if (divergent.length > 0) {
    console.log(`\nTHE TWO COLUMNS DISAGREE — ${divergent.length}. None of these is repaired:`);
    for (const m of divergent) console.log(`  ${m.where} · ${m.who}${m.note ? ` · ${m.note}` : ""}`);
  }

  if (!APPLY) {
    console.log(`\nReport only. Re-run with --apply to repair the ${repairs.length} unambiguous row(s).`);
    await prisma.$disconnect();
    return;
  }

  let written = 0;
  for (const r of repairs) {
    // Nothing but sixteen digits is ever written, whatever classify decided.
    if (!SIXTEEN_DIGITS.test(r.repaired ?? "")) {
      console.error(`  refusing to write a non-16-digit repair for ${r.who}`);
      continue;
    }
    const stored = encryptField(r.repaired, key);
    await prisma.employee.update({ where: { id: r.employeeId }, data: { bankAccountIban: stored } });
    if (r.bankAccountId) {
      // Re-encrypted separately: each value carries its own IV by design.
      await prisma.employeeBankAccount.update({
        where: { id: r.bankAccountId },
        data: { iban: encryptField(r.repaired, key) },
      });
    }
    written += 1;
    // Named, so there is a record of which rows moved. An XK repair is
    // reversible without this — the check digits are computable from the
    // account number by ISO 13616 mod-97 — but knowing WHO changed should not
    // depend on recomputing anything.
    console.log(`  repaired: ${r.where} · ${r.who} · ${r.kind}`);
  }
  console.log(`\nRepaired ${written} account number(s). Nothing in the "needs a human" list was touched.`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[bank-accounts] failed:", err);
  process.exitCode = 1;
});
