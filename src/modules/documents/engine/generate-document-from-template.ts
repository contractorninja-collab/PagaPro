import type { PlaceholderValidationPolicy } from "./validation/validate-placeholders";
import { validatePlaceholdersForRender } from "./validation/validate-placeholders";
import type { PlaceholderDefinition } from "./placeholders/registry";
import { CANONICAL_PLACEHOLDER_REGISTRY } from "./placeholders/registry";
import { detectPlaceholdersInDocxBuffer } from "./placeholders/docx-detect";
import { renderDocxTemplate } from "./render/docx-render";

/** Merge auto-built context with optional manual overrides (later wins). */
export function mergeTemplateContext(
  auto: Record<string, string>,
  manual?: Record<string, string>,
): Record<string, string> {
  return { ...auto, ...(manual ?? {}) };
}

/** @deprecated Use mergeTemplateContext */
export const mergeContractContext = mergeTemplateContext;

export interface GenerateDocumentFromTemplateParams {
  templateDocxBuffer: Buffer;
  /** When omitted, placeholders are scanned from the DOCX XML (word/document*.xml). */
  detectedPlaceholderKeys?: string[];
  autoContext: Record<string, string>;
  manualOverrides?: Record<string, string>;
  validationPolicy?: PlaceholderValidationPolicy;
  /** Defaults to CONTRACT-shaped registry for backward compatibility */
  placeholderRegistry?: Record<string, PlaceholderDefinition>;
}

export interface GenerateDocumentFromTemplateResult {
  buffer: Buffer;
  detectedKeys: string[];
  mergedContext: Record<string, string>;
}

/**
 * Full pipeline: detect → merge → validate → render (pure — persistence left to callers).
 */
export function generateDocumentFromTemplate(
  params: GenerateDocumentFromTemplateParams,
): GenerateDocumentFromTemplateResult {
  const detectedKeys =
    params.detectedPlaceholderKeys ?? detectPlaceholdersInDocxBuffer(params.templateDocxBuffer);

  const mergedContext = mergeTemplateContext(params.autoContext, params.manualOverrides);

  const registry = params.placeholderRegistry ?? CANONICAL_PLACEHOLDER_REGISTRY;

  validatePlaceholdersForRender(detectedKeys, mergedContext, registry, params.validationPolicy);

  const buffer = renderDocxTemplate(params.templateDocxBuffer, mergedContext);

  return { buffer, detectedKeys, mergedContext };
}

/** @deprecated Use generateDocumentFromTemplate */
export function generateContractDocxDocument(
  params: Omit<GenerateDocumentFromTemplateParams, "placeholderRegistry"> &
    Partial<Pick<GenerateDocumentFromTemplateParams, "placeholderRegistry">>,
): GenerateDocumentFromTemplateResult {
  return generateDocumentFromTemplate(params);
}

export function analyzeDocxTemplatePlaceholders(docxBuffer: Buffer): string[] {
  return detectPlaceholdersInDocxBuffer(docxBuffer);
}

/** @deprecated Use GenerateDocumentFromTemplateParams */
export type GenerateContractDocxParams = GenerateDocumentFromTemplateParams;
/** @deprecated Use GenerateDocumentFromTemplateResult */
export type GenerateContractDocxResult = GenerateDocumentFromTemplateResult;
