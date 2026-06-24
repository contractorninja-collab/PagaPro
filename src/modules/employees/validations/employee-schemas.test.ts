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
  jobTitle: null,
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
});
