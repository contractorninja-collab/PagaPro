import { NextResponse } from "next/server";
import { requireCapabilityHttp } from "@/server/company-context";
import { getEmployeeAnnualStatement } from "@/modules/payroll/services/employee-annual-statement-service";
import { buildVertetimTatimorPdf } from "@/modules/payroll/pdf/vertetim-tatimor-pdf-builder";
import { sanitizeFilenamePart } from "@/modules/payroll/pdf/payslip-filename";

/**
 * Annual withholding certificate for one employee: `?year=2026`.
 *
 * Salary and tax figures in bulk — same sensitivity class as payslips, same
 * gate. Only finalized payroll months exist in the statement, so the figures
 * cannot change under a certificate that has already been handed out.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapabilityHttp("payroll.prepare");
  if (!auth.ok) return auth.response;
  const { companyId } = auth.context;

  const { id } = await context.params;
  const yearRaw = Number(new URL(request.url).searchParams.get("year"));
  if (!Number.isInteger(yearRaw) || yearRaw < 1970 || yearRaw > 2100) {
    return NextResponse.json({ error: "Viti nuk është valid." }, { status: 400 });
  }

  const statement = await getEmployeeAnnualStatement(companyId, id, yearRaw);
  if (!statement) {
    return NextResponse.json(
      { error: "Nuk ka periudha të finalizuara pagash për këtë punonjës në atë vit." },
      { status: 404 },
    );
  }

  try {
    const buf = await buildVertetimTatimorPdf(
      statement,
      new Date().toLocaleString("sq-AL", { timeZone: "Europe/Belgrade" }),
    );
    const name = sanitizeFilenamePart(
      `Vertetim_Tatimor_${yearRaw}_${statement.employee.lastName}_${statement.employee.firstName}`,
    );
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[vertetim-tatimor]", err);
    return NextResponse.json({ error: "Vërtetimi nuk mund të gjenerohej." }, { status: 500 });
  }
}
