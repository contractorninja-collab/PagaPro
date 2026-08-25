import { NextResponse } from "next/server";
import { companyContextHttpError, getCompanyContext, permissionSubjectOf } from "@/server/company-context";
import { canImportEmployees } from "@/modules/employees/services/employee-import-access";
import { employeeImportTemplateBuffer } from "@/modules/employees/services/employee-import-service";

export async function GET(): Promise<NextResponse> {
  const result = await getCompanyContext();
  if (!result.ok) return companyContextHttpError(result.reason);
  const _ctx = result.context;
  if (!canImportEmployees(permissionSubjectOf(result.context))) {
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
