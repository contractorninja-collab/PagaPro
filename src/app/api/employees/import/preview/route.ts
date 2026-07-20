import { NextRequest, NextResponse } from "next/server";
import { companyContextHttpError, getCompanyContext } from "@/server/company-context";
import { canImportEmployees } from "@/modules/employees/services/employee-import-access";
import {
  EmployeeImportError,
  previewEmployeeImport,
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
    const preview = await previewEmployeeImport(companyId, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json(preview);
  } catch (error) {
    if (error instanceof EmployeeImportError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[employee-import] preview failed", error);
    return NextResponse.json({ error: "Kontrolli i CSV-së dështoi." }, { status: 500 });
  }
}
