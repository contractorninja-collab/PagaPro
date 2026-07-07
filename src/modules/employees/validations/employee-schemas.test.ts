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

  it("rejects missing jobTitleId (Pozita is required)", () => {
    const r = employeeUpsertSchema.safeParse({ ...minimal, jobTitleId: "" });
    expect(r.success).toBe(false);
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
