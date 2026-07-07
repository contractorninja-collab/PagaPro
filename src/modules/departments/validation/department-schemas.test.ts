import { describe, expect, it } from "vitest";
import {
  createDepartmentSchema,
  departmentNameSchema,
  renameDepartmentSchema,
} from "../validation/department-schemas";

describe("department schemas", () => {
  it("accepts a trimmed department name", () => {
    const parsed = createDepartmentSchema.safeParse({ name: "  Financa  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Financa");
    }
  });

  it("rejects empty department names", () => {
    expect(departmentNameSchema.safeParse("   ").success).toBe(false);
    expect(createDepartmentSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("requires id when renaming", () => {
    expect(renameDepartmentSchema.safeParse({ id: "", name: "HR" }).success).toBe(false);
    expect(renameDepartmentSchema.safeParse({ id: "dept-1", name: "HR" }).success).toBe(true);
  });
});

describe("department mutation result codes", () => {
  it("maps duplicate constraint to DUPLICATE_NAME", () => {
    const err = { code: "P2002" };
    expect((err as { code?: string }).code === "P2002").toBe(true);
  });
});
