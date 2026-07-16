import ExcelJS from "exceljs";
import fs from "node:fs/promises";

import {
  ATK_HEADER_SCAN_MAX_ROW,
  ATK_TEMPLATE_SHEET_INDEX,
  resolveAtkTemplateAbsolutePath,
} from "@/modules/payroll/atk/helpers/template-metadata";
import { copyRowDimensionsAndStyle } from "@/modules/payroll/atk/helpers/workbook-clone";
import type { AtkColumnKey } from "@/modules/payroll/atk/mappers/payroll-entry-to-atk-row";

const MATCHERS: Record<AtkColumnKey, string[]> = {
  firstName: [],
  lastName: ["mbiemri"],
  personalId: ["numri individual"],
  grossSalary: ["bruto paga"],
  pensionEmployee: ["kontributi pensional i të punësuarit", "kontributi pensional i te punesuarit"],
  pensionEmployer: ["kontributi pensional i punëdhënësit", "kontributi pensional i punedhenesit"],
  pensionSupplementEmployee: ["kontributi suplementar i të punësuarit", "kontributi suplementar i te punesuarit"],
  pensionSupplementEmployer: ["kontributi suplementar i punëdhënësit", "kontributi suplementar i punedhenesit"],
  primaryWork: ["punë primare", "pune primare"],
  includeContributions: ["përfshihen kontributet", "perfshihen kontributet"],
  applyPayrollTax: ["aplikohet tatimi", "tatimi në paga", "tatimi ne paga"],
};

const ALL_KEYS = Object.keys(MATCHERS) as AtkColumnKey[];

export function cellPlainText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "richText" in value) {
    const rt = (value as { richText?: { text: string }[] }).richText;
    if (Array.isArray(rt)) return rt.map((t) => t.text).join("");
  }
  if (typeof value === "object" && value !== null && "text" in value) {
    return String((value as { text: string }).text);
  }
  return "";
}

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function normalizeHeader(raw: unknown): string {
  return stripDiacritics(cellPlainText(raw as ExcelJS.CellValue).trim().replace(/\s+/g, " ").toLowerCase());
}

function headerMatchesKey(headerNormalized: string, key: AtkColumnKey): boolean {
  if (key === "firstName") {
    return headerNormalized === "emri";
  }
  return MATCHERS[key].some((m) => headerNormalized.includes(stripDiacritics(m.toLowerCase())));
}

function keysMatchedInRow(row: ExcelJS.Row): Set<AtkColumnKey> {
  const hit = new Set<AtkColumnKey>();
  row.eachCell({ includeEmpty: false }, (cell) => {
    const h = normalizeHeader(cell.value);
    for (const key of ALL_KEYS) {
      if (hit.has(key)) continue;
      if (headerMatchesKey(h, key)) hit.add(key);
    }
  });
  return hit;
}

function scoreHeaderRow(row: ExcelJS.Row): number {
  return keysMatchedInRow(row).size;
}

function findHeaderRow(sheet: ExcelJS.Worksheet): number {
  let bestRow = 1;
  let bestScore = 0;
  const actualMax = sheet.actualRowCount ?? 1;
  const rowLimit = Math.min(Math.max(actualMax, 1), ATK_HEADER_SCAN_MAX_ROW);
  for (let r = 1; r <= rowLimit; r++) {
    const row = sheet.getRow(r);
    const sc = scoreHeaderRow(row);
    if (sc > bestScore) {
      bestScore = sc;
      bestRow = r;
    }
  }
  if (bestScore < 5) {
    throw new Error(
      "Shablloni ATK nuk u njoh: nuk u gjet rreshti i titujve (Emri, Mbiemri, Bruto paga…). Verifikoni Mostra Pagave ATK.xlsx në public/atk_template/.",
    );
  }
  return bestRow;
}

