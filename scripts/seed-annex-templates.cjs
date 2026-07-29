/**
 * Registers the bundled templates/annex DOCX as a mapped, published template.
 *
 * Annexes used to render straight from the repo bundle with no database row
 * behind them, which meant an issued annex could never become a document
 * artifact — an artifact must trace back to a template version, and there was
 * none. Seeding the bundle gives it one, so annexes can join the Dokumentet
 * register like every other document.
 *
 * Filed under CONTRACT: an annex amends a contract, and the DocumentCategory
 * enum has no separate value for it.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { detectDocxTemplateBuffer } = require("./detect-docx-template.cjs");
const { annexDir, loadAnnexManifest } = require("./annex-manifest.cjs");
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

async function seedAnnexTemplatesForCompany(prisma, companyId) {
  let seeded = 0;

  for (const entry of loadAnnexManifest()) {
    const filePath = path.join(annexDir(), entry.filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`[annex:seed] Skip ${entry.filename} - file missing`);
      continue;
    }

    const source = fs.readFileSync(filePath);
    const detection = detectDocxTemplateBuffer(source, null);
    if (detection.placeholders.length === 0) {
      throw new Error(`${entry.filename}: no {{placeholder}} fields were detected.`);
    }
    const mappingJson = buildPlaceholderMapping(detection.placeholders);

    let template = await prisma.documentTemplate.findFirst({
      where: { companyId, documentCategory: "CONTRACT", name: entry.name },
    });
    if (!template) {
      template = await prisma.documentTemplate.create({
        data: {
          companyId,
          name: entry.name,
          documentCategory: "CONTRACT",
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
          changelog: "Shabllon i integruar nga templates/annex.",
        },
      }),
    ]);

    seeded += 1;
    console.log(
      `[annex:seed] ${entry.name} -> company ${companyId} (v${versionNumber}, ${detection.placeholders.length} placeholders)`,
    );
  }

  return seeded;
}

async function seedAnnexTemplates(prisma) {
  console.log(`[annex:seed] storage: ${describeStorage()}`);
  const companies = await prisma.company.findMany({ select: { id: true } });
  let total = 0;
  for (const company of companies) {
    total += await seedAnnexTemplatesForCompany(prisma, company.id);
  }
  if (total > 0) {
    console.log(`[annex:seed] Seeded ${total} mapped published template version(s).`);
  }
  return total;
}

module.exports = { seedAnnexTemplates, seedAnnexTemplatesForCompany };
