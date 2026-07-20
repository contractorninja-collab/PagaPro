import { describe, it, expect } from "vitest";
import { generateBrandedFinancialWorkbookBuffer } from "./branded-financial-export";

describe("generateBrandedFinancialWorkbookBuffer", () => {
  it("should successfully generate a branded Excel workbook buffer", async () => {
    const buffer = await generateBrandedFinancialWorkbookBuffer({
      payroll: {
        year: 2026,
        month: 6,
        monthLabel: "Qershor 2026",
      },
      companyLabel: "Test Company Sh.p.k.",
      totals: {
        gross: "5000.00",
        net: "4200.00",
        employerTotalCost: "5250.00",
        taxableIncome: "4500.00",
        pitWithheld: "300.00",
        pensionEmployee: "250.00",
        pensionEmployer: "250.00",
      },
      entries: [
        {
          employerPrimacySnapshot: "PRIMARY",
          hourlyRate: "10.000000",
          actualRegularHours: "160.00",
          paidLeaveHours: "0.00",
          sickLeaveHours: "0.00",
          overtimeHours: "0.00",
          weekendHours: "0.00",
          holidayHours: "0.00",
          nightHours: "0.00",
          regularPay: "1600.00",
          paidLeavePay: "0.00",
          sickLeavePay: "0.00",
          overtimeAmount: "0.00",
          holidayAmount: "0.00",
          weekendAmount: "0.00",
          nightAmount: "0.00",
          bonuses: "0.00",
          unpaidLeaveDeduction: "0.00",
          otherDeductions: "0.00",
          salaryAdvanceDeduction: "0.00",
          grossSalary: "1600.00",
          taxableIncome: "1520.00",
          pitWithheld: "120.00",
          pensionEmployee: "80.00",
          pensionEmployer: "80.00",
          netPay: "1400.00",
          employee: {
            firstName: "Arjan",
            lastName: "Bajrami",
            applyTrust: true,
            applyTax: true,
            department: { name: "Shitje" }
          },
        },
      ],
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
