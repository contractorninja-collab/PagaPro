import { describe, expect, it } from "vitest";
import { buildCoreOrganizationalContext } from "../context/build-core-context";

const company = {
  legalName: "FastTech LLC",
  tradeName: null,
  fiscalNumber: null,
  businessRegistrationNumber: null,
};

const employee = {
  firstName: "A",
  lastName: "B",
  personalId: null,
  jobTitle: "Developer",
  addressLine: null,
  addressCity: null,
  addressCountry: null,
  baseSalaryMonthly: "1000.00",
  weeklyHours: "40",
  standardMonthlyHours: "176",
};

describe("buildCoreOrganizationalContext", () => {
  it("formats probation months as contract duration text", () => {
    const ctx = buildCoreOrganizationalContext({
      employee: { ...employee, probationMonths: 1 },
      company,
      settings: null,
    });

    expect(ctx.probation_months).toBe("1");
    expect(ctx.probation_period).toBe("1 Muaj");
  });

  it("leaves probation placeholders empty when no probation is set", () => {
    const ctx = buildCoreOrganizationalContext({
      employee: { ...employee, probationMonths: 0 },
      company,
      settings: null,
    });

    expect(ctx.probation_months).toBe("");
    expect(ctx.probation_period).toBe("");
  });

  it("uses the configured company address city as document place", () => {
    const ctx = buildCoreOrganizationalContext({
      employee,
      company: { ...company, city: "Prishtinë", addressLine: "Ferizaj" },
      settings: null,
    });

    expect(ctx.document_place).toBe("Ferizaj");
  });

  it("extracts document place from a full configured company address", () => {
    const ctx = buildCoreOrganizationalContext({
      employee,
      company: { ...company, city: null, addressLine: "Rr. Deshmoret e Kombit 70000, Ferizaj" },
      settings: null,
    });

    expect(ctx.document_place).toBe("Ferizaj");
  });
});
