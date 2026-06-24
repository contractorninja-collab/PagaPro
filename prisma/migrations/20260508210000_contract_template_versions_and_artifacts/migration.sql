-- Template versioning + immutable generation artifact history
-- Run after prior contract-template migrations.

CREATE TYPE "ContractGenerationArtifactKind" AS ENUM ('PREVIEW', 'ARCHIVED_FINAL');

CREATE TABLE "contract_template_versions" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "sourceFormat" "ContractTemplateSourceFormat" NOT NULL DEFAULT 'DOCX',
    "sourceStorageKey" TEXT NOT NULL,
    "originalFilename" TEXT,
    "detectedPlaceholders" JSONB,
    "placeholderSchemaVersion" TEXT NOT NULL DEFAULT 'v1',
    "locale" TEXT NOT NULL DEFAULT 'sq',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "changelog" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedByUserId" TEXT,
    CONSTRAINT "contract_template_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contract_template_versions_templateId_versionNumber_key" ON "contract_template_versions"("templateId", "versionNumber");
CREATE INDEX "contract_template_versions_templateId_isPublished_idx" ON "contract_template_versions"("templateId", "isPublished");

ALTER TABLE "contract_template_versions" ADD CONSTRAINT "contract_template_versions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "contract_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_template_versions" ADD CONSTRAINT "contract_template_versions_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill one version per existing template that already had blob metadata
INSERT INTO "contract_template_versions" ("id", "templateId", "versionNumber", "sourceFormat", "sourceStorageKey", "originalFilename", "detectedPlaceholders", "placeholderSchemaVersion", "locale", "isPublished", "changelog", "uploadedAt")
SELECT
  gen_random_uuid()::text,
  ct.id,
  1,
  COALESCE(ct."sourceFormat", 'DOCX'::"ContractTemplateSourceFormat"),
  ct."sourceStorageKey",
  ct."originalFilename",
  ct."detectedPlaceholders",
  COALESCE(ct."placeholderSchemaVersion", 'v1'),
  'sq',
  true,
  'Migrated from legacy ContractTemplate columns',
  ct."createdAt"
FROM "contract_templates" ct
WHERE ct."sourceStorageKey" IS NOT NULL AND length(trim(ct."sourceStorageKey")) > 0;

-- Templates without files: skip — HR uploads first DOCX to create version 1

ALTER TABLE "contract_templates" DROP COLUMN IF EXISTS "sourceFormat";
ALTER TABLE "contract_templates" DROP COLUMN IF EXISTS "sourceStorageKey";
ALTER TABLE "contract_templates" DROP COLUMN IF EXISTS "originalFilename";
ALTER TABLE "contract_templates" DROP COLUMN IF EXISTS "detectedPlaceholders";
ALTER TABLE "contract_templates" DROP COLUMN IF EXISTS "placeholderSchemaVersion";

ALTER TABLE "contracts" DROP COLUMN IF EXISTS "generatedDocxStorageKey";

ALTER TABLE "contracts" ADD COLUMN "templateVersionId" TEXT;

ALTER TABLE "contracts" ADD CONSTRAINT "contracts_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "contract_template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "contracts_templateVersionId_idx" ON "contracts"("templateVersionId");

CREATE TABLE "contract_generation_artifacts" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "kind" "ContractGenerationArtifactKind" NOT NULL,
    "mergedPayload" JSONB NOT NULL,
    "detectedPlaceholderKeys" JSONB,
    "generatedDocxStorageKey" TEXT,
    "generatedPdfStorageKey" TEXT,
    "docxSha256" TEXT,
    "pdfSha256" TEXT,
    "generationStatus" "ContractGenerationStatus" NOT NULL DEFAULT 'SUCCEEDED',
    "generationError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    CONSTRAINT "contract_generation_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contract_generation_artifacts_contractId_createdAt_idx" ON "contract_generation_artifacts"("contractId", "createdAt");
CREATE INDEX "contract_generation_artifacts_contractId_kind_idx" ON "contract_generation_artifacts"("contractId", "kind");
CREATE INDEX "contract_generation_artifacts_templateVersionId_idx" ON "contract_generation_artifacts"("templateVersionId");

ALTER TABLE "contract_generation_artifacts" ADD CONSTRAINT "contract_generation_artifacts_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_generation_artifacts" ADD CONSTRAINT "contract_generation_artifacts_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "contract_template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_generation_artifacts" ADD CONSTRAINT "contract_generation_artifacts_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One immutable ARCHIVED_FINAL snapshot row per contract (PostgreSQL partial unique index)
CREATE UNIQUE INDEX "contract_generation_artifacts_one_final_per_contract" ON "contract_generation_artifacts" ("contractId") WHERE ("kind" = 'ARCHIVED_FINAL'::"ContractGenerationArtifactKind");

UPDATE "contracts" c
SET "templateVersionId" = v.id
FROM "contract_template_versions" v
WHERE c."templateId" = v."templateId"
  AND v."isPublished" = true;