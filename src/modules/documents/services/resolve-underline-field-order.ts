import fs from "node:fs";
import path from "node:path";
import type { DocumentTemplateSubtype, PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { underlineFieldOrderFromJson } from "../engine/render/underline-blank-filler";

const MANIFEST_PATH = path.join(process.cwd(), "templates", "contracts", "manifest.json");

function fieldsFromManifest(subtype: DocumentTemplateSubtype): string[] | undefined {
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw) as { templates?: Array<{ templateSubtype?: string; fields?: string[] }> };
    const entry = parsed.templates?.find((t) => t.templateSubtype === subtype);
    const fields = entry?.fields?.filter((f): f is string => typeof f === "string");
    return fields && fields.length > 0 ? fields : undefined;
  } catch {
    return undefined;
  }
}

/** Resolves ordered underline fields for CONTRACT uploads (manifest → prior version). */
export async function resolveUnderlineFieldOrderForTemplateUpload(
  prisma: PrismaClient,
  args: { templateId: string; templateSubtype: DocumentTemplateSubtype | null },
): Promise<string[] | undefined> {
  if (args.templateSubtype) {
    const fromManifest = fieldsFromManifest(args.templateSubtype);
    if (fromManifest) return fromManifest;
  }

  const prior = await prisma.documentTemplateVersion.findFirst({
    where: {
      templateId: args.templateId,
      NOT: { underlineFieldOrder: { equals: Prisma.DbNull } },
    },
    orderBy: { versionNumber: "desc" },
    select: { underlineFieldOrder: true },
  });

  return underlineFieldOrderFromJson(prior?.underlineFieldOrder);
}
