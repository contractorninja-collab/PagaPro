import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { fillAtkOfficialTemplate } from "@/modules/payroll/atk/helpers/atk-workbook-fill";
import type { AtkColumnKey } from "@/modules/payroll/atk/mappers/payroll-entry-to-atk-row";

const headers = [
  "Emri",
  "Mbiemri",
  "Numri Individual i punëtorit",
  "Bruto paga për muaj",
  "Kontributi pensional i të punësuarit",
  "Kontributi pensional i punëdhënësit",
  "Kontributi suplementar i të punësuarit",
  "Kontributi suplementar i punëdhënësit",
  "Punë Primare",
  "Përfshihen Kontributet",
  "Aplikohet Tatimi në Paga",
] as const;

function atkRow(index: number): Record<AtkColumnKey, string> {
  return {
    firstName: `Emri-${index}`,
    lastName: `Mbiemri-${index}`,
    personalId: `00${index}1234567`,
    grossSalary: `${1000 + index}.25`,
    pensionEmployee: `${50 + index}.10`,
    pensionEmployer: `${50 + index}.15`,
    pensionSupplementEmployee: "0",
    pensionSupplementEmployer: "0",
    primaryWork: index % 2 === 0 ? "Jo" : "Po",
    includeContributions: index % 2 === 0 ? "Jo" : "Po",
    applyPayrollTax: "Po",
  };
}

async function loadGenerated(rows: Record<AtkColumnKey, string>[]): Promise<ExcelJS.Worksheet> {
  const buffer = await fillAtkOfficialTemplate(rows);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const sheet = workbook.getWorksheet("Lista ATK");
  if (!sheet) throw new Error("Lista ATK sheet missing from generated workbook");
  return sheet;
}

describe("fillAtkOfficialTemplate", () => {
  it("replaces every official sample field with payroll values and preserves value types", async () => {
    const sheet = await loadGenerated([atkRow(1), atkRow(2)]);

    expect(sheet.getRow(1).values).toEqual([undefined, ...headers]);
    expect(sheet.getRow(2).values).toEqual([
      undefined,
      "Emri-1",
      "Mbiemri-1",
      "0011234567",
      1001.25,
      51.1,
      51.15,
      0,
      0,
      "Po",
      "Po",
      "Po",
    ]);
    expect(sheet.getRow(3).values).toEqual([
      undefined,
      "Emri-2",
      "Mbiemri-2",
      "0021234567",
      1002.25,
      52.1,
      52.15,
      0,
      0,
      "Jo",
      "Jo",
      "Po",
    ]);

    for (let column = 1; column <= headers.length; column += 1) {
      expect(sheet.getCell(4, column).value).toBeNull();
    }
  });

  it("extends the official data band for payrolls longer than the sample list", async () => {
    const rows = Array.from({ length: 6 }, (_, index) => atkRow(index + 1));
    const sheet = await loadGenerated(rows);

    expect(sheet.getCell("A7").value).toBe("Emri-6");
    expect(sheet.getCell("D7").value).toBe(1006.25);
    expect(sheet.getCell("K7").value).toBe("Po");
  });

  it("never leaves official sample employees in an empty generated workbook", async () => {
    const sheet = await loadGenerated([]);

    for (let row = 2; row <= 4; row += 1) {
      for (let column = 1; column <= headers.length; column += 1) {
        expect(sheet.getCell(row, column).value).toBeNull();
      }
    }
  });
});
