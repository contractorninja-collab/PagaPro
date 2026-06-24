-- Dokumentet: enum extensions, artifact denormalization, timeline + placeholder registry,
-- drop one-final-per-subject unique index (immutable history + regenerate).

-- AlterEnum (PostgreSQL 16+)
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'PAYROLL';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'OTHER';

ALTER TYPE "DocumentSubjectKind" ADD VALUE IF NOT EXISTS 'PAYROLL';
ALTER TYPE "DocumentSubjectKind" ADD VALUE IF NOT EXISTS 'OTHER';

DROP INDEX IF EXISTS "document_generation_artifacts_one_final_per_subject";

ALTER TABLE "document_generation_artifacts" ADD COLUMN "companyId" TEXT;
ALTER TABLE "document_generation_artifacts" ADD COLUMN "employeeId" TEXT;
ALTER TABLE "document_generation_artifacts" ADD COLUMN "payrollId" TEXT;
ALTER TABLE "document_generation_artifacts" ADD COLUMN "documentTemplateId" TEXT;
ALTER TABLE "document_generation_artifacts" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "document_generation_artifacts" ADD COLUMN "displayFilename" TEXT NOT NULL DEFAULT '';
ALTER TABLE "document_generation_artifacts" ADD COLUMN "snapshotSchemaVersion" TEXT;
ALTER TABLE "document_generation_artifacts" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "document_generation_artifacts" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "document_generation_artifacts" ADD COLUMN "supersedesArtifactId" TEXT;

UPDATE "document_generation_artifacts" AS d
SET
  "companyId" = t."companyId",
  "documentTemplateId" = v."templateId"
FROM "document_template_versions" AS v
INNER JOIN "document_templates" AS t ON t.id = v."templateId"
WHERE v.id = d."templateVersionId";

ALTER TABLE "document_generation_artifacts" ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "document_generation_artifacts"
  ADD CONSTRAINT "document_generation_artifacts_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_generation_artifacts"
  ADD CONSTRAINT "document_generation_artifacts_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "document_generation_artifacts"
  ADD CONSTRAINT "document_generation_artifacts_payrollId_fkey"
  FOREIGN KEY ("payrollId") REFERENCES "payrolls" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "document_generation_artifacts"
  ADD CONSTRAINT "document_generation_artifacts_documentTemplateId_fkey"
  FOREIGN KEY ("documentTemplateId") REFERENCES "document_templates" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "document_generation_artifacts"
  ADD CONSTRAINT "document_generation_artifacts_supersedesArtifactId_fkey"
  FOREIGN KEY ("supersedesArtifactId") REFERENCES "document_generation_artifacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "document_generation_artifacts_companyId_idx"
  ON "document_generation_artifacts" ("companyId");

CREATE INDEX "document_generation_artifacts_companyId_documentCategory_idx"
  ON "document_generation_artifacts" ("companyId", "documentCategory");

CREATE INDEX "document_generation_artifacts_companyId_employeeId_createdAt_idx"
  ON "document_generation_artifacts" ("companyId", "employeeId", "createdAt");

CREATE INDEX "document_generation_artifacts_companyId_createdAt_idx"
  ON "document_generation_artifacts" ("companyId", "createdAt");

CREATE INDEX "document_generation_artifacts_companyId_payrollId_idx"
  ON "document_generation_artifacts" ("companyId", "payrollId");

CREATE INDEX "document_generation_artifacts_documentTemplateId_idx"
  ON "document_generation_artifacts" ("documentTemplateId");

CREATE TABLE "placeholder_registry" (
    "id" TEXT NOT NULL,
    "placeholderKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "exampleValue" TEXT,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "placeholder_registry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "placeholder_registry_placeholderKey_key" ON "placeholder_registry" ("placeholderKey");

CREATE TABLE "document_timeline_events" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT,
    "generatedDocumentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "metadata_json" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "document_timeline_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_timeline_events_companyId_createdAt_idx"
  ON "document_timeline_events" ("companyId", "createdAt");

CREATE INDEX "document_timeline_events_generatedDocumentId_idx"
  ON "document_timeline_events" ("generatedDocumentId");

CREATE INDEX "document_timeline_events_companyId_employeeId_idx"
  ON "document_timeline_events" ("companyId", "employeeId");

ALTER TABLE "document_timeline_events"
  ADD CONSTRAINT "document_timeline_events_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_timeline_events"
  ADD CONSTRAINT "document_timeline_events_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "document_timeline_events"
  ADD CONSTRAINT "document_timeline_events_generatedDocumentId_fkey"
  FOREIGN KEY ("generatedDocumentId") REFERENCES "document_generation_artifacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_timeline_events"
  ADD CONSTRAINT "document_timeline_events_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
