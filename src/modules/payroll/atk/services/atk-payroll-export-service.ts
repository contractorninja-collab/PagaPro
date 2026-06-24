import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { payrollMonthLabel } from "@/modules/payroll/helpers/month-label";
import { decimalToPlain } from "@/modules/payroll/helpers/money-format";
import { ATK_TEMPLATE_FILENAME } from "@/modules/payroll/atk/helpers/template-metadata";
import { payrollAtkExportXlsxKey } from "@/modules/payroll/atk/helpers/atk-storage-keys";
import { fillAtkOfficialTemplate } from "@/modules/payroll/atk/helpers/atk-workbook-fill";
import {
  atkSnapshotCanonicalParts,
  filterAtkEligibleRows,
  mapSourceToAtkCellStrings,
  type AtkRowSource,
} from "@/modules/payroll/atk/mappers/payroll-entry-to-atk-row";
import { PAYROLL_TIMELINE } from "@/modules/payroll/constants/timeline";
import { appendPayrollAuditLog, appendPayrollDomainActivity } from "@/modules/payroll/services/payroll-audit-service";

function atkSnapshotHash(payrollId: string, payrollStatus: string, rows: AtkRowSource[]): string {
  const payload = atkSnapshotCanonicalParts(payrollId, payrollStatus, rows);
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

function atkFilename(year: number, month: number): string {
  const slug = `${year}-${String(month).padStart(2, "0")}`;
  return `ATK_Mostra_Pagave_${slug}.xlsx`;
}

export async function generatePayrollAtkExport(params: {
  companyId: string;
  payrollId: string;
  actorUserId?: string | null;
}): Promise<{ ok: true; exportId: string } | { ok: false; error: string }> {
  try {
    return await generatePayrollAtkExportInner(params);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generatePayrollAtkExport]", err);
    return {
      ok: false,
      error:
        msg.length > 0 ? `Gjenerimi i eksportit ATK dështoi: ${msg}` : "Gjenerimi i eksportit ATK dështoi.",
    };
  }
}

