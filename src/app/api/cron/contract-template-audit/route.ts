import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * TEMPORARY diagnostic (CRON_SECRET-gated, not scheduled): which contract
 * template file is actually PUBLISHED per company, and how its body spacing
 * compares to the bundled templates. Template metadata only — no employee
 * data. Removed after use.
 */

function sha(buf: Buffer): string {
  return createHash("sha1").update(buf).digest("hex").slice(0, 10);
}

/** BodyLegal + docDefaults + Normal spacing — what decides airy vs compact. */
function spacingSignature(buf: Buffer): string {
  try {
    const zip = new PizZip(buf);
    const styles = zip.file("word/styles.xml")?.asText() ?? "";
    const doc = zip.file("word/document.xml")?.asText() ?? "";
    const grab = (re: RegExp) => styles.match(re)?.[0]?.match(/<w:spacing[^/>]*\/>/)?.[0] ?? "-";
    const defaults = grab(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/);
    const normal = grab(/<w:style [^>]*w:styleId="Normal"[\s\S]*?<\/w:style>/);
    const body = grab(/<w:style [^>]*w:styleId="BodyLegal"[\s\S]*?<\/w:style>/);
    const paras = (doc.match(/<w:p[\s>]/g) ?? []).length;
    const styled = (doc.match(/<w:pStyle w:val="BodyLegal"/g) ?? []).length;
    return `paras=${paras} bodyLegalParas=${styled} | BodyLegal ${body} | Normal ${normal} | defaults ${defaults}`;
  } catch (e) {
    return `unreadable: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: false }, { status: 503 });
  if ((req.headers.get("authorization")?.trim() ?? "") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const bundle: Record<string, string> = {};
  for (const f of ["kontrate-me-afat-te-caktuar", "kontrate-me-afat-te-pacaktuar"]) {
    const buf = readFileSync(path.join(process.cwd(), "templates", "contracts", `${f}.docx`));
    bundle[sha(buf)] = f;
  }

  const storage = getCompanyAssetStorage();
  const companies = await prisma.company.findMany({
    select: { id: true, legalName: true },
    orderBy: { legalName: "asc" },
  });

  const report: Record<string, unknown> = {};
  for (const c of companies) {
    const templates = await prisma.documentTemplate.findMany({
      where: { companyId: c.id, documentCategory: "CONTRACT" },
      select: {
        id: true,
        name: true,
        templateSubtype: true,
        isActive: true,
        versions: {
          where: { isPublished: true },
          select: { versionNumber: true, sourceStorageKey: true, originalFilename: true, uploadedAt: true },
        },
        _count: { select: { versions: true } },
      },
      orderBy: { name: "asc" },
    });

    const rows = [];
    for (const t of templates) {
      const pub = t.versions[0];
      let fileInfo = "no published version";
      if (pub) {
        try {
          const buf = await storage.get(pub.sourceStorageKey);
          const h = sha(buf);
          fileInfo = `${bundle[h] ? `= BUNDLE (${bundle[h]})` : `CUSTOM FILE ${h}`} | ${spacingSignature(buf)}`;
        } catch (e) {
          fileInfo = `storage read failed: ${e instanceof Error ? e.message : String(e)}`;
        }
      }
      // Which template actually produced recent contracts.
      const recentArtifacts = await prisma.documentGenerationArtifact.count({
        where: { companyId: c.id, templateVersion: { templateId: t.id } },
      });
      rows.push({
        name: t.name,
        subtype: t.templateSubtype,
        active: t.isActive,
        versions: t._count.versions,
        published: pub
          ? { v: pub.versionNumber, file: pub.originalFilename, at: pub.uploadedAt.toISOString().slice(0, 10) }
          : null,
        artifactsGenerated: recentArtifacts,
        fileInfo,
      });
    }
    report[c.legalName] = rows;
  }

  return NextResponse.json({ ok: true, report });
}
