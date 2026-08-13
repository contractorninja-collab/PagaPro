import { describe, expect, it } from "vitest";
import { GENDER_LABELS, GENDER_OPTIONS } from "@/modules/employees/components/employees-labels";
import { genderFieldSchema } from "@/modules/employees/validations/employee-schemas";

/**
 * The employee form offers two genders and nothing else. Kept as a test because
 * the column's enum still carries the retired values, so a stray import or a
 * regenerated Prisma client could quietly put them back in the picker.
 */
describe("gender choices", () => {
  it("offers exactly Mashkull and Femër", () => {
    expect(GENDER_OPTIONS.map((o) => o.value)).toEqual(["MALE", "FEMALE"]);
    expect(GENDER_OPTIONS.map((o) => o.label)).toEqual(["Mashkull", "Femër"]);
  });

  it("refuses to save the retired values", () => {
    expect(genderFieldSchema.safeParse("MALE").success).toBe(true);
    expect(genderFieldSchema.safeParse("FEMALE").success).toBe(true);
    expect(genderFieldSchema.safeParse("OTHER").success).toBe(false);
    expect(genderFieldSchema.safeParse("UNSPECIFIED").success).toBe(false);
  });

  it("still names a record saved with a retired value, rather than showing a blank", () => {
    expect(GENDER_LABELS.OTHER).toBe("Tjetër");
    expect(GENDER_LABELS.UNSPECIFIED).toBe("Pa specifikuar");
  });
});
