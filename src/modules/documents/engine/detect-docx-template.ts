import type { DocumentTemplateSubtype } from "@prisma/client";
import PizZip from "pizzip";
import type { DetectedBlankField, DocxTemplateDetectionResult } from "../types/template-mapping";

const XML_PART = /^word\/(document\d*|header\d*|footer\d*)\.xml$/i;
const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
const BLANK_RE = /_{4,}/g;
const PARAGRAPH_RE = /<w:p[\s>][\s\S]*?<\/w:p>/g;

/** Suggested keys for bundled contract templates (UI hints only). */
const SUGGESTED_CAKTUAR: string[] = [
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

const SUGGESTED_PACAKTUAR: string[] = [
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

export function suggestBlankFieldKey(params: {
  templateSubtype?: DocumentTemplateSubtype | null;
  index: number;
}): string | null {
  const list =
    params.templateSubtype === "AFAT_I_CAKTUAR"
      ? SUGGESTED_CAKTUAR
      : params.templateSubtype === "AFAT_I_PACAKTUAR"
        ? SUGGESTED_PACAKTUAR
        : null;
  if (!list) return null;
  return list[params.index - 1] ?? null;
}

function stripXml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function paragraphPreview(paragraphXml: string, maxLen = 120): string {
  const plain = stripXml(paragraphXml);
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen - 1)}…`;
}

function extractParagraphTexts(xml: string): string[] {
  return [...xml.matchAll(PARAGRAPH_RE)].map((m) => m[0]!);
}

function mergedParagraphText(paragraphXml: string): string {
  const parts: string[] = [];
  for (const m of paragraphXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)) {
    parts.push(m[1] ?? "");
  }
  return parts.join("");
}

function sortedXmlPartNames(zip: PizZip): string[] {
  return Object.keys(zip.files)
    .filter((name) => {
      const file = zip.files[name];
      return Boolean(file && !file.dir && XML_PART.test(name));
    })
    .sort();
}

function detectPlaceholdersInXml(xml: string): string[] {
  const found = new Set<string>();
  for (const m of xml.matchAll(PLACEHOLDER_RE)) {
    found.add(m[1]!);
  }
  return [...found].sort();
}

function detectBlanksInXmlPart(
  xmlPart: string,
  xml: string,
  startIndex: number,
  templateSubtype?: DocumentTemplateSubtype | null,
): { blanks: DetectedBlankField[]; nextIndex: number } {
  const blanks: DetectedBlankField[] = [];
  let index = startIndex;

  for (const paragraphXml of extractParagraphTexts(xml)) {
    const merged = mergedParagraphText(paragraphXml);
    for (const m of merged.matchAll(BLANK_RE)) {
      index += 1;
      blanks.push({
        index,
        xmlPart,
        originalText: m[0]!,
        paragraphPreview: paragraphPreview(paragraphXml),
        suggestedKey: suggestBlankFieldKey({ templateSubtype, index }),
      });
    }
  }

  return { blanks, nextIndex: index };
}

export function detectDocxTemplate(
  docxBuffer: Buffer,
  options?: { templateSubtype?: DocumentTemplateSubtype | null },
): DocxTemplateDetectionResult {
  const zip = new PizZip(docxBuffer);
  const partNames = sortedXmlPartNames(zip);
  if (partNames.length === 0) {
    throw new Error("DOCX has no word document/header/footer XML parts.");
  }

  const placeholderSet = new Set<string>();
  const blankFields: DetectedBlankField[] = [];
  let blankIndex = 0;

  for (const name of partNames) {
    const xml = zip.files[name]!.asText();
    for (const key of detectPlaceholdersInXml(xml)) {
      placeholderSet.add(key);
    }
    const { blanks, nextIndex } = detectBlanksInXmlPart(
      name,
      xml,
      blankIndex,
      options?.templateSubtype,
    );
    blankFields.push(...blanks);
    blankIndex = nextIndex;
  }

  const placeholders = [...placeholderSet].sort();
  const hasPlaceholders = placeholders.length > 0;
  const hasBlanks = blankFields.length > 0;

  let detectionMode: DocxTemplateDetectionResult["detectionMode"];
  if (hasPlaceholders && hasBlanks) detectionMode = "MIXED";
  else if (hasBlanks) detectionMode = "BLANK_FIELDS";
  else if (hasPlaceholders) detectionMode = "PLACEHOLDER";
  else {
    throw new Error("Shablloni nuk përmban as placeholder {{key}} as fusha bosh (____).");
  }

  return { placeholders, blankFields, detectionMode };
}

/** Node/CJS bridge for seed scripts. */
export function detectDocxTemplateFromBuffer(
  docxBuffer: Buffer,
  templateSubtype?: string | null,
): DocxTemplateDetectionResult {
  return detectDocxTemplate(docxBuffer, {
    templateSubtype: templateSubtype as DocumentTemplateSubtype | null | undefined,
  });
}
