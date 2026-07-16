import { NextResponse } from "next/server";
import { companyContextHttpError, getCompanyContext } from "@/server/company-context";
import { canImportEmployees } from "@/modules/employees/services/employee-import-access";
import { employeeImportTemplateBuffer } from "@/modules/employees/services/employee-import-service";

export async function GET(): Promise<NextResponse> {
  const result = await getCompanyContext();
  if (!result.ok) return companyContextHttpError(result.reason);
  const { role, user } = result.context;
  if (!canImportEmployees({ role, isPlatformAdmin: user.isPlatformAdmin })) {
    return NextResponse.json({ error: "Nuk keni leje për importin e punonjësve." }, { status: 403 });
  }

  return new NextResponse(new Uint8Array(employeeImportTemplateBuffer()), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="punonjesit-import.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
