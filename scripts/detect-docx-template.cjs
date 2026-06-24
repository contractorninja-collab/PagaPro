/**
 * CJS mirror of detect-docx-template.ts for seed/validate scripts.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const PizZip = require("pizzip");

const XML_PART = /^word\/(document\d*|header\d*|footer\d*)\.xml$/i;
const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
const BLANK_RE = /_{4,}/g;
const PARAGRAPH_RE = /<w:p[\s>][\s\S]*?<\/w:p>/g;

const SUGGESTED_CAKTUAR = [
  "company_name",
  "authorized_person_name",
  "employee_name",
  "employee_position",
  "company_address",
  "contract_start_date",
  "contract_end_date",
  "employment_start_date",
  "probation_end_date",
  "daily_hours",
  "weekly_hours",
  "salary_gross",
  "travel_compensation",
  "document_date",
  "document_place",
  "authorized_person_name",
  "employee_name",
];

const SUGGESTED_PACAKTUAR = [
  "company_name",
  "authorized_person_name",
  "employee_name",
  "employee_position",
  "company_address",
  "contract_start_date",
  "employment_start_date",
  "probation_end_date",
  "daily_hours",
  "weekly_hours",
  "salary_gross",
  "travel_compensation",
  "document_date",
  "document_place",
  "authorized_person_name",
  "employee_name",
];

function suggestKey(templateSubtype, index) {
  const list =
    templateSubtype === "AFAT_I_CAKTUAR"
      ? SUGGESTED_CAKTUAR
      : templateSubtype === "AFAT_I_PACAKTUAR"
        ? SUGGESTED_PACAKTUAR
        : null;
  return list ? list[index - 1] ?? null : null;
}

function stripXml(text) {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function paragraphPreview(paragraphXml, maxLen = 120) {
  const plain = stripXml(paragraphXml);
  return plain.length <= maxLen ? plain : `${plain.slice(0, maxLen - 1)}…`;
}

function mergedParagraphText(paragraphXml) {
  const parts = [];
  for (const m of paragraphXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)) {
    parts.push(m[1] ?? "");
  }
  return parts.join("");
}

function detectDocxTemplateBuffer(buf, templateSubtype) {
  const zip = new PizZip(buf);
  const partNames = Object.keys(zip.files)
    .filter((name) => {
      const file = zip.files[name];
      return file && !file.dir && XML_PART.test(name);
    })
    .sort();

  const placeholderSet = new Set();
  const blankFields = [];
  let blankIndex = 0;

  for (const name of partNames) {
    const xml = zip.files[name].asText();
    for (const m of xml.matchAll(PLACEHOLDER_RE)) {
      placeholderSet.add(m[1]);
    }
    for (const paragraphXml of xml.match(PARAGRAPH_RE) ?? []) {
      const merged = mergedParagraphText(paragraphXml);
      for (const m of merged.match(BLANK_RE) ?? []) {
        blankIndex += 1;
        blankFields.push({
          index: blankIndex,
          xmlPart: name,
          originalText: m,
          paragraphPreview: paragraphPreview(paragraphXml),
          suggestedKey: suggestKey(templateSubtype, blankIndex),
        });
      }
    }
  }

  const placeholders = [...placeholderSet].sort();
  const hasP = placeholders.length > 0;
  const hasB = blankFields.length > 0;
  let detectionMode;
  if (hasP && hasB) detectionMode = "MIXED";
  else if (hasB) detectionMode = "BLANK_FIELDS";
  else if (hasP) detectionMode = "PLACEHOLDER";
  else throw new Error("No placeholders or blanks detected");

  return { placeholders, blankFields, detectionMode };
}

module.exports = { detectDocxTemplateBuffer };
