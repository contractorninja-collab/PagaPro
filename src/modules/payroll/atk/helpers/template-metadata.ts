import path from "node:path";

/**
 * Official ATK template supplied by the product owner and stored as
 * `public/atk_template/Mostra Pagave ATK.xlsx`.
 *
 * ## Template inventory (for auditors / QA)
 *
 * - **Loader:** binary XLSX from disk (`ExcelJS`); sheet index {@link ATK_TEMPLATE_SHEET_INDEX}.
 * - **Header row:** detected automatically by scanning the first {@link ATK_HEADER_SCAN_MAX_ROW} rows and
 *   scoring Albanian header fragments (see `atk-workbook-fill.ts` `MATCHERS` / `headerMatchesKey`).
 * - **Data rows:** official sample rows are replaced from the first row immediately under the detected header;
 *   styles are cloned from that template row for additional employees.
 * - **Columns populated** (matched by header text, not fixed column letters):
 *   | Concept | Header cues (normalized, substring match unless noted) |
 *   |---------|--------------------------------------------------------|
 *   | Emri | exactly `emri` |
 *   | Mbiemri | `mbiemri` |
 *   | Numri Individual i punëtorit | `numri individual` |
 *   | Bruto paga për muaj | `bruto paga` |
 *   | Kontributi pensional i të punësuarit | `kontributi pensional` + `punësuarit` / ASCII variant |
 *   | Kontributi pensional i punëdhënësit | `kontributi pensional` + `punëdhënësit` / ASCII variant |
 *   | Kontributi suplementar (employee / employer) | `kontributi suplementar` + employee/employer cues |
 *   | Punë Primare | `punë primare` / `pune primare` |
 *   | Përfshihen Kontributet | `përfshihen kontributet` / ASCII variant |
 *   | Aplikohet Tatimi në Paga | `aplikohet tatimi` / `tatimi në paga` |
 * - **Boolean cells:** filled as `Po` / `Jo` per mapper (`payroll-entry-to-atk-row.ts`).
 * - **Supplementary pension columns:** always `0` for included employees.
 *
 * Golden check: open generated file beside the official template — sheet order, merges, and footer formulas
 * unchanged except for cleared sample rows in the data band.
 */
export const ATK_TEMPLATE_FILENAME = "Mostra Pagave ATK.xlsx";

/** Prefer first worksheet unless headers are only on another sheet (future override). */
export const ATK_TEMPLATE_SHEET_INDEX = 0;

/** Maximum rows scanned when locating the header band. */
export const ATK_HEADER_SCAN_MAX_ROW = 120;

export function resolveAtkTemplateAbsolutePath(): string {
  return path.join(process.cwd(), "public", "atk_template", ATK_TEMPLATE_FILENAME);
}
