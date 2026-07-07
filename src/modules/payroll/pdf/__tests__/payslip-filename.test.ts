import { describe, expect, it } from "vitest";
import { buildPayslipBundleFilename, buildPayslipFilename, sanitizeFilenamePart } from "../payslip-filename";

describe("payslip filenames", () => {
  it("builds employee_month_year filename", () => {
    expect(
      buildPayslipFilename({
        firstName: "Arines",
        lastName: "Ajeti",
        year: 2026,
        month: 6,
      }),
    ).toBe("Ajeti_Arines_Qershor_2026.pdf");
  });

  it("strips diacritics from filename parts", () => {
    expect(sanitizeFilenamePart("Gëzim")).toBe("Gezim");
  });

  it("builds bundle filename with optional prefix", () => {
    expect(buildPayslipBundleFilename(2026, 6, "PP")).toBe("PP_Fletepagesat_Qershor_2026.pdf");
  });
});
