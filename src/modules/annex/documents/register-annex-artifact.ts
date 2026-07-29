import { prisma } from "@/lib/prisma";
import { registerRenderedArtifact } from "@/modules/documents/services/register-rendered-artifact";
import { renderAnnexDocument } from "@/modules/annex/documents/render-annex-document";

/**
 * Files a freshly issued annex into the Dokumentet register.
 *
 * Annexes render on demand from a bundled template, which is why they never
 * appeared in the register: an artifact must point at a template version, and
 * there was none until `scripts/seed-annex-templates.cjs` started registering
 * the bundle. Filed under CONTRACT — an annex amends a contract, and the
 * category enum has no separate value for one.
 *
 * Best-effort by design: an annex is valid whether or not the register copy
 * lands, so a storage hiccup must not fail the creation the user asked for.
 */
export async function registerAnnexArtifact(params: {
  companyId: string;
  annexId: string;
  employeeId: string;
  actorUserId?: string | null;
}): Promise<void> {
  try {
    const template = await prisma.documentTemplate.findFirst({
      where: {
        companyId: params.companyId,
        documentCategory: "CONTRACT",
        name: "Aneks i kontratës",
        isActive: true,
      },
      include: {
        versions: {
          where: { isPublished: true },
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
    });

    const version = template?.versions[0];
    if (!template || !version) {
      // The seeder has not run for this company yet; the annex still works.
      console.warn("[annex] no seeded annex template — skipping register entry");
      return;
    }

    const rendered = await renderAnnexDocument(params.companyId, params.annexId);
    if (!rendered.ok) {
      console.warn("[annex] render failed, not registered:", rendered.error);
      return;
    }

    await registerRenderedArtifact({
      companyId: params.companyId,
      documentTemplateId: template.id,
      templateVersionId: version.id,
      subjectKind: "CONTRACT",
      subjectId: params.annexId,
      documentCategory: "CONTRACT",
      title: rendered.filename.replace(/\.docx$/i, "").replaceAll("_", " "),
      displayFilename: rendered.filename,
      buffer: rendered.buffer,
      employeeId: params.employeeId,
      createdByUserId: params.actorUserId,
    });
  } catch (err) {
    console.error("[annex] could not register artifact", err);
  }
}
