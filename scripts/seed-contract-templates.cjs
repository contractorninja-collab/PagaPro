/**
 * Seeds bundled contract templates from templates/contracts/ for every company.
 * Publishes bundled contract templates with the manifest field order already mapped.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const PizZip = require("pizzip");
const { loadContractManifest, contractsDir } = require("./contract-manifest.cjs");
const { detectDocxTemplateBuffer } = require("./detect-docx-template.cjs");

const XML_PART = /^word\/(document\d*|header\d*|footer\d*)\.xml$/i;
const STUB_MARKER_RE = /Kontrate me Afat.*— fusha \d+:/;

function templateVersionSourceKey({ companyId, templateId, versionNumber }) {
  return `documents/templates/${companyId}/${templateId}/v${versionNumber}/source.docx`;
}

// Storage lives in scripts/seed-storage.cjs so the seeder writes wherever the app reads.
const {
  describeStorage,
  getStorage,
  putStorage,
  contentTypeForExtension,
} = require("./seed-storage.cjs");

function docxContainsStubMarker(docxBuffer) {
  const zip = new PizZip(docxBuffer);
  for (const name of Object.keys(zip.files).sort()) {
    if (!XML_PART.test(name)) continue;
    const file = zip.files[name];
    if (!file || file.dir) continue;
    if (STUB_MARKER_RE.test(file.asText())) return true;
  }
  return false;
}

const REQUIRED_BUNDLED_FIELDS = new Set([
  "company_name",
  "employee_name",
  "contract_start_date",
  "salary_gross",
]);

function buildBundledMapping(entry, detection) {
  const fields = Array.isArray(entry.fields) ? entry.fields : [];
  if (fields.length !== detection.blankFields.length) {
    throw new Error(
      `${entry.filename}: manifest has ${fields.length} field(s), DOCX has ${detection.blankFields.length} blank(s).`,
    );
  }

  return {
    blankFields: fields.map((placeholderKey, idx) => ({
      index: idx + 1,
      placeholderKey,
      label: detection.blankFields[idx]?.paragraphPreview ?? placeholderKey,
      required: REQUIRED_BUNDLED_FIELDS.has(placeholderKey),
      fallback: "",
    })),
    placeholders: [],
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

async function seedContractTemplatesForCompany(prisma, companyId) {
  const dir = contractsDir();
  const entries = loadContractManifest();
  let seeded = 0;

  for (const entry of entries) {
    const filePath = path.join(dir, entry.filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`[contracts:seed] Skip ${entry.filename} — file missing (run validate script first)`);
      continue;
    }

    const buf = fs.readFileSync(filePath);
    if (docxContainsStubMarker(buf)) {
      console.warn(`[contracts:seed] Skip ${entry.filename} — generated stub detected. Replace with the real Word contract.`);
      continue;
    }
    const detection = detectDocxTemplateBuffer(buf, entry.templateSubtype);
    const mappingJson = buildBundledMapping(entry, detection);

    let template = await prisma.documentTemplate.findFirst({
      where: {
        companyId,
        documentCategory: "CONTRACT",
        templateSubtype: entry.templateSubtype,
      },
    });

    if (!template) {
      template = await prisma.documentTemplate.create({
        data: {
          companyId,
          name: entry.name,
          documentCategory: "CONTRACT",
          templateSubtype: entry.templateSubtype,
          contractKind: "EMPLOYMENT",
          isActive: true,
        },
      });
    } else {
      await prisma.documentTemplate.update({
        where: { id: template.id },
        data: { name: entry.name, isActive: true },
      });
    }

    const existingPublished = await prisma.documentTemplateVersion.findFirst({
      where: { templateId: template.id, isPublished: true },
      select: { id: true, sourceStorageKey: true, mappingJson: true },
    });
    if (existingPublished) {
      // null means genuinely absent; a real failure throws and aborts the run
      // rather than being misread as "changed" and republishing v(n+1).
      const publishedBuf = await getStorage(existingPublished.sourceStorageKey);
      const publishedIsSameRealFile =
        publishedBuf !== null &&
        Buffer.compare(publishedBuf, buf) === 0 &&
        !docxContainsStubMarker(publishedBuf);
      const publishedHasSameMapping = stableJson(existingPublished.mappingJson) === stableJson(mappingJson);
      if (publishedIsSameRealFile && publishedHasSameMapping) continue;
    }

    const agg = await prisma.documentTemplateVersion.aggregate({
      where: { templateId: template.id },
      _max: { versionNumber: true },
    });
    const versionNumber = (agg._max.versionNumber ?? 0) + 1;

    const sourceStorageKey = templateVersionSourceKey({
      companyId,
      templateId: template.id,
      versionNumber,
    });
    await putStorage(sourceStorageKey, buf, contentTypeForExtension(sourceStorageKey));

    await prisma.documentTemplateVersion.updateMany({
      where: { templateId: template.id },
      data: { isPublished: false },
    });

    await prisma.documentTemplateVersion.create({
      data: {
        templateId: template.id,
        versionNumber,
        sourceStorageKey,
        originalFilename: entry.filename,
        detectedPlaceholders: detection.placeholders,
        detectedBlankFields: detection.blankFields,
        detectionMode: detection.detectionMode,
        mappingJson,
        isMapped: true,
        isPublished: true,
        changelog: "Shabllon real nga templates/contracts/ me mapim automatik nga manifest.json.",
      },
    });

    seeded += 1;
    console.log(
      `[contracts:seed] ${entry.name} → company ${companyId} (v${versionNumber}, ${detection.blankFields.length} blanks, mapped)`,
    );
  }

  return seeded;
}

async function seedContractTemplates(prisma) {
  console.log(`[contracts:seed] storage: ${describeStorage()}`);
  const companies = await prisma.company.findMany({ select: { id: true } });
  if (companies.length === 0) return 0;

  let total = 0;
  for (const c of companies) {
    total += await seedContractTemplatesForCompany(prisma, c.id);
  }
  if (total > 0) {
    console.log(`[contracts:seed] Seeded ${total} mapped published template version(s).`);
  }
  return total;
}

module.exports = { seedContractTemplates, seedContractTemplatesForCompany };
