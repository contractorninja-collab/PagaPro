import { describe, expect, it } from "vitest";
import {
  employeeImportTemplateBuffer,
  parseEmployeeImportCsv,
} from "@/modules/employees/services/employee-import-service";

describe("employee CSV import", () => {
  it("generates the Albanian UTF-8 template", () => {
    const value = employeeImportTemplateBuffer().toString("utf8");
    expect(value.startsWith("\uFEFFEmri,Mbiemri,Nr personal")).toBe(true);
    expect(value).toContain("Data e punësimit");
    expect(value).toContain("Numri i llogarisë");
    expect(value).not.toContain("IBAN");
  });

  it("parses date and salary formats with an ordinary bank account number", () => {
    const rows = parseEmployeeImportCsv(Buffer.from(
      "Emri,Mbiemri,Nr personal,Data e lindjes,Data e punësimit,Paga bruto,Banka,Numri i llogarisë\n" +
      'Arta,Krasniqi,123,1992-04-10,01.07.2024,"1.250,50",Banka Test,1234 5678 9012 3456',
    ));
    expect(rows[0]).toMatchObject({
      dateOfBirthIso: "1992-04-10",
      hireDateIso: "2024-07-01",
      baseSalaryMonthly: "1250.50",
      iban: "1234567890123456",
      intendedStatus: "ACTIVE",
      errors: [],
    });
  });

  it("maps the bank column onto the licensed list, and keeps what it cannot place", () => {
    const rows = parseEmployeeImportCsv(Buffer.from(
      "Emri,Mbiemri,Nr personal,Data e punësimit,Banka\n" +
      "Arta,Krasniqi,201,2024-07-01,RBKO\n" +
      "Blerim,Gashi,202,2024-07-01,pcb\n" +
      "Drita,Hoxha,203,2024-07-01,BANKA KOMBËTARE TREGTARE KOSOVË SH.A.\n" +
      "Endrit,Berisha,204,2024-07-01,Banka e Kursimeve\n" +
      "Fatime,Zeqiri,205,2024-07-01,",
    ));

    expect(rows.map((r) => r.bankName)).toEqual([
      "Raiffeisen",
      "ProCredit",
      "BKT",
      "Banka e Kursimeve", // unknown, kept verbatim rather than dropped
      null,
    ]);
    expect(rows.every((r) => r.errors.length === 0)).toBe(true);
  });

  it("keeps the former IBAN header compatible, and stores the account number behind it", () => {
    const rows = parseEmployeeImportCsv(Buffer.from(
      "Emri,Mbiemri,Nr personal,Data e punësimit,IBAN\n" +
      "Arta,Krasniqi,124,2024-07-01,XK051212012345678906",
    ));

    // The IBAN is accepted — client spreadsheets are full of them — but what
    // lands in the register is the sixteen digits, the same form the employee
    // form enforces. Same digits, prefix removed.
    expect(rows[0]).toMatchObject({ iban: "1212012345678906", errors: [] });
  });

  it("refuses account numbers the employee form would refuse", () => {
    const rows = parseEmployeeImportCsv(Buffer.from(
      "Emri,Mbiemri,Nr personal,Data e punësimit,Numri i llogarisë\n" +
      "A,Aliu,301,2024-07-01,123456789012\n" +          // twelve digits — the real production defect
      "B,Bytyqi,302,2024-07-01,12345678901234567\n" +   // one too many
      "C,Curri,303,2024-07-01,XK0512120123456789067\n" + // mistyped Kosovo IBAN
      "D,Dema,304,2024-07-01,1234-5678-9012-3456\n" +   // separators, still sixteen digits
      "E,Elshani,305,2024-07-01,",                      // blank stays allowed
    ));

    expect(rows.map((r) => r.errors.length > 0)).toEqual([true, true, true, false, false]);
    for (const row of rows.slice(0, 3)) {
      expect(row.errors.join(" ")).toContain("16 shifra");
    }
    expect(rows[3]?.iban).toBe("1234567890123456");
    expect(rows[4]?.iban).toBeNull();
  });

  it("allows optional profile fields and keeps zero-salary rows inactive", () => {
    const rows = parseEmployeeImportCsv(Buffer.from(
      "Emri,Mbiemri,Nr personal,Data e punësimit\nBlerim,Berisha,456,2025-02-01",
    ));
    expect(rows[0]).toMatchObject({ baseSalaryMonthly: "0.00", intendedStatus: "INACTIVE", errors: [] });
  });

  it("marks duplicate personal numbers and malformed optional values", () => {
    const rows = parseEmployeeImportCsv(Buffer.from(
      "Emri,Mbiemri,Nr personal,Data e lindjes,Data e punësimit,Paga bruto,Numri i llogarisë\n" +
      "A,B,777,not-a-date,2025-02-01,abc,@@\nC,D,777,,2025-03-01,,",
    ));
    expect(rows[0]?.errors.join(" ")).toContain("Data e lindjes");
    expect(rows[0]?.errors.join(" ")).toContain("Paga bruto");
    expect(rows[0]?.errors.join(" ")).toContain("Numri i llogarisë");
    expect(rows.every((row) => row.errors.some((error) => error.includes("përsëritet")))).toBe(true);
  });
});
