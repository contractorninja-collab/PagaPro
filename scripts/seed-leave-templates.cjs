/**
 * Registers bundled templates/leave DOCX files as mapped, published LEAVE templates.
 * Visual underscore runs in these documents are protocol/signature formatting, not inputs.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const PizZip = require("pizzip");
const { detectDocxTemplateBuffer } = require("./detect-docx-template.cjs");
const { leaveDir, loadLeaveManifest } = require("./leave-manifest.cjs");

const XML_PART = /^word\/(document\d*|header\d*|footer\d*)\.xml$/i;
const REQUIRED_PLACEHOLDERS = new Set([
  "company_name",
  "employee_first_name",
  "employee_last_name",
  "employee_personal_number",
  "leave_start_date",
  "leave_end_date",
]);

function templateVersionSourceKey({ companyId, templateId, versionNumber }) {
  return `documents/templates/${companyId}/${templateId}/v${versionNumber}/source.docx`;
}

// Storage lives in scripts/seed-storage.cjs so the seeder writes wherever the
// app reads. `storagePath` is deliberately gone: any missed conversion must be
// a ReferenceError, not a silent read from local disk while the app reads S3.
const {
  describeStorage,
  getStorage,
  putStorage,
  contentTypeForExtension,
} = require("./seed-storage.cjs");

function normalizeBundledLeaveTemplate(source) {
  const zip = new PizZip(source);
  for (const name of Object.keys(zip.files)) {
    const file = zip.files[name];
    if (!file || file.dir || !XML_PART.test(name)) continue;
    const normalized = file
      .asText()
      .replace(/\{\{\s*employee_name\s*\}\}/g, "{{employee_first_name}}");
    zip.file(name, normalized);
  }
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

function docxContentDigest(source) {
  const zip = new PizZip(source);
  const hash = crypto.createHash("sha256");
  for (const name of Object.keys(zip.files).sort()) {
    const file = zip.files[name];
    if (!file || file.dir) continue;
    hash.update(name);
    hash.update("\0");
    hash.update(file.asNodeBuffer());
    hash.update("\0");
  }
  return hash.digest("hex");
}

function buildPlaceholderMapping(placeholders) {
  return {
    blankFields: [],
    placeholders: placeholders.map((key) => ({
      key,
      required: REQUIRED_PLACEHOLDERS.has(key),
      fallback: "",
    })),
  };
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

async function seedLeaveTemplatesForCompany(prisma, companyId) {
  let seeded = 0;

  for (const entry of loadLeaveManifest()) {
    const filePath = path.join(leaveDir(), entry.filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`[leave:seed] Skip ${entry.filename} - file missing`);
      continue;
    }

    const source = normalizeBundledLeaveTemplate(fs.readFileSync(filePath));
    const detection = detectDocxTemplateBuffer(source, null);
    if (detection.placeholders.length === 0) {
      throw new Error(`${entry.filename}: no {{placeholder}} fields were detected.`);
    }
    const mappingJson = buildPlaceholderMapping(detection.placeholders);

    let template = await prisma.documentTemplate.findFirst({
      where: { companyId, documentCategory: "LEAVE", name: entry.name },
    });
    if (!template) {
      template = await prisma.documentTemplate.create({
        data: {
          companyId,
          name: entry.name,
          documentCategory: "LEAVE",
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
        existingBuf !== null &&
        docxContentDigest(existingBuf) === docxContentDigest(source);
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
          changelog: "Shabllon i integruar nga templates/leave.",
        },
      }),
    ]);

    seeded += 1;
    console.log(
      `[leave:seed] ${entry.name} -> company ${companyId} (v${versionNumber}, ${detection.placeholders.length} placeholders)`,
    );
  }

  return seeded;
}

async function seedLeaveTemplates(prisma) {
  console.log(`[leave:seed] storage: ${describeStorage()}`);
  const companies = await prisma.company.findMany({ select: { id: true } });
  let total = 0;
  for (const company of companies) {
    total += await seedLeaveTemplatesForCompany(prisma, company.id);
  }
  if (total > 0) {
    console.log(`[leave:seed] Seeded ${total} mapped published template version(s).`);
  }
  return total;
}

module.exports = {
  buildPlaceholderMapping,
  docxContentDigest,
  normalizeBundledLeaveTemplate,
  seedLeaveTemplates,
  seedLeaveTemplatesForCompany,
};
