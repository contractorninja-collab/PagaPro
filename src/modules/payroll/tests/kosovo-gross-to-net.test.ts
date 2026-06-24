import { describe, expect, it } from "vitest";
import { calculateKosovoPrimaryPayrollFromGross } from "@/modules/payroll/engine/kosovo-gross-to-net";

describe("Kosovo PRIMARY payroll — mandated deterministic cases", () => {
  it("TEST CASE 1 — gross 1000 EUR", () => {
    const r = calculateKosovoPrimaryPayrollFromGross({ grossSalary: "1000" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.pensionEmployee).toBe("50.00");
    expect(r.value.taxableIncome).toBe("950.00");
    expect(r.value.pitWithheld).toBe("66.00");
    expect(r.value.netPay).toBe("884.00");
    expect(r.value.pensionEmployer).toBe("50.00");
    expect(r.value.employerTotalCost).toBe("1050.00");
  });

  it("TEST CASE 2 — gross 750 EUR", () => {
    const r = calculateKosovoPrimaryPayrollFromGross({ grossSalary: "750" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.pensionEmployee).toBe("37.50");
    expect(r.value.taxableIncome).toBe("712.50");
    expect(r.value.pitWithheld).toBe("42.25");
    expect(r.value.netPay).toBe("670.25");
    expect(r.value.pensionEmployer).toBe("37.50");
    expect(r.value.employerTotalCost).toBe("787.50");
  });

  it("TEST CASE 3 — gross 425 EUR", () => {
    const r = calculateKosovoPrimaryPayrollFromGross({ grossSalary: "425" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.pensionEmployee).toBe("21.25");
    expect(r.value.taxableIncome).toBe("403.75");
    expect(r.value.pitWithheld).toBe("12.30");
    expect(r.value.netPay).toBe("391.45");
    expect(r.value.pensionEmployer).toBe("21.25");
    expect(r.value.employerTotalCost).toBe("446.25");
  });

  it("TEST CASE 4 — gross 1369.59 EUR (rounding)", () => {
    const r = calculateKosovoPrimaryPayrollFromGross({ grossSalary: "1369.59" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.pensionEmployee).toBe("68.48");
    expect(r.value.taxableIncome).toBe("1301.11");
    expect(r.value.pitWithheld).toBe("101.11");
    expect(r.value.netPay).toBe("1200.00");
    expect(r.value.pensionEmployer).toBe("68.48");
    expect(r.value.employerTotalCost).toBe("1438.07");
  });

  it("rejects non-positive gross", () => {
    expect(calculateKosovoPrimaryPayrollFromGross({ grossSalary: "0" }).ok).toBe(false);
    expect(calculateKosovoPrimaryPayrollFromGross({ grossSalary: "-10" }).ok).toBe(false);
  });

  it("second bracket — 8% marginal only on taxable above 250", () => {
    const r = calculateKosovoPrimaryPayrollFromGross({ grossSalary: "400" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.taxableIncome).toBe("380.00");
    expect(r.value.pitWithheld).toBe("10.40");
  });
});
