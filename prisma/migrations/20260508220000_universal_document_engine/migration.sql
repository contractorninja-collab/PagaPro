-- Universal document engine: rename contract-named templates/artifacts to Document*,
-- polymorphic artifact subjects, DisciplinaryWarning.

CREATE TYPE "DocumentCategory" AS ENUM ('CONTRACT', 'LEAVE', 'TERMINATION', 'WARNING');
CREATE TYPE "DocumentSubjectKind" AS ENUM ('CONTRACT', 'LEAVE', 'TERMINATION', 'WARNING');

CREATE TYPE "DisciplinaryWarningStatus" AS ENUM ('DRAFT', 'ISSUED', 'VOID');

-- Rename enums used by templates / artifacts (values unchanged where applicable)
ALTER TYPE "ContractTemplateCategory" RENAME TO "DocumentTemplateSubtype";
ALTER TYPE "ContractTemplateSourceFormat" RENAME TO "DocumentSourceFormat";
ALTER TYPE "ContractGenerationStatus" RENAME TO "DocumentGenerationStatus";
ALTER TYPE "ContractGenerationArtifactKind" RENAME TO "DocumentGenerationArtifactKind";

-- ---------------------------------------------------------------------------
-- Templates + versions
-- ---------------------------------------------------------------------------

ALTER TABLE "contract_templates" RENAME TO "document_templates";
ALTER TABLE "contract_template_versions" RENAME TO "document_template_versions";

ALTER TABLE "document_templates"
  ADD COLUMN "documentCategory" "DocumentCategory" NOT NULL DEFAULT 'CONTRACT';

ALTER TABLE "document_templates" RENAME COLUMN "kind" TO "contractKind";
ALTER TABLE "document_templates" ALTER COLUMN "contractKind" DROP NOT NULL;

ALTER TABLE "document_templates" RENAME COLUMN "category" TO "templateSubtype";

DROP INDEX IF EXISTS "contract_templates_companyId_category_idx";
CREATE INDEX "document_templates_companyId_documentCategory_idx" ON "document_templates"("companyId", "documentCategory");

ALTER INDEX "contract_template_versions_templateId_versionNumber_key"
  RENAME TO "document_template_versions_templateId_versionNumber_key";
ALTER INDEX "contract_template_versions_templateId_isPublished_idx"
  RENAME TO "document_template_versions_templateId_isPublished_idx";

-- ---------------------------------------------------------------------------
-- Contracts → documentTemplate* FK columns
-- ---------------------------------------------------------------------------

ALTER TABLE "contracts" RENAME COLUMN "templateId" TO "documentTemplateId";
ALTER TABLE "contracts" RENAME COLUMN "templateVersionId" TO "documentTemplateVersionId";

ALTER INDEX "contracts_templateVersionId_idx" RENAME TO "contracts_documentTemplateVersionId_idx";

-- ---------------------------------------------------------------------------
-- Generation artifacts: polymorphic subject + category
-- ---------------------------------------------------------------------------

ALTER TABLE "contract_generation_artifacts"
  ADD COLUMN "subjectKind" "DocumentSubjectKind" NOT NULL DEFAULT 'CONTRACT';

ALTER TABLE "contract_generation_artifacts" ADD COLUMN "subjectId" TEXT;
UPDATE "contract_generation_artifacts" SET "subjectId" = "contractId" WHERE "subjectId" IS NULL;
ALTER TABLE "contract_generation_artifacts" ALTER COLUMN "subjectId" SET NOT NULL;

ALTER TABLE "contract_generation_artifacts"
  ADD COLUMN "documentCategory" "DocumentCategory" NOT NULL DEFAULT 'CONTRACT';

ALTER TABLE "contract_generation_artifacts" DROP CONSTRAINT "contract_generation_artifacts_contractId_fkey";
ALTER TABLE "contract_generation_artifacts" DROP COLUMN "contractId";

DROP INDEX IF EXISTS "contract_generation_artifacts_contractId_createdAt_idx";
DROP INDEX IF EXISTS "contract_generation_artifacts_contractId_kind_idx";

CREATE INDEX "contract_generation_artifacts_subjectKind_subjectId_createdAt_idx"
  ON "contract_generation_artifacts"("subjectKind", "subjectId", "createdAt");
CREATE INDEX "contract_generation_artifacts_subjectKind_subjectId_kind_idx"
  ON "contract_generation_artifacts"("subjectKind", "subjectId", "kind");

DROP INDEX IF EXISTS "contract_generation_artifacts_one_final_per_contract";

CREATE UNIQUE INDEX "contract_generation_artifacts_one_final_per_subject"
  ON "contract_generation_artifacts" ("subjectKind", "subjectId")
  WHERE ("kind" = 'ARCHIVED_FINAL'::"DocumentGenerationArtifactKind");

ALTER TABLE "contract_generation_artifacts" RENAME TO "document_generation_artifacts";

ALTER INDEX "contract_generation_artifacts_templateVersionId_idx"
  RENAME TO "document_generation_artifacts_templateVersionId_idx";
ALTER INDEX "contract_generation_artifacts_subjectKind_subjectId_createdAt_idx"
  RENAME TO "document_generation_artifacts_subjectKind_subjectId_createdAt_idx";
ALTER INDEX "contract_generation_artifacts_subjectKind_subjectId_kind_idx"
  RENAME TO "document_generation_artifacts_subjectKind_subjectId_kind_idx";
ALTER INDEX "contract_generation_artifacts_one_final_per_subject"
  RENAME TO "document_generation_artifacts_one_final_per_subject";

-- ---------------------------------------------------------------------------
-- Disciplinary warnings
-- ---------------------------------------------------------------------------

CREATE TABLE "disciplinary_warnings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT NOT NULL,
    "severity" TEXT,
    "status" "DisciplinaryWarningStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "disciplinary_warnings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "disciplinary_warnings"
  ADD CONSTRAINT "disciplinary_warnings_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "disciplinary_warnings"
  ADD CONSTRAINT "disciplinary_warnings_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "disciplinary_warnings_companyId_idx" ON "disciplinary_warnings"("companyId");
CREATE INDEX "disciplinary_warnings_employeeId_idx" ON "disciplinary_warnings"("employeeId");
CREATE INDEX "disciplinary_warnings_companyId_status_idx" ON "disciplinary_warnings"("companyId", "status");
