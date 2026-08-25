import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { requireCapabilitiesHttp } from "@/server/company-context";
import { logPayrollAtkExportDownloaded } from "@/modules/payroll/atk/services/atk-payroll-export-service";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  // The ATK workbook lists every employee's gross/tax/pension — full salary
  // visibility required, not just membership.
  const result = await requireCapabilitiesHttp("payroll.prepare", "salaries.full");
  if (!result.ok) return result.response;
  const { companyId, user } = result.context;

  const { id } = await context.params;

  const doc = await prisma.payrollATKExport.findFirst({
    where: { id, companyId },
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const buf = await getCompanyAssetStorage().get(doc.storageKey);
    await logPayrollAtkExportDownloaded({
      companyId,
      payrollId: doc.payrollId,
      exportId: doc.id,
      actorUserId: user.id,
    });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.filename)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