function buildColumnMap(headerRow: ExcelJS.Row): Record<AtkColumnKey, number> {
  const map = {} as Record<AtkColumnKey, number>;
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const h = normalizeHeader(cell.value);
    for (const key of ALL_KEYS) {
      if (map[key] !== undefined) continue;
      if (headerMatchesKey(h, key)) {
        map[key] = colNumber;
        break;
      }
    }
  });
  const missing = ALL_KEYS.filter((k) => map[k] == null);
  if (missing.length > 0) {
    throw new Error(`ATK: kolona mungojnë në tituj: ${missing.join(", ")}`);
  }
  return map;
}

function coerceCellValue(templateCell: ExcelJS.Cell, display: string): ExcelJS.CellValue {
  const prev = templateCell.value;
  const normalized = display.replace(/\s/g, "").replace(",", ".");
  const n = Number(normalized);
  if (typeof prev === "number") {
    return Number.isFinite(n) ? n : display;
  }
  if (prev != null && typeof prev === "object" && "formula" in prev) {
    return display;
  }
  return display;
}

function rowLooksLikeFooter(row: ExcelJS.Row): boolean {
  const a = cellPlainText(row.getCell(1)?.value ?? "").toLowerCase();
  return (
    a.includes("gjith") ||
    a.includes("total") ||
    a.includes("mbledh") ||
    a.includes("shuma") ||
    a.includes("grand")
  );
}

function writeRowValues(
  row: ExcelJS.Row,
  styleTemplateRow: ExcelJS.Row,
  cells: Record<AtkColumnKey, string>,
  colMap: Record<AtkColumnKey, number>,
): void {
  for (const key of ALL_KEYS) {
    const col = colMap[key];
    const tplCell = styleTemplateRow.getCell(col);
    const val = coerceCellValue(tplCell, cells[key]);
    row.getCell(col).value = val;
  }
}

/** Loads official `public/atk_template` workbook and writes employee rows without redesigning structure. */
export async function fillAtkOfficialTemplate(rows: Record<AtkColumnKey, string>[]): Promise<Buffer> {
  let buf: Buffer;
  try {
    buf = await fs.readFile(resolveAtkTemplateAbsolutePath());
  } catch {
    throw new Error(
      `Mungon shablloni zyrtar ATK në ${resolveAtkTemplateAbsolutePath()}. Vendosni Mostra Pagave ATK.xlsx në public/atk_template/.`,
    );
  }

  const workbook = new ExcelJS.Workbook();
  // exceljs typings expect legacy Node `Buffer` nominal subtype — runtime accepts Uint8Array.
  await workbook.xlsx.load(buf as never);

  const sheet =
    workbook.worksheets[ATK_TEMPLATE_SHEET_INDEX] ?? workbook.worksheets[0] ?? workbook.getWorksheet(1);
  if (!sheet) throw new Error("Shablloni ATK nuk përmban asnjë fletë.");

  const headerRowNum = findHeaderRow(sheet);
  const headerRow = sheet.getRow(headerRowNum);
  const colMap = buildColumnMap(headerRow);

  const dataStart = headerRowNum + 1;
  const styleTemplateRow = sheet.getRow(dataStart);

  const maxScanRow = Math.min(
    Math.max(sheet.actualRowCount ?? dataStart, dataStart + rows.length + 5),
    dataStart + Math.max(rows.length + 80, 250),
  );

  for (let i = 0; i < rows.length; i++) {
    const targetRowNum = dataStart + i;
    const targetRow = sheet.getRow(targetRowNum);
    if (i > 0) {
      copyRowDimensionsAndStyle(styleTemplateRow, targetRow);
    }
    const rowCells = rows[i];
    if (!rowCells) continue;
    writeRowValues(targetRow, styleTemplateRow, rowCells, colMap);
  }

  const clearFrom = dataStart + rows.length;
  for (let r = clearFrom; r <= maxScanRow; r++) {
    const row = sheet.getRow(r);
    if (rowLooksLikeFooter(row)) break;
    let anyMapped = false;
    for (const key of ALL_KEYS) {
      const col = colMap[key];
      const t = cellPlainText(row.getCell(col).value).trim();
      if (t.length > 0) anyMapped = true;
    }
    if (!anyMapped) continue;
    for (const key of ALL_KEYS) {
      row.getCell(colMap[key]).value = null;
    }
  }

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}
