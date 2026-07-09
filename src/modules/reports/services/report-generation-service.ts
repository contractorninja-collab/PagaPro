import type { ReportOutputFormat, ReportType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage, safeDeleteAsset } from "@/lib/company-asset-storage";
import { assertCompanyScopedStorageKey } from "@/server/company-scope";
import { generatedReportStorageKey, type ReportFileExt } from "@/modules/reports/helpers/storage-keys";
import { rowsToXlsxBuffer, financePayrollWorkbookBuffer } from "@/modules/reports/exporters/excel-export";
import { rowsToCsvBuffer } from "@/modules/reports/exporters/csv-export";
import { rowsToPdfTableBuffer } from "@/modules/reports/exporters/pdf-table-export";
import type { ReportColumnDef, ReportFetcherContext, ReportRow } from "@/modules/reports/types";
import {
  fetchRowsForReport,
  parseReportFilters,
  titleForType,
} from "@/modules/reports/services/report-registry";
import { fetchFinanceWorkbookData } from "@/modules/reports/services/report-data-fetchers";
import { resolvePayrollPeriodRows } from "@/modules/reports/services/payroll-report-source";
import { appendReportExportLog } from "@/modules/reports/services/report-log-service";
import { generatePayrollAtkExport } from "@/modules/payroll/atk/services/atk-payroll-export-service";
import type { PayrollPeriodFilters } from "@/modules/reports/validators/report-schemas";
import type { TerminationMonthFilters } from "@/modules/reports/validators/report-schemas";

export const PREVIEW_ROW_CAP = 350;

export function projectRowsForExport(columns: ReportColumnDef[], rows: ReportRow[]): ReportRow[] {
  const keys = new Set(columns.map((c) => c.key));
  return rows.map((r) => {
    const out: ReportRow = {};
    for (const k of keys) out[k] = r[k] ?? null;
    return out;
  });
}

export async function previewReportInput(params: {
  companyId: string;
  reportType: ReportType;
  filtersRaw: unknown;
}): Promise<{ columns: ReportColumnDef[]; rows: ReportRow[]; truncated: boolean }> {
  const ctx: ReportFetcherContext = { companyId: params.companyId };
  const filters = parseReportFilters(params.reportType, params.filtersRaw);
  const result = await fetchRowsForReport(params.reportType, ctx, filters);
  const projected = projectRowsForExport(result.columns, result.rows);
  const truncated = projected.length > PREVIEW_ROW_CAP;
  return {
    columns: result.columns,
    rows: projected.slice(0, PREVIEW_ROW_CAP),
    truncated,
  };
}

function extensionForFormat(fmt: ReportOutputFormat): ReportFileExt {
  switch (fmt) {
    case "XLSX":
      return "xlsx";
    case "PDF":
      return "pdf";
    case "CSV":
      return "csv";
    default: {
      const _: never = fmt;
      void _;
      return "csv";
    }
  }
}

