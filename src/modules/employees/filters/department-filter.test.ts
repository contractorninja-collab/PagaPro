import { describe, expect, it } from "vitest";
import {
  UNASSIGNED_DEPARTMENT_FILTER,
  employeeDepartmentHref,
  employeeDepartmentWhere,
} from "./department-filter";

describe("employee department filters", () => {
  it("filters a concrete department and builds its employee-list URL", () => {
    expect(employeeDepartmentWhere("dept-1")).toEqual({
      departmentId: "dept-1",
    });
    expect(employeeDepartmentHref("dept-1")).toBe(
      "/punonjesit?departmentId=dept-1",
    );
  });

  it("maps the unassigned dashboard group to a null department filter", () => {
    expect(employeeDepartmentWhere(UNASSIGNED_DEPARTMENT_FILTER)).toEqual({
      departmentId: null,
    });
    expect(employeeDepartmentHref(null)).toBe(
      `/punonjesit?departmentId=${UNASSIGNED_DEPARTMENT_FILTER}`,
    );
  });

  it("leaves the department condition empty when no filter is selected", () => {
    expect(employeeDepartmentWhere("")).toEqual({});
  });
});
