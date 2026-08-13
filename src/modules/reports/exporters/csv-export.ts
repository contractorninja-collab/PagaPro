import type { ReportColumnDef, ReportRow } from "@/modules/reports/types";

function escapeCsvCell(v: string | number | boolean | null): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsvBuffer(columns: ReportColumnDef[], rows: ReportRow[]): Buffer {
  const header = columns.map((c) => escapeCsvCell(c.headerSq)).join(",");
  const lines = [header];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvCell(row[c.key] ?? null)).join(","));
  }
  /**
   * BOM first: Excel on Windows reads a BOM-less UTF-8 CSV as the system
   * codepage, which turns every ë and ç — most Albanian names carry one — into
   * mojibake on double-click. Every consumer of this function serves files whose
   * headers alone (Punonjësi, Ditë pune…) already need it. Written as an escape
   * so no editor or formatter can strip the invisible character silently.
   */
  return Buffer.from("\uFEFF" + lines.join("\r\n"), "utf8");
}
