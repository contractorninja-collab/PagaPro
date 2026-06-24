"use server";

import { revalidatePath } from "next/cache";
import type { ReportOutputFormat, ReportType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveActiveCompanyId } from "@/server/company-scope";
import { previewReportInput, generateStoredReport } from "@/modules/reports/services/report-generation-service";
import { appendReportExportLog } from "@/modules/reports/services/report-log-service";

export type ReportActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function safeRevalidate(path: string): void {
  try {
    revalidatePath(path);
  } catch {
    /* noop */
  }
}

async function requireCompanyId(): Promise<string | null> {
  return resolveActiveCompanyId();
}

export async function previewReportAction(input: {
  reportType: ReportType;
  filtersJson: unknown;
}): Promise<ReportActionResult<{ columns: { key: string; headerSq: string }[]; rows: unknown[]; truncated: boolean }>> {
  const companyId = await requireCompanyId();
  if (!companyId) return { ok: false, error: "Sesioni nuk përfshin kompani aktiv." };
  try {
    const res = await previewReportInput({
      companyId,
      reportType: input.reportType,
      filtersRaw: input.filtersJson,
    });
    return {
      ok: true,
      data: {
        columns: res.columns,
        rows: res.rows as unknown[],
        truncated: res.truncated,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gabim në paraafishim." };
  }
}

export async function generateReportAction(input: {
  reportType: ReportType;
  filtersJson: unknown;
  format: ReportOutputFormat;
}): Promise<ReportActionResult<{ id: string }>> {
  const companyId = await requireCompanyId();
  if (!companyId) return { ok: false, error: "Sesioni nuk përfshin kompani aktiv." };

  const res = await generateStoredReport({
    companyId,
    reportType: input.reportType,
    filtersRaw: input.filtersJson,
    format: input.format,
    actorUserId: null,
    regenerate: false,
  });
  if (!res.ok) return { ok: false, error: res.error };
  safeRevalidate("/raportet");
  return { ok: true, data: { id: res.id } };
}

export async function regenerateReportAction(input: {
  previousReportId: string;
}): Promise<ReportActionResult<{ id: string }>> {
  const companyId = await requireCompanyId();
  if (!companyId) return { ok: false, error: "Sesioni nuk përfshin kompani aktiv." };

  const prev = await prisma.generatedReport.findFirst({
    where: { id: input.previousReportId, companyId },
  });
  if (!prev) return { ok: false, error: "Raporti nuk u gjet." };
  if (prev.isArchived) return { ok: false, error: "Raporti arkivuar nuk mund të rigjenerohet." };

  const res = await generateStoredReport({
    companyId,
    reportType: prev.reportType,
    filtersRaw: prev.filtersJson,
    format: prev.fileFormat,
    actorUserId: null,
    previousReportId: prev.id,
    regenerate: true,
  });
  if (!res.ok) return { ok: false, error: res.error };
  safeRevalidate("/raportet");
  safeRevalidate(`/raportet/${input.previousReportId}`);
  safeRevalidate(`/raportet/${res.id}`);
  return { ok: true, data: { id: res.id } };
}

export async function archiveReportAction(input: { id: string }): Promise<ReportActionResult> {
  const companyId = await requireCompanyId();
  if (!companyId) return { ok: false, error: "Sesioni nuk përfshin kompani aktiv." };

  const existing = await prisma.generatedReport.findFirst({
    where: { id: input.id, companyId },
  });
  if (!existing) return { ok: false, error: "Raporti nuk u gjet." };
  if (existing.isArchived) return { ok: false, error: "Raporti është tashmë arkivuar." };

  await prisma.generatedReport.update({
    where: { id: existing.id },
    data: { isArchived: true, archivedAt: new Date() },
  });

  await appendReportExportLog({
    companyId,
    generatedReportId: existing.id,
    action: "ARCHIVED",
    performedByUserId: null,
    metadataJson: {},
  });

  safeRevalidate("/raportet");
  safeRevalidate(`/raportet/${existing.id}`);
  return { ok: true };
}
