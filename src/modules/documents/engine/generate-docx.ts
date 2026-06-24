import type { TemplateDetectionMode } from "@prisma/client";
import { generateDocumentFromTemplate } from "./generate-document-from-template";
import type { PlaceholderDefinition } from "./placeholders/registry";
import { renderDocxTemplate } from "./render/docx-render";
import { fillMappedBlankFieldsInDocx } from "./render/paragraph-blank-replacer";
import { fillUnderlineBlanksInDocx, underlineFieldOrderFromJson } from "./render/underline-blank-filler";
import { parseMappingJson } from "../validators/document-template-validator";

export interface GenerateDocxParams {
  templateDocxBuffer: Buffer;
  detectionMode: TemplateDetectionMode | null;
  mappingJson: unknown;
  detectedPlaceholders: string[] | null;
  underlineFieldOrder?: unknown;
  values: Record<string, string>;
  manualOverrides?: Record<string, string>;
  placeholderRegistry: Record<string, PlaceholderDefinition>;
}

export interface GenerateDocxResult {
  buffer: Buffer;
  detectedKeys: string[];
}

export function generateDocxFromTemplate(params: GenerateDocxParams): GenerateDocxResult {
  const manual = params.manualOverrides ?? {};
  const mergedValues = { ...params.values, ...manual };
  const mapping = parseMappingJson(params.mappingJson);
  const mode = params.detectionMode;
  let buffer = params.templateDocxBuffer;
  const detectedKeys: string[] = [];

  const usePlaceholders =
    mode === "PLACEHOLDER" ||
    mode === "MIXED" ||
    (!mode && (params.detectedPlaceholders?.length ?? 0) > 0);

  const useBlanks =
    mode === "BLANK_FIELDS" ||
    mode === "MIXED" ||
    (mapping != null && mapping.blankFields.length > 0);

  if (usePlaceholders) {
    const keys = params.detectedPlaceholders ?? [];
    if (keys.length > 0) {
      const rendered = generateDocumentFromTemplate({
        templateDocxBuffer: buffer,
        detectedPlaceholderKeys: keys,
        autoContext: mergedValues,
        manualOverrides: manual,
        placeholderRegistry: params.placeholderRegistry,
      });
      buffer = rendered.buffer;
      detectedKeys.push(...rendered.detectedKeys);
    } else {
      buffer = renderDocxTemplate(buffer, mergedValues);
    }
  }

  if (useBlanks && mapping && mapping.blankFields.length > 0) {
    buffer = fillMappedBlankFieldsInDocx(buffer, mapping.blankFields, mergedValues);
    for (const b of mapping.blankFields) {
      if (!detectedKeys.includes(b.placeholderKey)) detectedKeys.push(b.placeholderKey);
    }
  } else {
    const legacyOrder = underlineFieldOrderFromJson(params.underlineFieldOrder);
    if (legacyOrder && legacyOrder.length > 0) {
      buffer = fillUnderlineBlanksInDocx(buffer, legacyOrder, mergedValues);
      detectedKeys.push(...legacyOrder);
    }
  }

  return { buffer, detectedKeys: [...new Set(detectedKeys)] };
}
