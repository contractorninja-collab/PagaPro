import { describe, expect, it } from "vitest";
import { deriveCostMetrics } from "../dashboard-metrics-service";
import type { PayrollCostPoint } from "@/modules/reports/services/report-analytics-service";

function point(overrides: Partial<PayrollCostPoint> & { year: number; month: number }): PayrollCostPoint {
  return {
    key: `${overrides.year}-${String(overrides.month).padStart(2, "0")}`,
    label: `M${overrides.month}`,
    gross: 1000,
    net: 850,
    employerCost: 1100,
    employerBurden: 100,
    pit: 60,
    pensionEmployee: 50,
    pensionEmployer: 50,
    employees: 10,
    isDraft: false,
    ...overrides,
  };
}

describe("deriveCostMetrics", () => {
  it("computes month-over-month against the previous calendar month", () => {
    const m = deriveCostMetrics({
      year: 2026,
      month: 7,
      series: [
        point({ year: 2026, month: 6, employerCost: 1000 }),
        point({ year: 2026, month: 7, employerCost: 1250 }),
      ],
      previousYearSeries: [],
    });

    expect(m.current?.month).toBe(7);
    expect(m.previous?.month).toBe(6);
    expect(m.momEmployerCostPct).toBe(25);
  });

  it("reaches into the previous year for January's previous month", () => {
    const m = deriveCostMetrics({
      year: 2026,
      month: 1,
      series: [point({ year: 2026, month: 1, employerCost: 900 })],
      previousYearSeries: [point({ year: 2025, month: 12, employerCost: 1000 })],
    });

    expect(m.previous?.year).toBe(2025);
    expect(m.previous?.month).toBe(12);
    expect(m.momEmployerCostPct).toBe(-10);
  });

  it("compares the same month a year earlier", () => {
    const m = deriveCostMetrics({
      year: 2026,
      month: 7,
      series: [point({ year: 2026, month: 7, employerCost: 1200 })],
      previousYearSeries: [point({ year: 2025, month: 7, employerCost: 1000 })],
    });
    expect(m.yoyEmployerCostPct).toBe(20);
  });

  it("returns null rather than Infinity when the baseline is zero", () => {
    const m = deriveCostMetrics({
      year: 2026,
      month: 7,
      series: [
        point({ year: 2026, month: 6, employerCost: 0 }),
        point({ year: 2026, month: 7, employerCost: 1250 }),
      ],
      previousYearSeries: [],
    });
    expect(m.momEmployerCostPct).toBeNull();
  });

  it("returns null comparisons for a company with no payroll at all", () => {
    const m = deriveCostMetrics({ year: 2026, month: 7, series: [], previousYearSeries: [] });

    expect(m.current).toBeNull();
    expect(m.previous).toBeNull();
    expect(m.momEmployerCostPct).toBeNull();
    expect(m.yoyEmployerCostPct).toBeNull();
    expect(m.averageEmployerCostPerEmployee).toBeNull();
    expect(m.ytd).toEqual({ gross: 0, net: 0, employerCost: 0, months: 0 });
  });

  it("excludes draft periods and later months from year-to-date", () => {
    const m = deriveCostMetrics({
      year: 2026,
      month: 3,
      series: [
        point({ year: 2026, month: 1, employerCost: 1000, gross: 900, net: 800 }),
        point({ year: 2026, month: 2, employerCost: 1000, gross: 900, net: 800, isDraft: true }),
        point({ year: 2026, month: 3, employerCost: 1000, gross: 900, net: 800 }),
        point({ year: 2026, month: 4, employerCost: 9999, gross: 9999, net: 9999 }),
      ],
      previousYearSeries: [],
    });

    // January + March only: February is still a draft, April is in the future.
    expect(m.ytd).toEqual({ gross: 1800, net: 1600, employerCost: 2000, months: 2 });
  });

  it("does not divide by zero when a period has no employees", () => {
    const m = deriveCostMetrics({
      year: 2026,
      month: 7,
      series: [point({ year: 2026, month: 7, employees: 0, employerCost: 500 })],
      previousYearSeries: [],
    });
    expect(m.averageEmployerCostPerEmployee).toBeNull();
  });

  it("divides employer cost by headcount when there is one", () => {
    const m = deriveCostMetrics({
      year: 2026,
      month: 7,
      series: [point({ year: 2026, month: 7, employees: 4, employerCost: 1000 })],
      previousYearSeries: [],
    });
    expect(m.averageEmployerCostPerEmployee).toBe(250);
  });
});
