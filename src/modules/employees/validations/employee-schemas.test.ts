import { describe, expect, it } from "vitest";
import { employeeUpsertSchema } from "@/modules/employees/validations/employee-schemas";

const minimal = {
  firstName: "A",
  lastName: "B",
  personalId: "1234567890",
  dateOfBirth: null,
  gender: null,
  phone: null,
  email: null,
  addressLine: null,
  addressCity: null,
  addressCountry: null,
  departmentId: null,
  jobTitleId: "clxjobtitle00000123456789ab",
  jobTitle: "Punonjës",
  hireDate: "2020-01-15",
  status: "ACTIVE",
  employmentType: "EMPLOYEE",
  workArrangement: "ON_SITE",
  baseSalaryMonthly: 1000,
  weeklyHours: 40,
  bankName: null,
  bankAccountIban: null,
  applyTrust: true,
  applyTax: true,
  emergencyContactName: "E",
  emergencyContactPhone: "+38344111222",
  emergencyContactRelationship: "Familjar",
  internalNotes: null,
  documentsMissing: false,
};

describe("employeeUpsertSchema", () => {
  it("accepts update-shaped payload from payloadFromValues", () => {
    const r = employeeUpsertSchema.safeParse(minimal);
    expect(r.success).toBe(true);
  });

  it("accepts empty departmentId string as null", () => {
    const r = employeeUpsertSchema.safeParse({ ...minimal, departmentId: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.departmentId).toBeNull();
  });

  it("accepts an empty emergency contact", () => {
    const r = employeeUpsertSchema.safeParse({
      ...minimal,
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelationship: "",
    });

    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.emergencyContactName).toBeNull();
      expect(r.data.emergencyContactPhone).toBeNull();
      expect(r.data.emergencyContactRelationship).toBeNull();
    }
  });

  it("rejects missing jobTitleId (Pozita is required)", () => {
    const r = employeeUpsertSchema.safeParse({ ...minimal, jobTitleId: "" });
    expect(r.success).toBe(false);
  });

  it("defaults isForeignNational to false and permit date to absent", () => {
    const r = employeeUpsertSchema.safeParse(minimal);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.isForeignNational).toBe(false);
      expect(r.data.residencePermitExpiryDate ?? null).toBeNull();
    }
  });

  it("accepts a foreign national with a permit expiry date", () => {
    const r = employeeUpsertSchema.safeParse({
      ...minimal,
      isForeignNational: true,
      residencePermitExpiryDate: "2027-03-31",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.isForeignNational).toBe(true);
      expect(r.data.residencePermitExpiryDate).toBeInstanceOf(Date);
      // The flag never overrides the calculation switches by itself —
      // the form drives applyTrust; the schema must pass both through untouched.
      expect(r.data.applyTrust).toBe(true);
      expect(r.data.applyTax).toBe(true);
    }
  });

  it("keeps the CONTRACTOR transform independent of the foreigner flag", () => {
    const r = employeeUpsertSchema.safeParse({
      ...minimal,
      employmentType: "CONTRACTOR",
      isForeignNational: true,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.applyTrust).toBe(false);
      expect(r.data.applyTax).toBe(false);
      expect(r.data.isForeignNational).toBe(true);
    }
  });

  it("passes workplace through and nulls it when empty", () => {
    const set = employeeUpsertSchema.safeParse({ ...minimal, workplace: "Zyra në Prizren" });
    expect(set.success).toBe(true);
    if (set.success) expect(set.data.workplace).toBe("Zyra në Prizren");

    const empty = employeeUpsertSchema.safeParse({ ...minimal, workplace: "" });
    expect(empty.success).toBe(true);
    if (empty.success) expect(empty.data.workplace).toBeNull();
  });

  it("accepts optional whole-number probation months", () => {
    const empty = employeeUpsertSchema.safeParse({ ...minimal, probationMonths: "" });
    expect(empty.success).toBe(true);
    if (empty.success) expect(empty.data.probationMonths).toBeNull();

    for (const months of [0, 1, 6]) {
      const r = employeeUpsertSchema.safeParse({ ...minimal, probationMonths: months });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.probationMonths).toBe(months);
    }
  });
});
