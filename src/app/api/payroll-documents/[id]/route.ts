import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { requireCapabilityHttp } from "@/server/company-context";

/**
 * Payslip and register PDFs.
 *
 * Gated on `payroll.prepare` rather than plain company membership: a payslip
 * prints the employee's decrypted bank account alongside their salary, so a
 * READ_ONLY member being able to enumerate these was a hole — and it would
 * have made the capability check on the payment-list export meaningless while
 * the same data stayed reachable one route over.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapabilityHttp("payroll.prepare");
  if (!auth.ok) return auth.response;
  const { companyId } = auth.context;

  const { id } = await context.params;
  // Kept: "Printo" opens the PDF in a tab so it can be sent to a printer.
  // It is a deliberate click by someone who already holds payroll.prepare,
  // and `no-store` keeps the tab's copy out of the disk cache.
  const inline = new URL(request.url).searchParams.get("inline") === "1";

  const doc = await prisma.payrollGeneratedDocument.findFirst({
    where: { id, companyId },
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const buf = await getCompanyAssetStorage().get(doc.storageKey);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(doc.filename)}"`,
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
