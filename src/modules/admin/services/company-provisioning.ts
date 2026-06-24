import { prisma } from "@/lib/prisma";
import { maybeSeedKosovoOfficialFixedHolidaysForCurrentUtcYearIfEmpty } from "@/modules/payroll/services/company-holiday-service";
import type { CompanyUpsertInput } from "@/modules/admin/validation/admin-schemas";

export type ProvisionCompanyResult =
  | { ok: true; id: string }
  | { ok: false; code: "DUPLICATE_NUI" | "DUPLICATE_NRB" | "DB_ERROR"; message?: string };

function duplicateTarget(err: unknown): string {
  const meta = (err as { meta?: { target?: string[] | string } })?.meta;
  const target = meta?.target;
  return Array.isArray(target) ? target.join(",") : String(target ?? "");
}

/**
 * Creates a customer business (tenant) and provisions the baseline data a new
 * tenant needs to operate: Kosovo official holidays for the current year and a
 * default payroll parameter set (Kosovo statutory baseline, same as dev seed).
 */
export async function provisionCompany(input: CompanyUpsertInput): Promise<ProvisionCompanyResult> {
  let companyId: string;
  try {
    const company = await prisma.company.create({
      data: {
        legalName: input.legalName,
        tradeName: input.tradeName ?? null,
        fiscalNumber: input.fiscalNumber ?? null,
        businessRegistrationNumber: input.businessRegistrationNumber ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        website: input.website ?? null,
        addressLine: input.addressLine ?? null,
        city: input.city ?? null,
        postalCode: input.postalCode ?? null,
      },
      select: { id: true },
    });
    companyId = company.id;
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      const target = duplicateTarget(err);
      if (target.includes("fiscalNumber")) return { ok: false, code: "DUPLICATE_NUI" };
      if (target.includes("businessRegistrationNumber")) return { ok: false, code: "DUPLICATE_NRB" };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, code: "DB_ERROR", message };
  }

  // Baseline provisioning — failures here must not orphan the company silently; log and continue.
  try {
    await maybeSeedKosovoOfficialFixedHolidaysForCurrentUtcYearIfEmpty(companyId);
  } catch (err) {
    console.error(`[provisionCompany] holiday seeding failed for ${companyId}:`, err);
  }

  try {
    await prisma.payrollParameterSet.create({
      data: {
        companyId,
        effectiveFrom: new Date("2020-01-01T00:00:00.000Z"),
        label: "Parametrat bazë (Kosovë)",
        minimumMonthlyWage: "350",
        pensionEmployeeRate: "0.05",
        pensionEmployerRate: "0.05",
      },
    });
  } catch (err) {
    console.error(`[provisionCompany] payroll parameter set creation failed for ${companyId}:`, err);
  }

  return { ok: true, id: companyId };
}