function contentTypeForFormat(fmt: ReportOutputFormat): string {
  switch (fmt) {
    case "XLSX":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "PDF":
      return "application/pdf";
    case "CSV":
      return "text/csv; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function denormalizedFilters(type: ReportType, filters: unknown) {
  if (!filters || typeof filters !== "object") return {};
  const f = filters as Record<string, unknown>;
  const out: {
    filterPayrollId?: string | null;
    filterYear?: number | null;
    filterMonth?: number | null;
    filterDepartmentId?: string | null;
    filterEmployeeId?: string | null;
  } = {};

  if (typeof f.payrollId === "string") out.filterPayrollId = f.payrollId;
  if (typeof f.year === "number") out.filterYear = f.year;
  if (typeof f.month === "number") out.filterMonth = f.month;
  if (typeof f.departmentId === "string") out.filterDepartmentId = f.departmentId;
  if (typeof f.employeeId === "string") out.filterEmployeeId = f.employeeId;

  if (type === "LARGIMET_SIPAS_MUAJIT") {
    const tm = filters as TerminationMonthFilters;
    out.filterYear = tm.year;
    out.filterMonth = tm.month;
  }

  return out;
}

async function buildFileBuffer(params: {
  companyId: string;
  reportType: ReportType;
  filters: unknown;
  format: ReportOutputFormat;
  actorUserId?: string | null;
}): Promise<{ buffer: Buffer; columns: ReportColumnDef[]; rows: ReportRow[] }> {
  const ctx: ReportFetcherContext = { companyId: params.companyId };
  const { reportType, format } = params;

  if (reportType === "ATK_EXPORT_WORKBOOK" && format === "XLSX") {
    const pf = params.filters as PayrollPeriodFilters;
    const atk = await generatePayrollAtkExport({
      companyId: params.companyId,
      payrollId: pf.payrollId,
      actorUserId: params.actorUserId ?? null,
    });
    if (!atk.ok) throw new Error(atk.error);
    const row = await prisma.payrollATKExport.findFirst({
      where: { id: atk.exportId, companyId: params.companyId },
    });
    if (!row) throw new Error("Eksporti ATK nuk u gjet pas gjenerimit.");
    const buf = await getCompanyAssetStorage().get(row.storageKey);
    const preview = await fetchRowsForReport(reportType, ctx, pf);
    return { buffer: buf, columns: preview.columns, rows: preview.rows };
  }

  if (reportType === "FINANCE_PAYROLL_WORKBOOK" && format === "XLSX") {
    const pf = params.filters as PayrollPeriodFilters;
    const fd = await fetchFinanceWorkbookData(ctx, pf);
    const buffer = await financePayrollWorkbookBuffer({
      summaryColumns: fd.summary.columns,
      summaryRows: projectRowsForExport(fd.summary.columns, fd.summary.rows),
      detailColumns: fd.detail.columns,
      detailRows: projectRowsForExport(fd.detail.columns, fd.detail.rows),
    });
    return { buffer, columns: fd.summary.columns, rows: fd.summary.rows };
  }

  const full = await fetchRowsForReport(reportType, ctx, params.filters);
  const columns = full.columns;
  const rows = projectRowsForExport(columns, full.rows);

  let subtitle: string | undefined;
  try {
    const pf = params.filters as PayrollPeriodFilters;
    if (pf.payrollId) {
      const meta = await resolvePayrollPeriodRows(params.companyId, pf.payrollId);
      subtitle = `${meta.payrollYear}-${String(meta.payrollMonth).padStart(2, "0")} (${meta.currency})`;
    }
  } catch {
    subtitle = undefined;
  }

  const title = titleForType(reportType);

  if (format === "XLSX") {
    const buffer = await rowsToXlsxBuffer({
      sheetName: title.slice(0, 28),
      columns,
      rows,
    });
    return { buffer, columns, rows };
  }

  if (format === "CSV") {
    return { buffer: rowsToCsvBuffer(columns, rows), columns, rows };
  }

  if (format === "PDF") {
    const buffer = await rowsToPdfTableBuffer({
      title,
      subtitle,
      columns,
      rows,
    });
    return { buffer, columns, rows };
  }

  throw new Error("Formati nuk mbështetet.");
}

export async function generateStoredReport(params: {
  companyId: string;
  reportType: ReportType;
  filtersRaw: unknown;
  format: ReportOutputFormat;
  actorUserId?: string | null;
  previousReportId?: string | null;
  regenerate?: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const filters = parseReportFilters(params.reportType, params.filtersRaw);
    const reportId = randomUUID();
    const ext = extensionForFormat(params.format);
    const storageKey = generatedReportStorageKey({
      companyId: params.companyId,
      reportId,
      ext,
    });

    const { buffer, rows } = await buildFileBuffer({
      companyId: params.companyId,
      reportType: params.reportType,
      filters,
      format: params.format,
      actorUserId: params.actorUserId ?? null,
    });

    assertCompanyScopedStorageKey(params.companyId, storageKey);

    await getCompanyAssetStorage().put(storageKey, buffer, {
      contentType: contentTypeForFormat(params.format),
    });

    const filtersJson = JSON.parse(JSON.stringify(filters)) as object;
    const denorm = denormalizedFilters(params.reportType, filters);

    try {
      await prisma.generatedReport.create({
        data: {
          id: reportId,
          companyId: params.companyId,
          reportType: params.reportType,
          title: titleForType(params.reportType),
          storageKey,
          generatedFileUrl: `/api/reports/files/${reportId}`,
          fileFormat: params.format,
          filtersJson,
          generatedByUserId: params.actorUserId ?? undefined,
          rowCount: rows.length,
          previewTruncated: rows.length > PREVIEW_ROW_CAP,
          ...denorm,
        },
      });
    } catch (err) {
      // Row insert failed after the blob was written — reclaim the orphaned blob.
      await safeDeleteAsset(storageKey);
      throw err;
    }

    await appendReportExportLog({
      companyId: params.companyId,
      generatedReportId: reportId,
      action: params.regenerate ? "REGENERATED" : "GENERATED",
      performedByUserId: params.actorUserId ?? null,
      metadataJson: {
        previousReportId: params.previousReportId ?? undefined,
        filters: filtersJson,
      },
    });

    return { ok: true, id: reportId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg || "Gjenerimi dështoi." };
  }
}
