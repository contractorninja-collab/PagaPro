import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildVertetimTatimorPdf } from "../vertetim-tatimor-pdf-builder";
import type { EmployeeAnnualStatement } from "@/modules/payroll/services/employee-annual-statement-service";
import { extractPdfText } from "./pdf-text-probe";

const statement: EmployeeAnnualStatement = {
  year: 2026,
  employee: {
    id: "e1",
    firstName: "Gëzim",
    lastName: "Çelaj",
    personalId: "1004921883",
    jobTitle: "Inxhinier ndërtimi",
  },
  company: {
    legalName: "Ndërtimi Alba SH.P.K.",
    tradeName: null,
    fiscalNumber: "600123456",
    addressLine: "Rr. Rexhep Luci 14",
    city: "Prishtinë",
  },
  months: [
    {
      month: 7,
      gross: "927.80",
      taxableIncome: "881.41",
      pit: "59.28",
      pensionEmployee: "46.39",
      pensionEmployer: "46.39",
      net: "772.13",
    },
    {
      month: 8,
      gross: "927.80",
      taxableIncome: "881.41",
      pit: "59.28",
      pensionEmployee: "46.39",
      pensionEmployer: "46.39",
      net: "772.13",
    },
  ],
  totals: {
    gross: "1855.60",
    taxableIncome: "1762.82",
    pit: "118.56",
    pensionEmployee: "92.78",
    pensionEmployer: "92.78",
    net: "1544.26",
  },
};

describe("vertetim tatimor PDF", () => {
  it("is a one-page A4 PDF", async () => {
    const buf = await buildVertetimTatimorPdf(statement, "22.08.2026, 21:00");
    const pdf = await PDFDocument.load(buf);
    expect(pdf.getPageCount()).toBe(1);
    expect(Math.round(pdf.getPage(0).getSize().width)).toBe(595);
  });

  it("carries the identity, the year, and the withheld totals", async () => {
    const buf = await buildVertetimTatimorPdf(statement, "22.08.2026, 21:00");
    const text = await extractPdfText(buf);

    expect(text).toContain("VËRTETIM");
    expect(text).toContain("2026");
    expect(text).toContain("Gëzim Çelaj");
    expect(text).toContain("1004921883");
    // The certificate's whole point: the annual withheld figures.
    expect(text).toContain("118.56"); // PIT
    expect(text).toContain("92.78"); // pension
    expect(text).toContain("1855.60"); // gross
    // Months present, Albanian letters intact.
    expect(text).toContain("Korrik");
    expect(text).toContain("Gusht");
  });
});
