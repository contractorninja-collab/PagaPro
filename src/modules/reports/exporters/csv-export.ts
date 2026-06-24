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
  return Buffer.from(lines.join("\r\n"), "utf8");
}
