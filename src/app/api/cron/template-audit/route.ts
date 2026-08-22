import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * TEMPORARY diagnostic (CRON_SECRET-gated, no cron schedule): per-company
 * template inventory with content hashes for CONTRACT templates, to explain
 * why one client's contracts differ from the rest. Remove after use.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: false }, { status: 503 });
  const authHeader = req.headers.get("authorization")?.trim() ?? "";
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const storage = getCompanyAssetStorage();
  const companies = await prisma.company.findMany({
    select: { id: true, legalName: true, createdAt: true },
    orderBy: { legalName: "asc" },
  });

  const out: Record<string, unknown> = {};
  // name -> sha8 -> companies, to make divergence pop without eyeballing.
  const contractDigest: Record<string, Record<string, string[]>> = {};

  for (const c of companies) {
    const templates = await prisma.documentTemplate.findMany({
      where: { companyId: c.id },
      orderBy: [{ documentCategory: "asc" }, { name: "asc" }],
      select: {
        name: true,
        documentCategory: true,
        contractKind: true,
        templateSubtype: true,
        isActive: true,
        createdAt: true,
        versions: {
          orderBy: { versionNumber: "desc" },
          select: {
            versionNumber: true,
            isPublished: true,
            isMapped: true,
            sourceStorageKey: true,
            originalFilename: true,
            uploadedAt: true,
            changelog: true,
          },
        },
      },
    });

    const rows = [];
    for (const t of templates) {
      const published = t.versions.find((v) => v.isPublished) ?? t.versions[0] ?? null;
      let sha8: string | null = null;
      let bytes: number | null = null;
      if (published && t.documentCategory === "CONTRACT") {
        try {
          const blob = await storage.get(published.sourceStorageKey);
          sha8 = createHash("sha256").update(blob).digest("hex").slice(0, 8);
          bytes = blob.length;
          const byName = (contractDigest[t.name] ??= {});
          (byName[sha8] ??= []).push(c.legalName);
        } catch {
          sha8 = "BLOB-MISSING";
          const byName = (contractDigest[t.name] ??= {});
          (byName["BLOB-MISSING"] ??= []).push(c.legalName);
        }
      }
      rows.push({
        name: t.name,
        category: t.documentCategory,
        kind: t.contractKind,
        subtype: t.templateSubtype,
        active: t.isActive,
        createdAt: t.createdAt.toISOString().slice(0, 10),
        versionCount: t.versions.length,
        publishedVersion: published?.isPublished ? published.versionNumber : null,
        mapped: published?.isMapped ?? null,
        uploadedAt: published?.uploadedAt.toISOString().slice(0, 10) ?? null,
        originalFilename: published?.originalFilename ?? null,
        changelog: published?.changelog ?? null,
        sha8,
        bytes,
      });
    }
    out[`${c.legalName} (created ${c.createdAt.toISOString().slice(0, 10)})`] = rows;
  }

  return NextResponse.json({ ok: true, contractDigest, companies: out });
}
