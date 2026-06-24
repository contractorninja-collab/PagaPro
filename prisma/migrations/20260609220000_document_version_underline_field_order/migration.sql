-- Add underlineFieldOrder to document_template_versions for ordered blank-fill contract templates.
ALTER TABLE "document_template_versions" ADD COLUMN IF NOT EXISTS "underlineFieldOrder" JSONB;
