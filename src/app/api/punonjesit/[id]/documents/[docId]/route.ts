import { NextResponse } from "next/server";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { companyContextHttpError, getCompanyContext } from "@/server/company-context";
import { assertCompanyScopedStorageKey } from "@/server/company-scope";
import { can } from "@/server/permissions";
import {
  getEmployeeDocumentForServe,
  logEmployeeDocumentDownloaded,
} from "@/modules/employee-documents/services/employee-document-service";
import { isInlinePreviewable } from "@/modules/employee-documents/services/employee-document-file";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; docId: string }> },
) {
  const result = await getCompanyContext();
  if (!result.ok) return companyContextHttpError(result.reason);
  const { companyId, user, role } = result.context;

  const { id: employeeId, docId } = await context.params;
  const found = await getEmployeeDocumentForServe({ companyId, employeeId, documentId: docId });
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Special-category data: absence, not refusal — a 403 would confirm the
  // document exists to someone not allowed to know that.
  if (
    found.sensitive &&
    !can({ role, isPlatformAdmin: user.isPlatformAdmin }, "documents.sensitive")
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    assertCompanyScopedStorageKey(companyId, found.doc.storageKey);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const inline =
    new URL(request.url).searchParams.get("inline") === "1" &&
    isInlinePreviewable(found.doc.contentType);

  try {
    const buf = await getCompanyAssetStorage().get(found.doc.storageKey);
    await logEmployeeDocumentDownloaded({
      companyId,
      employeeId,
      documentId: found.doc.id,
      actorUserId: user.id,
    });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": found.doc.contentType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(found.doc.displayFilename)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
