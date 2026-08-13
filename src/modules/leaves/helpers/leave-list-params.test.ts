import { describe, expect, it } from "vitest";
import { parseLeaveListParams } from "@/modules/leaves/helpers/leave-list-params";

/**
 * This parser is the single reader behind both the Pushimet page and the CSV
 * export. If it drifts, the file someone downloads stops describing the list
 * they were looking at — silently, because nothing in the CSV says so.
 */
const NOW = new Date("2026-08-13T09:30:00.000Z");

describe("parseLeaveListParams", () => {
  it("falls back to the current year and month when nothing is given", () => {
    const p = parseLeaveListParams({}, NOW);
    expect(p.year).toBe(2026);
    expect(p.month).toBe(8);
    expect(p.allMonths).toBe(false);
    expect(p.filters).toEqual({
      employeeId: undefined,
      departmentId: undefined,
      type: undefined,
      status: undefined,
      year: 2026,
      month: 8,
    });
  });

  it("does not read an empty year as year 0", () => {
    // Number("") is 0 and 0 is finite — the trap that once made a bare
    // /pushimet filter to nothing and draw a 1900 calendar.
    expect(parseLeaveListParams({ year: "" }, NOW).year).toBe(2026);
    expect(parseLeaveListParams({ year: "0" }, NOW).year).toBe(2026);
  });

  it("rejects a year outside the supported range", () => {
    expect(parseLeaveListParams({ year: "1492" }, NOW).year).toBe(2026);
    expect(parseLeaveListParams({ year: "9999" }, NOW).year).toBe(2026);
    expect(parseLeaveListParams({ year: "2024" }, NOW).year).toBe(2024);
  });

  it("treats month=0 as the whole year while the calendar keeps a real month", () => {
    const p = parseLeaveListParams({ year: "2025", month: "0" }, NOW);
    expect(p.allMonths).toBe(true);
    expect(p.filters.month).toBeUndefined();
    expect(p.filters.year).toBe(2025);
    // The calendar can only draw one month, so it still resolves to one.
    expect(p.month).toBe(8);
  });

  it("ignores an out-of-range month", () => {
    expect(parseLeaveListParams({ month: "13" }, NOW).month).toBe(8);
    expect(parseLeaveListParams({ month: "-3" }, NOW).month).toBe(8);
    expect(parseLeaveListParams({ month: "5" }, NOW).month).toBe(5);
  });

  it("drops an unknown leave type or status rather than querying for it", () => {
    const p = parseLeaveListParams({ type: "NOT_A_TYPE", status: "MAYBE" }, NOW);
    expect(p.type).toBe("");
    expect(p.status).toBe("");
    expect(p.filters.type).toBeUndefined();
    expect(p.filters.status).toBeUndefined();
  });

  it("passes through a valid type, status, employee and department", () => {
    const p = parseLeaveListParams(
      {
        type: "PUSHIM_VJETOR",
        status: "APPROVED",
        employeeId: "emp_1",
        departmentId: "dep_1",
      },
      NOW,
    );
    expect(p.filters.type).toBe("PUSHIM_VJETOR");
    expect(p.filters.status).toBe("APPROVED");
    expect(p.filters.employeeId).toBe("emp_1");
    expect(p.filters.departmentId).toBe("dep_1");
  });

  it("treats a blank employee or department as no filter, not as an empty id", () => {
    const p = parseLeaveListParams({ employeeId: "", departmentId: "" }, NOW);
    expect(p.filters.employeeId).toBeUndefined();
    expect(p.filters.departmentId).toBeUndefined();
  });

  it("takes the first value when a parameter repeats", () => {
    const p = parseLeaveListParams({ status: ["APPROVED", "REJECTED"] }, NOW);
    expect(p.filters.status).toBe("APPROVED");
  });

  it("normalises the page number", () => {
    expect(parseLeaveListParams({}, NOW).page).toBe(1);
    expect(parseLeaveListParams({ page: "3" }, NOW).page).toBe(3);
    expect(parseLeaveListParams({ page: "0" }, NOW).page).toBe(1);
    expect(parseLeaveListParams({ page: "-2" }, NOW).page).toBe(1);
    expect(parseLeaveListParams({ page: "abc" }, NOW).page).toBe(1);
    expect(parseLeaveListParams({ page: "2.7" }, NOW).page).toBe(2);
  });
});
