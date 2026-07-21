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

  it("keeps the former IBAN header compatible with existing CSV files", () => {
    const rows = parseEmployeeImportCsv(Buffer.from(
      "Emri,Mbiemri,Nr personal,Data e punësimit,IBAN\n" +
      "Arta,Krasniqi,124,2024-07-01,XK051212012345678906",
    ));

    expect(rows[0]).toMatchObject({ iban: "XK051212012345678906", errors: [] });
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
