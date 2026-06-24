import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { resolveActiveCompanyId } from "@/server/company-scope";
import { logPayrollAtkExportDownloaded } from "@/modules/payroll/atk/services/atk-payroll-export-service";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const companyId = await resolveActiveCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      actorUserId: null,
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
