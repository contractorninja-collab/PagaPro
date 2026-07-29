import { NextResponse } from "next/server";
import type { TerminationType } from "@prisma/client";
import { getCompanyContext, companyContextHttpError } from "@/server/company-context";
import { renderTerminationDocument } from "@/modules/terminations/documents/render-termination-document";
import { registerRenderedArtifact } from "@/modules/documents/services/register-rendered-artifact";
import { TERMINATION_TEMPLATE_OPTIONS } from "@/modules/terminations/types";

export const runtime = "nodejs";

const VALID_TEMPLATE_KEYS = new Set<string>(TERMINATION_TEMPLATE_OPTIONS.map((o) => o.key));

function parseTemplate(value: string | null): TerminationType | undefined {
  if (value && VALID_TEMPLATE_KEYS.has(value)) return value as TerminationType;
  return undefined;
}

/**
 * Streams a termination's decision document as a DOCX, rendered in-request.
 *
 * The template comes from storage when seeded and otherwise from the repo's
 * bundled DOCX, which is what makes "Shkarko" work on a serverless deployment
 * without an object store. `?inline=1` previews in the browser; otherwise it
 * downloads.
 *
 * The download is also filed in the Dokumentet register, once per termination
 * and letter type — downloading the same letter twice must not leave two rows.
 * A bundle-rendered document cannot be filed (no template version to point at),
 * so it streams as before.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return companyContextHttpError(ctx.reason);
  const { companyId } = ctx.context;

  const { id } = await params;
  const searchParams = new URL(request.url).searchParams;
  const inline = searchParams.get("inline") === "1";
  const templateType = parseTemplate(searchParams.get("template"));

  const result = await renderTerminationDocument(companyId, id, templateType);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  if (result.templateId && result.templateVersionId) {
    // Never let a bookkeeping failure block the download the user asked for.
    try {
      await registerRenderedArtifact({
        companyId,
        documentTemplateId: result.templateId,
        templateVersionId: result.templateVersionId,
        subjectKind: "TERMINATION",
        subjectId: id,
        documentCategory: "TERMINATION",
        title: result.filename.replace(/\.docx$/i, "").replaceAll("_", " "),
        displayFilename: result.filename,
        buffer: result.buffer,
        employeeId: result.employeeId,
        createdByUserId: ctx.context.user.id,
      });
    } catch (err) {
      console.error("[largimet] could not register the downloaded document", err);
    }
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(result.filename)}"`,
    },
  });
}
