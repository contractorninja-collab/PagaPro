"use server";

import { revalidatePath } from "next/cache";
import type { ReportOutputFormat, ReportType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { safeDeleteAsset } from "@/lib/company-asset-storage";
import { getCompanyContext, companyContextErrorMessage } from "@/server/company-context";
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

export async function previewReportAction(input: {
  reportType: ReportType;
  filtersJson: unknown;
}): Promise<ReportActionResult<{ columns: { key: string; headerSq: string }[]; rows: unknown[]; truncated: boolean }>> {
  const result = await getCompanyContext();
  if (!result.ok) return { ok: false, error: companyContextErrorMessage(result.reason) };
  const { companyId } = result.context;
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
  const result = await getCompanyContext();
  if (!result.ok) return { ok: false, error: companyContextErrorMessage(result.reason) };
  const { companyId, user } = result.context;

  const res = await generateStoredReport({
    companyId,
    reportType: input.reportType,
    filtersRaw: input.filtersJson,
    format: input.format,
    actorUserId: user.id,
    regenerate: false,
  });
  if (!res.ok) return { ok: false, error: res.error };
  safeRevalidate("/raportet");
  return { ok: true, data: { id: res.id } };
}

export async function regenerateReportAction(input: {
  previousReportId: string;
}): Promise<ReportActionResult<{ id: string }>> {
  const result = await getCompanyContext();
  if (!result.ok) return { ok: false, error: companyContextErrorMessage(result.reason) };
  const { companyId, user } = result.context;

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
    actorUserId: user.id,
    previousReportId: prev.id,
    regenerate: true,
  });
  if (!res.ok) return { ok: false, error: res.error };

  // Supersede the previous report: archive its row (audit trail kept) and reclaim its blob.
  await prisma.generatedReport.update({
    where: { id: prev.id },
    data: { isArchived: true, archivedAt: new Date() },
  });
  await safeDeleteAsset(prev.storageKey);
  await appendReportExportLog({
    companyId,
    generatedReportId: prev.id,
    action: "ARCHIVED",
    performedByUserId: user.id,
    metadataJson: { supersededById: res.id },
  });

  safeRevalidate("/raportet");
  safeRevalidate(`/raportet/${input.previousReportId}`);
  safeRevalidate(`/raportet/${res.id}`);
  return { ok: true, data: { id: res.id } };
}

export async function archiveReportAction(input: { id: string }): Promise<ReportActionResult> {
  const result = await getCompanyContext();
  if (!result.ok) return { ok: false, error: companyContextErrorMessage(result.reason) };
  const { companyId, user } = result.context;

  const existing = await prisma.generatedReport.findFirst({
    where: { id: input.id, companyId },
  });
  if (!existing) return { ok: false, error: "Raporti nuk u gjet." };
  if (existing.isArchived) return { ok: false, error: "Raporti është tashmë arkivuar." };

  await prisma.generatedReport.update({
    where: { id: existing.id },
    data: { isArchived: true, archivedAt: new Date() },
  });
  // Archived reports are retired — reclaim the blob (row + audit log stay for history).
  await safeDeleteAsset(existing.storageKey);

  await appendReportExportLog({
    companyId,
    generatedReportId: existing.id,
    action: "ARCHIVED",
    performedByUserId: user.id,
    metadataJson: {},
  });

  safeRevalidate("/raportet");
  safeRevalidate(`/raportet/${existing.id}`);
  return { ok: true };
}
