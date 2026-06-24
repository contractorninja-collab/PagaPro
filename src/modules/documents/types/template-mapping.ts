import type { TemplateDetectionMode } from "@prisma/client";

export interface DetectedBlankField {
  index: number;
  xmlPart: string;
  originalText: string;
  paragraphPreview: string;
  suggestedKey?: string | null;
}

export interface BlankFieldMapping {
  index: number;
  placeholderKey: string;
  label?: string;
  required?: boolean;
  fallback?: string;
}

export interface PlaceholderFieldMapping {
  key: string;
  required?: boolean;
  fallback?: string;
}

export interface TemplateMappingJson {
  blankFields: BlankFieldMapping[];
  placeholders: PlaceholderFieldMapping[];
}

export interface DocxTemplateDetectionResult {
  placeholders: string[];
  blankFields: DetectedBlankField[];
  detectionMode: TemplateDetectionMode;
}

export interface PlaceholderValidationError {
  key: string;
  label: string;
  message: string;
}
