/**
 * The tabular shape the surviving exporters speak.
 *
 * What used to live here — a `ReportCategory` union and a `categoryForReportType`
 * switch over 30 `ReportType` values — described the deleted report catalogue.
 * The two exports below are all the payroll financial export and the Libri i
 * Pagave builders ever needed.
 */

export type ReportColumnDef = { key: string; headerSq: string };

export type ReportRow = Record<string, string | number | boolean | null>;
