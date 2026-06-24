import { randomUUID } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { payrollDocumentPdfKey } from "@/modules/documents/engine/storage/payroll-path-keys";
import { payrollMonthLabel } from "@/modules/payroll/helpers/month-label";
import { decimalToPlain } from "@/modules/payroll/helpers/money-format";
import { toPdfStandardFontText } from "@/modules/payroll/helpers/pdf-standard-font-text";
import { appendPayrollDomainActivity } from "@/modules/payroll/services/payroll-audit-service";
import { PAYROLL_TIMELINE } from "@/modules/payroll/constants/timeline";

async function drawTitle(
  page: { drawText: (t: string, o: object) => void },
  title: string,
  y: number,
  font: PDFFont,
) {
  page.drawText(toPdfStandardFontText(title), { x: 40, y, size: 14, font });
  return y - 28;
}

export async function generatePayrollPdfArtifacts(params: {
  companyId: string;
  payrollId: string;
  actorUserId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    return await generatePayrollPdfArtifactsInner(params);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generatePayrollPdfArtifacts]", err);
    return {
      ok: false,
      error:
        msg.length > 0
          ? `Gjenerimi i PDF dështoi: ${msg}`
          : "Gjenerimi i PDF dështoi për një gabim të papritur.",
    };
  }
}

