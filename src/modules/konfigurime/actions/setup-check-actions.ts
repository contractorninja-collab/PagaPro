"use server";

import { prisma } from "@/lib/prisma";
import { companyContextErrorMessage, getCompanyContext } from "@/server/company-context";
import {
  SETUP_CONTRACT_BLOCKING_KEYS,
  SETUP_CONTRACT_KEY_META,
} from "@/modules/konfigurime/setup/setup-defaults";

/**
 * The onboarding runbook's acid test, as a button.
 *
 * Resolves every placeholder of a real contract template against a real
 * employee and reports what comes back blank — but writes **nothing**. The
 * generation path would persist a `DocumentGenerationArtifact`, which would put
 * a test contract at the top of the client's document register on their first
 * day. Resolution alone answers the question.
 *
 * The template's own `required` flags are deliberately not used: the bundled
 * contract mapping marks only four fields, so a contract with no NUI and no
 * signer passes that check while printing blanks where the employer and the
 * signature belong. The curated list in setup-defaults.ts is the real bar.
 */

/** Same names `generateContractDocumentAction` resolves by. */
const PREFERRED_CONTRACT_NAMES = ["Kontrate me Afat te Pacaktuar", "Kontrate me Afat te Caktuar"] as const;
const ANNEX_TEMPLATE_NAME = "Aneks i kontratës";

export interface SetupContractCheckMissing {
  key: string;
  label: string;
  step: "pozitat" | "punonjesit" | "perfaqesuesi";
}

export interface SetupContractCheckResult {
  employeeName: string;
  templateName: string;
  checkedCount: number;
  missing: SetupContractCheckMissing[];
}

export type SetupContractCheckOutcome =
  | { ok: true; data: SetupContractCheckResult }
  | { ok: false; error: string };

export async function runSetupContractCheckAction(
  raw: unknown,
): Promise<SetupContractCheckOutcome> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const { companyId } = ctx.context;

  const requestedEmployeeId =
    raw && typeof raw === "object" && typeof (raw as { employeeId?: unknown }).employeeId === "string"
      ? (raw as { employeeId: string }).employeeId
      : null;

  const employee = await prisma.employee.findFirst({
    where: {
      companyId,
      status: { not: "TERMINATED" },
      ...(requestedEmployeeId ? { id: requestedEmployeeId } : {}),
    },
    select: { id: true, firstName: true, lastName: true, hireDate: true },
    orderBy: { createdAt: "asc" },
  });
  if (!employee) {
    return { ok: false, error: "Shtoni së paku një punonjës para kontrollit." };
  }

  // A version can only render if it is both published and mapped.
  const candidates = await prisma.documentTemplateVersion.findMany({
    where: {
      isPublished: true,
      isMapped: true,
      template: { companyId, documentCategory: "CONTRACT", isActive: true },
    },
    select: { id: true, template: { select: { name: true } } },
    orderBy: { uploadedAt: "desc" },
  });

  // "Aneks i kontratës" also lives under CONTRACT and is seeded last, so a
  // newest-first pick lands on it — and telling a first-time client their
  // *annex* is complete answers a question they did not ask. Prefer the
  // employment contracts by the same names the generate flow uses.
  const version =
    candidates.find((c) => c.template.name === PREFERRED_CONTRACT_NAMES[0]) ??
    candidates.find((c) => c.template.name === PREFERRED_CONTRACT_NAMES[1]) ??
    candidates.find((c) => c.template.name !== ANNEX_TEMPLATE_NAME) ??
    null;
  if (!version) {
    return {
      ok: false,
      error:
        "Nuk ka shabllon kontrate të publikuar dhe të mapuar për këtë kompani. Kontaktoni mbështetjen.",
    };
  }

  try {
    // Dynamic, as the documents actions do — keeps the docx engine out of the
    // Konfigurimet client chunk.
    const { resolvePlaceholderValues } = await import(
      "@/modules/documents/engine/resolve-placeholder-values"
    );
    const result = await resolvePlaceholderValues({
      companyId,
      employeeId: employee.id,
      templateVersionId: version.id,
      subjectKind: "CONTRACT",
      subjectId: employee.id,
      documentInput: {
        documentDateIso: new Date().toISOString().slice(0, 10),
        contractStartDateIso: employee.hireDate.toISOString().slice(0, 10),
      },
    });

    const values: Record<string, string> = result.values ?? {};
    const missing: SetupContractCheckMissing[] = [];
    for (const key of SETUP_CONTRACT_BLOCKING_KEYS) {
      const v = values[key];
      if (v === undefined || v.trim().length === 0) {
        const meta = SETUP_CONTRACT_KEY_META[key];
        missing.push({ key, label: meta.label, step: meta.step });
      }
    }

    return {
      ok: true,
      data: {
        employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
        templateName: version.template.name,
        checkedCount: SETUP_CONTRACT_BLOCKING_KEYS.length,
        missing,
      },
    };
  } catch (err) {
    console.error("[pagapro] runSetupContractCheckAction failed", err);
    return { ok: false, error: "Kontrolli dështoi. Provoni sërish ose kontaktoni mbështetjen." };
  }
}
