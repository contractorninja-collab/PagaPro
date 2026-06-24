-- Template detection + mapping fields for DOCX blank-field templates.

CREATE TYPE "TemplateDetectionMode" AS ENUM ('PLACEHOLDER', 'BLANK_FIELDS', 'MIXED');

ALTER TABLE "document_template_versions" ADD COLUMN IF NOT EXISTS "detectionMode" "TemplateDetectionMode";
ALTER TABLE "document_template_versions" ADD COLUMN IF NOT EXISTS "detectedBlankFields" JSONB;
ALTER TABLE "document_template_versions" ADD COLUMN IF NOT EXISTS "mappingJson" JSONB;
ALTER TABLE "document_template_versions" ADD COLUMN IF NOT EXISTS "isMapped" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "placeholder_registry" ADD COLUMN IF NOT EXISTS "sourcePath" TEXT;
ALTER TABLE "placeholder_registry" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Backfill mappingJson from legacy underlineFieldOrder (ordered key list).
UPDATE "document_template_versions"
SET
  "detectionMode" = 'BLANK_FIELDS',
  "isMapped" = true,
  "mappingJson" = jsonb_build_object(
    'blankFields',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'index', ord,
            'placeholderKey', key,
            'label', key,
            'required', true,
            'fallback', ''
          )
          ORDER BY ord
        )
        FROM (
          SELECT ordinality AS ord, value AS key
          FROM jsonb_array_elements_text("underlineFieldOrder") WITH ORDINALITY AS t(value, ordinality)
        ) sub
      ),
      '[]'::jsonb
    ),
    'placeholders', '[]'::jsonb
  )
WHERE "underlineFieldOrder" IS NOT NULL
  AND jsonb_typeof("underlineFieldOrder") = 'array'
  AND jsonb_array_length("underlineFieldOrder") > 0
  AND "mappingJson" IS NULL;
