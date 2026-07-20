import { NextRequest, NextResponse } from "next/server";
import { companyContextHttpError, getCompanyContext } from "@/server/company-context";
import { canImportEmployees } from "@/modules/employees/services/employee-import-access";
import {
  commitEmployeeImport,
  EmployeeImportError,
  validateEmployeeImportFile,
} from "@/modules/employees/services/employee-import-service";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const result = await getCompanyContext();
  if (!result.ok) return companyContextHttpError(result.reason);
  const { companyId, role, user } = result.context;
  if (!canImportEmployees({ role, isPlatformAdmin: user.isPlatformAdmin })) {
    return NextResponse.json({ error: "Nuk keni leje për importin e punonjësve." }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new EmployeeImportError("Zgjidhni një skedar CSV.");
    validateEmployeeImportFile(file);
    const committed = await commitEmployeeImport(companyId, user.id, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json(committed);
  } catch (error) {
    if (error instanceof EmployeeImportError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[employee-import] commit failed", error);
    return NextResponse.json({ error: "Importi i punonjësve dështoi." }, { status: 500 });
  }
}
