import { describe, expect, it } from "vitest";
import {
  LIBRI_PAGAVE_BANDS,
  LIBRI_PAGAVE_COLUMNS,
} from "@/modules/reports/exporters/libri-pagave-columns";
import { buildLibriPagaveRows } from "@/modules/reports/exporters/libri-pagave-rows";

describe("LIBRI_PAGAVE_COLUMNS", () => {
  it("declares all 25 official columns, numbered in order", () => {
    expect(LIBRI_PAGAVE_COLUMNS).toHaveLength(25);
    expect(LIBRI_PAGAVE_COLUMNS.map((c) => c.index)).toEqual(
      Array.from({ length: 25 }, (_, i) => i + 1),
    );
  });

  it("keeps the official column number inside every exported header", () => {
    for (const column of LIBRI_PAGAVE_COLUMNS) {
      expect(column.headerSq).toContain(`(${column.index})`);
    }
  });

  it("uses keys the row builder actually produces", () => {
    const [row] = buildLibriPagaveRows([
      {
        entry: {
          employeeId: "e1",
          grossSalary: "1000.00",
          netPay: "800.00",
          pensionEmployee: "50.00",
          pensionEmployer: "50.00",
          pitWithheld: "95.00",
          taxableIncome: "950.00",
          actualRegularHours: "174",
          overtimeHours: "0",
          nightHours: "0",
          holidayHours: "0",
          weekendHours: "0",
          bonuses: "0.00",
          otherDeductions: "0.00",
          salaryAdvanceDeduction: "0.00",
          unpaidLeaveHours: "0",
        },
        employee: {
          firstName: "Test",
          lastName: "Punëtori",
          applyTrust: true,
          applyTax: true,
          department: null,
        },
      },
    ] as never);

    // `nr` mirrors `idp` at render time; every other key must exist on the row.
    const rowKeys = new Set(Object.keys(row as unknown as Record<string, unknown>));
    const missing = LIBRI_PAGAVE_COLUMNS.map((c) => c.key)
      .filter((key) => key !== "nr" && key !== "primacy")
      .filter((key) => !rowKeys.has(key));
    expect(missing).toEqual([]);
  });

  it("covers every column exactly once with the group bands", () => {
    const covered: number[] = [];
    for (const band of LIBRI_PAGAVE_BANDS) {
      expect(band.to).toBeGreaterThanOrEqual(band.from);
      for (let i = band.from; i <= band.to; i += 1) covered.push(i);
    }
    expect(covered).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it("assigns each column the band that spans it", () => {
    for (const column of LIBRI_PAGAVE_COLUMNS) {
      const band = LIBRI_PAGAVE_BANDS.find(
        (b) => column.index >= b.from && column.index <= b.to,
      );
      expect(band?.band).toBe(column.band);
    }
  });
});
