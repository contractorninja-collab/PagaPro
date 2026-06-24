import type { DocumentTemplateVersion, TemplateDetectionMode } from "@prisma/client";
import { isCanonicalPlaceholderKey } from "../engine/placeholders/registry";
import type {
  PlaceholderValidationError,
  TemplateMappingJson,
} from "../types/template-mapping";

export function assertDocxFilename(filename: string): void {
  if (!filename.toLowerCase().endsWith(".docx")) {
    throw new Error("Skedari duhet të jetë .docx");
  }
}

export function parseMappingJson(value: unknown): TemplateMappingJson | null {
  if (value == null || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const blankFields = Array.isArray(obj.blankFields)
    ? obj.blankFields
        .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
        .map((x) => ({
          index: Number(x.index),
          placeholderKey: String(x.placeholderKey ?? ""),
          label: x.label != null ? String(x.label) : undefined,
          required: x.required === true,
          fallback: x.fallback != null ? String(x.fallback) : undefined,
        }))
        .filter((x) => x.index > 0 && x.placeholderKey.length > 0)
    : [];
  const placeholders = Array.isArray(obj.placeholders)
    ? obj.placeholders
        .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
        .map((x) => ({
          key: String(x.key ?? ""),
          required: x.required === true,
          fallback: x.fallback != null ? String(x.fallback) : undefined,
        }))
        .filter((x) => x.key.length > 0)
    : [];
  return { blankFields, placeholders };
}

export function assertTemplateReadyForGeneration(version: {
  isMapped: boolean;
  detectionMode: TemplateDetectionMode | null;
  mappingJson: unknown;
  isPublished?: boolean;
}): void {
  const mode = version.detectionMode;
  if (mode === "BLANK_FIELDS" || mode === "MIXED") {
    if (!version.isMapped) {
      throw new Error("Shablloni ka fusha bosh — plotësoni mapimin para gjenerimit.");
    }
    const mapping = parseMappingJson(version.mappingJson);
    if (!mapping || mapping.blankFields.length === 0) {
      throw new Error("Mapimi i fushave bosh mungon ose është i pavlefshëm.");
    }
  }
}

export function validateMappingJson(
  mapping: TemplateMappingJson,
  detectedBlankCount: number,
  detectedPlaceholders: string[],
): string[] {
  const errors: string[] = [];
  const mappedIndexes = new Set(mapping.blankFields.map((b) => b.index));
  for (let i = 1; i <= detectedBlankCount; i += 1) {
    if (!mappedIndexes.has(i)) {
      errors.push(`Fusha ${i} nuk është mapuar.`);
    }
  }
  for (const b of mapping.blankFields) {
    if (!b.placeholderKey.trim()) {
      errors.push(`Fusha ${b.index}: zgjidhni një çelës placeholder.`);
    }
  }
  for (const key of detectedPlaceholders) {
    const row = mapping.placeholders.find((p) => p.key === key);
    if (!row && mapping.placeholders.length > 0 && !mapping.placeholders.some((p) => p.key === key)) {
      /* optional rows — only validate explicitly listed placeholders */
    }
  }
  return errors;
}

export function validateResolvedValues(
  mapping: TemplateMappingJson | null,
  values: Record<string, string>,
  registryKeys?: Set<string>,
): PlaceholderValidationError[] {
  const errors: PlaceholderValidationError[] = [];
  if (!mapping) return errors;

  for (const blank of mapping.blankFields) {
    const required = blank.required !== false;
    const raw = values[blank.placeholderKey]?.trim() || blank.fallback?.trim() || "";
    if (required && !raw) {
      errors.push({
        key: blank.placeholderKey,
        label: blank.label || blank.placeholderKey,
        message: `Fusha ${blank.index} (${blank.label || blank.placeholderKey}) mungon.`,
      });
    }
    if (registryKeys && !registryKeys.has(blank.placeholderKey) && !isCanonicalPlaceholderKey(blank.placeholderKey)) {
      /* allow custom keys with fallback */
    }
  }

  for (const ph of mapping.placeholders) {
    if (!ph.required) continue;
    const raw = values[ph.key]?.trim() || ph.fallback?.trim() || "";
    if (!raw) {
      errors.push({
        key: ph.key,
        label: ph.key,
        message: `Placeholder i detyrueshëm "${ph.key}" mungon.`,
      });
    }
  }

  return errors;
}

export function autoMappedForPlaceholderOnly(params: {
  detectionMode: TemplateDetectionMode;
  placeholders: string[];
}): boolean {
  if (params.detectionMode !== "PLACEHOLDER") return false;
  return params.placeholders.every((k) => isCanonicalPlaceholderKey(k));
}

export function buildDefaultPlaceholderMapping(placeholders: string[]): TemplateMappingJson {
  return {
    blankFields: [],
    placeholders: placeholders.map((key) => ({
      key,
      required: isCanonicalPlaceholderKey(key),
      fallback: "",
    })),
  };
}

export function versionBlankCount(version: DocumentTemplateVersion): number {
  const blanks = version.detectedBlankFields;
  if (Array.isArray(blanks)) return blanks.length;
  return 0;
}
