import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildBankPaymentSheet, type BankPaymentEntryInput } from "./bank-payment-rows";
import { generateBankListWorkbookBuffer } from "./branded-bank-list-export";

function entry(over: Partial<BankPaymentEntryInput> = {}): BankPaymentEntryInput {
  return {
    firstName: "Arben",
    lastName: "Gashi",
    netPay: "845.50",
    bank: { iban: "1212012345678906", source: "PRIMARY_ACTIVE" },
    ...over,
  };
}

async function build(entries: BankPaymentEntryInput[], periodNetTotal?: string) {
  const sheet = buildBankPaymentSheet(entries);
  const buf = await generateBankListWorkbookBuffer({
    sheet,
    companyLabel: "DEMO USER",
    periodLabel: "Gusht 2026",
    statusLabel: "I kyçur",
    periodNetTotal: periodNetTotal ?? sheet.grandTotal,
    currency: "EUR",
    generatedAtLabel: "22.08.2026 14:03",
    downloadedByLabel: "Arines Ajeti",
    logo: null,
  });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return { wb, ws: wb.worksheets[0]!, sheet, buf };
}

/** Finds the row whose merged label column starts with the given text. */
function findLabelRow(ws: ExcelJS.Worksheet, label: string): number {
  for (let r = 1; r <= ws.rowCount; r++) {
    const v = ws.getCell(`A${r}`).value;
    if (typeof v === "string" && v.startsWith(label)) return r;
  }
  throw new Error(`row not found: ${label}`);
}

describe("generateBankListWorkbookBuffer — the account column", () => {
  it("writes the account number as TEXT, not as a number", async () => {
    // The single most important assertion here. As a number, Excel keeps 15
    // significant digits and a 16-digit account silently loses its last one.
    const { ws } = await build([entry()]);
    const cell = ws.getCell("D8");

    expect(typeof cell.value).toBe("string");
    expect(cell.value).toBe("1212012345678906");
    expect(cell.numFmt).toBe("@");
  });

  it("keeps all sixteen digits intact", async () => {
    const { ws } = await build([
      entry({ bank: { iban: "1999999999999999", source: "PRIMARY_ACTIVE" } }),
    ]);

    expect(String(ws.getCell("D8").value)).toHaveLength(16);
    expect(ws.getCell("D8").value).toBe("1999999999999999");
  });

  it("puts a marker, never ***, in the account cell of an unreadable row", async () => {
    const { ws } = await build([
      entry({ bank: { iban: "***", source: "PRIMARY_ACTIVE" } }),
    ]);

    const blockedHead = findLabelRow(ws, "NUK PAGUHEN");
    const accountCell = ws.getCell(`D${blockedHead + 1}`);
    expect(accountCell.value).toBe("E PALEXUESHME");
    expect(String(accountCell.value)).not.toContain("*");
  });
});

describe("generateBankListWorkbookBuffer — headers and layout", () => {
  it("labels the four requested columns", async () => {
    const { ws } = await build([entry()]);

    expect(ws.getCell("B7").value).toBe("Emri");
    expect(ws.getCell("C7").value).toBe("Mbiemri");
    expect(ws.getCell("D7").value).toBe("Llogaria Bankare");
    expect(String(ws.getCell("E7").value)).toContain("Paga Neto");
  });

  it("carries the company, period and downloader for a printed copy", async () => {
    const { ws } = await build([entry()]);

    expect(ws.getCell("A2").value).toBe("Lista e pagave për ekzekutim");
    expect(ws.getCell("B3").value).toBe("DEMO USER");
    expect(ws.getCell("B4").value).toBe("Gusht 2026");
    expect(ws.getCell("B5").value).toBe("Arines Ajeti");
  });

  it("shows no warning banner when everyone can be paid", async () => {
    const { ws } = await build([entry(), entry({ firstName: "Elira" })]);

    expect(ws.getCell("A6").value).toBeNull();
    // ...and no blocked block at all.
    expect(() => findLabelRow(ws, "NUK PAGUHEN")).toThrow();
  });

  it("warns with the exact count when someone cannot be paid", async () => {
    const { ws } = await build([
      entry(),
      entry({ firstName: "Elira", bank: { iban: null, source: "NONE" } }),
      entry({ firstName: "Driton", bank: { iban: "213215123456", source: "PRIMARY_ACTIVE" } }),
    ]);

    expect(String(ws.getCell("A6").value)).toContain("2 punonjës nuk mund të paguhen");
  });

  it("does not count a zero-net employee in the warning", async () => {
    const { ws } = await build([entry(), entry({ firstName: "Elira", netPay: "0.00" })]);

    // They appear in the sheet, but they are not an alarm.
    expect(ws.getCell("A6").value).toBeNull();
    expect(() => findLabelRow(ws, "NUK PAGUHEN")).not.toThrow();
  });
});

describe("generateBankListWorkbookBuffer — totals", () => {
  it("sums exactly the payable rows", async () => {
    const { ws } = await build([entry(), entry({ firstName: "Elira" }), entry({ firstName: "Driton" })]);
    const row = findLabelRow(ws, "TOTALI PËR PAGESË");

    // Pins the range arithmetic — the most bug-prone part of any sheet layout.
    expect(ws.getCell(`E${row}`).value).toMatchObject({ formula: "SUM(E8:E10)" });
  });

  it("checks paid + unpaid against the period total from the database", async () => {
    const { ws } = await build([
      entry(),
      entry({ firstName: "Elira", bank: { iban: null, source: "NONE" } }),
    ]);
    const row = findLabelRow(ws, "KONTROLL");
    const formula = (ws.getCell(`E${row}`).value as { formula: string }).formula;

    expect(formula).toContain("ROUND(");
    expect(formula).toContain(",2)");
  });

  it("carries the independent period total as a literal, not a formula", async () => {
    // It must not be derived from the rows, or it could never disagree.
    const { ws } = await build([entry()], "999.99");
    const row = findLabelRow(ws, "TOTALI NETO I PERIUDHËS");

    expect(ws.getCell(`E${row}`).value).toBe(999.99);
  });

  it("produces a file for a period where nobody can be paid", async () => {
    const { ws, buf } = await build([
      entry({ bank: { iban: null, source: "NONE" } }),
    ]);

    expect(buf.length).toBeGreaterThan(0);
    expect(ws.getCell(`E${findLabelRow(ws, "TOTALI PËR PAGESË")}`).value).toBe(0);
  });

  it("produces a file for an empty period", async () => {
    const { buf } = await build([]);
    expect(buf.length).toBeGreaterThan(0);
  });
});
