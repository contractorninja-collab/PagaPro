/**
 * Registers bundled templates/warning DOCX files as mapped, published WARNING templates.
 * Mirrors the LEAVE seeder; the documents are {{placeholder}} templates authored by
 * scripts/build-warning-templates.cjs.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { detectDocxTemplateBuffer } = require("./detect-docx-template.cjs");
const { warningDir, loadWarningManifest } = require("./warning-manifest.cjs");
const { buildPlaceholderMapping, docxContentDigest } = require("./seed-leave-templates.cjs");
const {
  describeStorage,
  getStorage,
  putStorage,
  contentTypeForExtension,
} = require("./seed-storage.cjs");

function templateVersionSourceKey({ companyId, templateId, versionNumber }) {
  return `documents/templates/${companyId}/${templateId}/v${versionNumber}/source.docx`;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function seedWarningTemplatesForCompany(prisma, companyId) {
  let seeded = 0;

  for (const entry of loadWarningManifest()) {
    const filePath = path.join(warningDir(), entry.filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`[warning:seed] Skip ${entry.filename} - file missing`);
      continue;
    }

    const source = fs.readFileSync(filePath);
    const detection = detectDocxTemplateBuffer(source, null);
    if (detection.placeholders.length === 0) {
      throw new Error(`${entry.filename}: no {{placeholder}} fields were detected.`);
    }
    const mappingJson = buildPlaceholderMapping(detection.placeholders);

    let template = await prisma.documentTemplate.findFirst({
      where: { companyId, documentCategory: "WARNING", name: entry.name },
    });
    if (!template) {
      template = await prisma.documentTemplate.create({
        data: {
          companyId,
          name: entry.name,
          documentCategory: "WARNING",
          isActive: true,
        },
      });
    } else if (!template.isActive) {
      await prisma.documentTemplate.update({
        where: { id: template.id },
        data: { isActive: true },
      });
    }

    const published = await prisma.documentTemplateVersion.findFirst({
      where: { templateId: template.id, isPublished: true },
      select: { sourceStorageKey: true, mappingJson: true, detectionMode: true },
    });
    if (published) {
      // null means genuinely absent; a real failure throws and aborts the run.
      const existingBuf = await getStorage(published.sourceStorageKey);
      const sameSource =
        existingBuf !== null && docxContentDigest(existingBuf) === docxContentDigest(source);
      if (
        sameSource &&
        published.detectionMode === "PLACEHOLDER" &&
        stableJson(published.mappingJson) === stableJson(mappingJson)
      ) {
        continue;
      }
    }

    const aggregate = await prisma.documentTemplateVersion.aggregate({
      where: { templateId: template.id },
      _max: { versionNumber: true },
    });
    const versionNumber = (aggregate._max.versionNumber ?? 0) + 1;
    const sourceStorageKey = templateVersionSourceKey({
      companyId,
      templateId: template.id,
      versionNumber,
    });
    await putStorage(sourceStorageKey, source, contentTypeForExtension(sourceStorageKey));

    await prisma.$transaction([
      prisma.documentTemplateVersion.updateMany({
        where: { templateId: template.id },
        data: { isPublished: false },
      }),
      prisma.documentTemplateVersion.create({
        data: {
          templateId: template.id,
          versionNumber,
          sourceStorageKey,
          originalFilename: entry.filename,
          detectedPlaceholders: detection.placeholders,
          detectedBlankFields: [],
          detectionMode: "PLACEHOLDER",
          mappingJson,
          isMapped: true,
          isPublished: true,
          changelog: "Shabllon i integruar nga templates/warning.",
        },
      }),
    ]);

    seeded += 1;
    console.log(
      `[warning:seed] ${entry.name} -> company ${companyId} (v${versionNumber}, ${detection.placeholders.length} placeholders)`,
    );
  }

  return seeded;
}

async function seedWarningTemplates(prisma) {
  console.log(`[warning:seed] storage: ${describeStorage()}`);
  const companies = await prisma.company.findMany({ select: { id: true } });
  let total = 0;
  for (const company of companies) {
    total += await seedWarningTemplatesForCompany(prisma, company.id);
  }
  if (total > 0) {
    console.log(`[warning:seed] Seeded ${total} mapped published template version(s).`);
  }
  return total;
}

module.exports = { seedWarningTemplates, seedWarningTemplatesForCompany };