async function generatePayrollAtkExportInner(params: {
  companyId: string;
  payrollId: string;
  actorUserId?: string | null;
}): Promise<{ ok: true; exportId: string } | { ok: false; error: string }> {
  const payroll = await prisma.payroll.findFirst({
    where: { id: params.payrollId, companyId: params.companyId },
    include: {
      entries: {
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              personalId: true,
              applyTrust: true,
              applyTax: true,
            },
          },
        },
        orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
      },
    },
  });

  if (!payroll) return { ok: false, error: "Payroll nuk u gjet." };

  if (payroll.status !== "APPROVED" && payroll.status !== "LOCKED") {
    return { ok: false, error: "Eksporti ATK lejohet vetëm për payroll APPROVED ose LOCKED." };
  }

  const eligibleEntries = filterAtkEligibleRows(payroll.entries);
  if (eligibleEntries.length === 0) {
    return { ok: false, error: "Nuk ka punonjës të përshtatshëm (jo kontraktorë) për eksportin ATK." };
  }

  const existingActive = await prisma.payrollATKExport.findMany({
    where: { payrollId: payroll.id, companyId: params.companyId, isArchived: false },
  });

  if (payroll.status === "LOCKED" && existingActive.length > 0) {
    return {
      ok: false,
      error: "Payroll i kyçur: eksporti ATK gjenerohet një herë — përdorni shkarkimin nga historia.",
    };
  }

  const rows: AtkRowSource[] = eligibleEntries.map((e) => ({
    entryId: e.id,
    employmentTypeSnapshot: e.employmentTypeSnapshot,
    employerPrimacySnapshot: e.employerPrimacySnapshot,
    grossSalary: decimalToPlain(e.grossSalary),
    pensionEmployee: decimalToPlain(e.pensionEmployee),
    pensionEmployer: decimalToPlain(e.pensionEmployer),
    employee: {
      firstName: e.employee.firstName,
      lastName: e.employee.lastName,
      personalId: e.employee.personalId,
      applyTrust: e.employee.applyTrust,
      applyTax: e.employee.applyTax,
    },
  }));

  const snapshotHash = atkSnapshotHash(payroll.id, payroll.status, rows);
  const excelRows = rows.map((r) => mapSourceToAtkCellStrings(r));
  const buffer = await fillAtkOfficialTemplate(excelRows);

  const exportId = randomUUID();
  const storageKey = payrollAtkExportXlsxKey({
    companyId: params.companyId,
    payrollId: payroll.id,
    exportId,
  });
  const filename = atkFilename(payroll.year, payroll.month);
  const generatedFileUrl = `/api/payroll/atk-exports/${exportId}`;

  await getCompanyAssetStorage().put(storageKey, buffer, {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const regenerated = payroll.status === "APPROVED" && existingActive.length > 0;

  await prisma.$transaction(async (tx) => {
    if (regenerated) {
      await tx.payrollATKExport.updateMany({
        where: { id: { in: existingActive.map((x) => x.id) } },
        data: { isArchived: true },
      });
    }

    await tx.payrollATKExport.create({
      data: {
        id: exportId,
        companyId: params.companyId,
        payrollId: payroll.id,
        storageKey,
        filename,
        generatedFileUrl,
        snapshotHash,
        isArchived: false,
        generatedByUserId: params.actorUserId ?? undefined,
        metadataJson: {
          payrollYear: payroll.year,
          payrollMonth: payroll.month,
          rowCount: rows.length,
          exceljsTemplateFilename: ATK_TEMPLATE_FILENAME,
          monthLabel: payrollMonthLabel(payroll.year, payroll.month),
        },
      },
    });
  });

  await appendPayrollAuditLog({
    companyId: params.companyId,
    payrollId: payroll.id,
    action: regenerated ? PAYROLL_TIMELINE.PAYROLL_ATK_REGENERATED : PAYROLL_TIMELINE.PAYROLL_ATK_GENERATED,
    actorUserId: params.actorUserId,
    diff: {
      exportId,
      snapshotHash,
      payrollYear: payroll.year,
      payrollMonth: payroll.month,
      archivedExportIds: regenerated ? existingActive.map((x) => x.id) : [],
    },
  });

  await appendPayrollDomainActivity({
    companyId: params.companyId,
    payrollId: payroll.id,
    verb: "UPDATED",
    summary: regenerated ? "Eksporti ATK u rigjenerua." : "Eksporti ATK u gjenerua.",
    actorUserId: params.actorUserId,
    payload: {
      event: regenerated ? PAYROLL_TIMELINE.PAYROLL_ATK_REGENERATED : PAYROLL_TIMELINE.PAYROLL_ATK_GENERATED,
      exportId,
      snapshotHash,
      rowCount: rows.length,
    },
  });

  return { ok: true, exportId };
}

export async function archivePayrollAtkExport(params: {
  companyId: string;
  exportId: string;
  actorUserId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await prisma.payrollATKExport.findFirst({
    where: { id: params.exportId, companyId: params.companyId },
    select: { id: true, payrollId: true, isArchived: true },
  });
  if (!row) return { ok: false, error: "Eksporti nuk u gjet." };
  if (row.isArchived) return { ok: true };

  await prisma.payrollATKExport.update({
    where: { id: row.id },
    data: { isArchived: true },
  });

  await appendPayrollAuditLog({
    companyId: params.companyId,
    payrollId: row.payrollId,
    action: PAYROLL_TIMELINE.PAYROLL_ATK_ARCHIVED,
    actorUserId: params.actorUserId,
    diff: { exportId: row.id },
  });

  await appendPayrollDomainActivity({
    companyId: params.companyId,
    payrollId: row.payrollId,
    verb: "ARCHIVED",
    summary: "Eksporti ATK u arkivua në histori.",
    actorUserId: params.actorUserId,
    payload: { event: PAYROLL_TIMELINE.PAYROLL_ATK_ARCHIVED, exportId: row.id },
  });

  return { ok: true };
}

export async function logPayrollAtkExportDownloaded(params: {
  companyId: string;
  payrollId: string;
  exportId: string;
  actorUserId?: string | null;
}): Promise<void> {
  await appendPayrollAuditLog({
    companyId: params.companyId,
    payrollId: params.payrollId,
    action: PAYROLL_TIMELINE.PAYROLL_ATK_DOWNLOADED,
    actorUserId: params.actorUserId,
    diff: { exportId: params.exportId },
  });
}
