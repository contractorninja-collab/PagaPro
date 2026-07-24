import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildMergedPlaceholderContext } from "../services/build-placeholder-context";

const company = {
  legalName: "PagaPro Test LLC",
  tradeName: null,
  fiscalNumber: null,
  businessRegistrationNumber: null,
  addressLine: "Selia në Prishtinë",
  city: "Prishtinë",
  postalCode: null,
  country: "XK",
};

const employee = {
  id: "employee-1",
  firstName: "Arta",
  lastName: "Berisha",
  personalId: "1234567890",
  jobTitle: "Menaxhere",
  department: { name: "Operacione" },
  addressLine: "Adresa e shtëpisë",
  addressCity: "Prishtinë",
  addressCountry: "XK",
  workplace: "Dega në Prizren",
  baseSalaryMonthly: { toFixed: () => "1000.00" },
};

function prismaMock(overrides: Record<string, unknown>): PrismaClient {
  return {
    company: { findUnique: async () => company },
    companySetting: { findUnique: async () => null },
    companyConfiguration: { findUnique: async () => null },
    ...overrides,
  } as unknown as PrismaClient;
}

describe("buildMergedPlaceholderContext workplace", () => {
  it("includes the employee workplace in generic employee paperwork", async () => {
    const prisma = prismaMock({
      employee: { findFirst: async () => employee },
    });

    const result = await buildMergedPlaceholderContext(prisma, {
      companyId: "company-1",
      subjectKind: "OTHER",
      subjectId: "employee-1",
      employeeId: "employee-1",
      documentDate: new Date("2026-07-24T00:00:00.000Z"),
    });

    expect(result.merged.workplace).toMatch(/^Dega në Prizren,/);
    expect(result.merged.workplace).not.toContain("Adresa e shtëpisë");
  });

  it("includes the employee workplace in termination paperwork", async () => {
    const prisma = prismaMock({
      termination: {
        findFirst: async () => ({
          employee,
          terminationDate: new Date("2026-07-31T00:00:00.000Z"),
          lastWorkingDay: new Date("2026-07-31T00:00:00.000Z"),
          noticeDate: null,
          type: "LARGIM_VULLNETAR",
          status: "DRAFT",
          noticeDays: 0,
          severanceAmount: null,
          reason: "Arsye personale",
          details: null,
        }),
      },
    });

    const result = await buildMergedPlaceholderContext(prisma, {
      companyId: "company-1",
      subjectKind: "TERMINATION",
      subjectId: "termination-1",
      documentDate: new Date("2026-07-24T00:00:00.000Z"),
    });

    expect(result.merged.workplace).toMatch(/^Dega në Prizren,/);
    expect(result.merged.workplace).not.toContain("Adresa e shtëpisë");
  });

  it("uses the general document prefix for non-contract paperwork", async () => {
    const prisma = prismaMock({
      companyConfiguration: {
        findUnique: async () => ({
          contractReferencePrefix: "KON-",
          payrollPdfPrefix: "PAY-",
          generalDocumentPrefix: "DOC-",
        }),
      },
      employee: { findFirst: async () => employee },
    });

    const result = await buildMergedPlaceholderContext(prisma, {
      companyId: "company-1",
      subjectKind: "OTHER",
      subjectId: "employee-1",
      employeeId: "employee-1",
      documentDate: new Date("2026-07-24T00:00:00.000Z"),
    });

    expect(result.merged.document_reference_prefix).toBe("DOC-");
  });

  it("uses the contract prefix for contracts and annex context", async () => {
    const prisma = prismaMock({
      companyConfiguration: {
        findUnique: async () => ({
          contractReferencePrefix: "KON-",
          payrollPdfPrefix: "PAY-",
          generalDocumentPrefix: "DOC-",
        }),
      },
      employee: {
        findFirst: async () => ({
          ...employee,
          hireDate: new Date("2026-01-15T00:00:00.000Z"),
          terminationDate: null,
          probationMonths: null,
          weeklyHours: null,
          standardMonthlyHours: null,
        }),
      },
    });

    const result = await buildMergedPlaceholderContext(prisma, {
      companyId: "company-1",
      subjectKind: "CONTRACT",
      subjectId: "employee-1",
      employeeId: "employee-1",
      documentDate: new Date("2026-07-24T00:00:00.000Z"),
    });

    expect(result.merged.document_reference_prefix).toBe("KON-");
  });
});
