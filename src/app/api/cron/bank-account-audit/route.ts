import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptField } from "@/lib/field-crypto";
import { normalizeBankAccountNumber } from "@/modules/employees/validations/employee-schemas";
import { resolveEmployeeBank } from "@/modules/employees/helpers/employee-bank-resolver";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * TEMPORARY diagnostic (CRON_SECRET-gated, not scheduled): classifies every
 * stored bank account in production so HR knows exactly which records the
 * payment list will refuse. Names and problem classes only — NO account
 * digits ever appear in the response, masked or otherwise. Removed after use.
 */

type ProblemKind = "MISSING" | "UNREADABLE" | "INVALID" | "DIVERGENT";

interface Problem {
  name: string;
  status: string;
  kind: ProblemKind;
  /** Digit-free description of what is wrong. */
  detail: string;
}

/** Describes an unusable value without reproducing any digit of it. */
function describeInvalid(raw: string): string {
  const compact = raw.replace(/[\s.\-/]/g, "").toUpperCase();
  if (/^[A-Z]{2}/.test(compact) && !compact.startsWith("XK")) {
    return `IBAN i huaj (${compact.slice(0, 2)}), ${compact.length} karaktere`;
  }
  if (compact.startsWith("XK")) {
    return `XK IBAN i keqformuar, ${compact.length} karaktere (priten 20)`;
  }
  if (/^\d+$/.test(compact)) {
    return `${compact.length} shifra (priten 16)`;
  }
  return `${compact.length} karaktere, përmban simbole/shkronja`;
}

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: false }, { status: 503 });
  if ((req.headers.get("authorization")?.trim() ?? "") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const companies = await prisma.company.findMany({
    select: { id: true, legalName: true },
    orderBy: { legalName: "asc" },
  });

  const report: Record<string, unknown> = {};
  let keyLooksBroken = 0;
  let totalStored = 0;

  for (const c of companies) {
    const employees = await prisma.employee.findMany({
      where: { companyId: c.id },
      select: {
        firstName: true,
        lastName: true,
        status: true,
        employmentType: true,
        bankName: true,
        bankAccountIban: true,
        bankAccounts: {
          select: {
            iban: true,
            bankName: true,
            accountHolderName: true,
            bicSwift: true,
            isPrimary: true,
            validFrom: true,
            validTo: true,
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    let payable = 0;
    let terminatedSkipped = 0;
    const problems: Problem[] = [];

    for (const e of employees) {
      const name = `${e.firstName} ${e.lastName}`.trim();
      const live = e.status !== "TERMINATED";
      if (!live) {
        terminatedSkipped += 1;
        continue;
      }

      const resolved = resolveEmployeeBank(e);
      const effective = resolved.iban?.trim() ?? "";

      if (effective === "") {
        problems.push({
          name,
          status: e.status,
          kind: "MISSING",
          detail:
            e.employmentType === "CONTRACTOR"
              ? "Pa llogari (kontraktor)"
              : "Pa llogari bankare në profil",
        });
        continue;
      }

      totalStored += 1;

      if (effective === "***") {
        keyLooksBroken += 1;
        problems.push({
          name,
          status: e.status,
          kind: "UNREADABLE",
          detail: "Nuk deshifrohet — problem çelësi, jo i të dhënave",
        });
        continue;
      }

      const normalized = normalizeBankAccountNumber(effective);
      if (normalized.value == null) {
        problems.push({
          name,
          status: e.status,
          kind: "INVALID",
          detail: describeInvalid(effective),
        });
        continue;
      }

      // Divergence: the payslip pays from the account row; the profile edit
      // form historically preferred the legacy column. If both exist and name
      // DIFFERENT accounts, a human must say which one is right.
      const rowRaw = e.bankAccounts.find((a) => a.iban?.trim())?.iban ?? null;
      const legacyRaw = e.bankAccountIban ?? null;
      if (rowRaw && legacyRaw) {
        const rowNorm = normalizeBankAccountNumber(decryptField(rowRaw)).value;
        const legacyNorm = normalizeBankAccountNumber(decryptField(legacyRaw)).value;
        if (rowNorm && legacyNorm && rowNorm !== legacyNorm) {
          problems.push({
            name,
            status: e.status,
            kind: "DIVERGENT",
            detail: "Llogaria e profilit dhe rreshti bankar emërtojnë numra të ndryshëm",
          });
          continue;
        }
      }

      payable += 1;
    }

    report[c.legalName] = {
      liveEmployees: employees.length - terminatedSkipped,
      payable,
      problems,
      terminatedSkipped,
    };
  }

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    encryptionKeyLooksBroken: totalStored > 0 && keyLooksBroken === totalStored,
    report,
  });
}
