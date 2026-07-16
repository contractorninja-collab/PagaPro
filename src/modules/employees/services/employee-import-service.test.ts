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
  });

  it("parses both date and salary formats", () => {
    const rows = parseEmployeeImportCsv(Buffer.from(
      "Emri,Mbiemri,Nr personal,Data e lindjes,Data e punësimit,Paga bruto,Banka,IBAN\n" +
      'Arta,Krasniqi,123,1992-04-10,01.07.2024,"1.250,50",Banka Test,DE89370400440532013000',
    ));
    expect(rows[0]).toMatchObject({
      dateOfBirthIso: "1992-04-10",
      hireDateIso: "2024-07-01",
      baseSalaryMonthly: "1250.50",
      intendedStatus: "ACTIVE",
      errors: [],
    });
  });

  it("allows optional profile fields and keeps zero-salary rows inactive", () => {
    const rows = parseEmployeeImportCsv(Buffer.from(
      "Emri,Mbiemri,Nr personal,Data e punësimit\nBlerim,Berisha,456,2025-02-01",
    ));
    expect(rows[0]).toMatchObject({ baseSalaryMonthly: "0.00", intendedStatus: "INACTIVE", errors: [] });
  });

  it("marks duplicate personal numbers and malformed optional values", () => {
    const rows = parseEmployeeImportCsv(Buffer.from(
      "Emri,Mbiemri,Nr personal,Data e lindjes,Data e punësimit,Paga bruto,IBAN\n" +
      "A,B,777,not-a-date,2025-02-01,abc,nope\nC,D,777,,2025-03-01,,",
    ));
    expect(rows[0]?.errors.join(" ")).toContain("Data e lindjes");
    expect(rows[0]?.errors.join(" ")).toContain("Paga bruto");
    expect(rows[0]?.errors.join(" ")).toContain("IBAN");
    expect(rows.every((row) => row.errors.some((error) => error.includes("përsëritet")))).toBe(true);
  });
});