async function generatePayrollPdfArtifactsInner(params: {
  companyId: string;
  payrollId: string;
  actorUserId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const payroll = await prisma.payroll.findFirst({
    where: { id: params.payrollId, companyId: params.companyId },
    include: {
      company: true,
      entries: {
        include: { employee: true },
        orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
      },
    },
  });

  if (!payroll) return { ok: false, error: "Payroll nuk u gjet." };
  if (payroll.status === "LOCKED" || payroll.status === "ARCHIVED") {
    return { ok: false, error: "PDF-t janë të ngurtësuara pas kyçjes së payroll-it." };
  }
  if (payroll.entries.length === 0) return { ok: false, error: "Nuk ka rreshta pagë për të gjeneruar PDF." };

  const pay = payroll;

  const cfg = await prisma.companyConfiguration.findUnique({ where: { companyId: params.companyId } });
  const prefix = (cfg?.payrollPdfPrefix ?? "PP").replace(/[^a-zA-Z0-9_-]/g, "") || "PP";
  const monthSlug = `${pay.year}-${String(pay.month).padStart(2, "0")}`;
  const brand = pay.company.tradeName?.trim() || pay.company.legalName;

  const storage = getCompanyAssetStorage();

  const rows = pay.entries.map((e) => ({
    name: `${e.employee.firstName} ${e.employee.lastName}`,
    gross: decimalToPlain(e.grossSalary),
    net: decimalToPlain(e.netPay),
    personalId: e.employee.personalId,
  }));

  async function buildRegister(withAmounts: boolean): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([595.28, 841.89]);
    let y = 800;

    y = await drawTitle(
      page,
      withAmounts ? `Lista e pagave — ${brand}` : `Lista për nënshkrime — ${brand}`,
      y,
      bold,
    );
    page.drawText(toPdfStandardFontText(`${payrollMonthLabel(pay.year, pay.month)} · ${pay.currency}`), {
      x: 40,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 36;

    page.drawText(toPdfStandardFontText("#"), { x: 40, y, size: 9, font: bold });
    page.drawText(toPdfStandardFontText("Punonjësi"), { x: 70, y, size: 9, font: bold });
    page.drawText(toPdfStandardFontText("Numri personal"), { x: 280, y, size: 9, font: bold });
    if (withAmounts) {
      page.drawText(toPdfStandardFontText("Bruto"), { x: 400, y, size: 9, font: bold });
      page.drawText(toPdfStandardFontText("Neto"), { x: 480, y, size: 9, font: bold });
    }
    y -= 16;

    rows.forEach((r, idx) => {
      if (y < 60) {
        page = pdf.addPage([595.28, 841.89]);
        y = 800;
      }
      page.drawText(toPdfStandardFontText(String(idx + 1)), { x: 40, y, size: 9, font });
      page.drawText(toPdfStandardFontText(r.name.slice(0, 42)), { x: 70, y, size: 9, font });
      page.drawText(toPdfStandardFontText(r.personalId), { x: 280, y, size: 9, font });
      if (withAmounts) {
        page.drawText(toPdfStandardFontText(r.gross), { x: 400, y, size: 9, font });
        page.drawText(toPdfStandardFontText(r.net), { x: 480, y, size: 9, font });
      }
      y -= 14;
    });

    return pdf.save();
  }

  async function buildPayslip(employeeName: string, gross: string, net: string, pid: string): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([595.28, 841.89]);
    let y = 780;
    page.drawText(toPdfStandardFontText(`${brand}`), { x: 40, y, size: 12, font });
    y -= 22;
    page.drawText(toPdfStandardFontText(`Fletëpagesë — ${payrollMonthLabel(pay.year, pay.month)}`), {
      x: 40,
      y,
      size: 11,
      font,
    });
    y -= 28;
    page.drawText(toPdfStandardFontText(`Punonjësi: ${employeeName}`), { x: 40, y, size: 10, font });
    y -= 16;
    page.drawText(toPdfStandardFontText(`Numri personal: ${pid}`), { x: 40, y, size: 10, font });
    y -= 22;
    page.drawText(toPdfStandardFontText(`Bruto: EUR ${gross}`), { x: 40, y, size: 10, font });
    y -= 16;
    page.drawText(toPdfStandardFontText(`Neto: EUR ${net}`), { x: 40, y, size: 10, font });
    return pdf.save();
  }

  await prisma.payrollGeneratedDocument.deleteMany({ where: { payrollId: pay.id } });

  const buffers: Array<{
    kind: "REGISTER_WITH_TOTALS" | "REGISTER_SIGNATURE_LIST" | "EMPLOYEE_PAYSLIP";
    employeeId?: string;
    body: Uint8Array;
    filename: string;
  }> = [];

  const regTotals = await buildRegister(true);
  buffers.push({
    kind: "REGISTER_WITH_TOTALS",
    body: regTotals,
    filename: `${prefix}_lista_me_shuma_${monthSlug}.pdf`,
  });

  const regSig = await buildRegister(false);
  buffers.push({
    kind: "REGISTER_SIGNATURE_LIST",
    body: regSig,
    filename: `${prefix}_lista_nenshkrimet_${monthSlug}.pdf`,
  });

  for (const e of pay.entries) {
    const slip = await buildPayslip(
      `${e.employee.firstName} ${e.employee.lastName}`,
      decimalToPlain(e.grossSalary),
      decimalToPlain(e.netPay),
      e.employee.personalId,
    );
    buffers.push({
      kind: "EMPLOYEE_PAYSLIP",
      employeeId: e.employeeId,
      body: slip,
      filename: `${prefix}_fletepagese_${e.employee.personalId}_${monthSlug}.pdf`,
    });
  }

  for (const b of buffers) {
    const id = randomUUID();
    const suffix =
      b.kind === "REGISTER_WITH_TOTALS"
        ? "register_totals"
        : b.kind === "REGISTER_SIGNATURE_LIST"
          ? "register_signatures"
          : "payslip";
    const key = payrollDocumentPdfKey({
      companyId: params.companyId,
      payrollId: pay.id,
      documentId: id,
      suffix,
    });
    await storage.put(key, Buffer.from(b.body), { contentType: "application/pdf" });
    await prisma.payrollGeneratedDocument.create({
      data: {
        id,
        payrollId: pay.id,
        companyId: params.companyId,
        kind: b.kind,
        employeeId: b.employeeId ?? null,
        storageKey: key,
        filename: b.filename,
        generatedByUserId: params.actorUserId ?? undefined,
      },
    });
  }

  await appendPayrollDomainActivity({
    companyId: params.companyId,
    payrollId: pay.id,
    verb: "UPDATED",
    summary: "PDF-t e pagës u gjeneruan.",
    actorUserId: params.actorUserId,
    payload: { event: PAYROLL_TIMELINE.PDF_GENERATED, kinds: buffers.map((x) => x.kind) },
  });

  return { ok: true };
}
