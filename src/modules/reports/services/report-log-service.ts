import type { Prisma, ReportExportAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function appendReportExportLog(params: {
  companyId: string;
  generatedReportId: string;
  action: ReportExportAction;
  performedByUserId?: string | null;
  metadataJson?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.reportExportLog.create({
    data: {
      companyId: params.companyId,
      generatedReportId: params.generatedReportId,
      action: params.action,
      performedByUserId: params.performedByUserId ?? undefined,
      metadataJson: params.metadataJson ?? undefined,
    },
  });
}
