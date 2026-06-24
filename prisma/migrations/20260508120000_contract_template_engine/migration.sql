-- Contract template engine (DOCX placeholders, settings, employee address)
-- Apply after baseline migrations exist.

CREATE TYPE "ContractTemplateCategory" AS ENUM ('AFAT_I_CAKTUAR', 'AFAT_I_PACAKTUAR', 'KONTRATE_SPECIFIKE');
CREATE TYPE "ContractTemplateSourceFormat" AS ENUM ('DOCX', 'HTML_LEGACY', 'PDF');
CREATE TYPE "ContractGenerationStatus" AS ENUM ('PENDING', 'RENDERING', 'SUCCEEDED', 'FAILED');

ALTER TABLE "company_settings" ADD COLUMN "authorizedRepresentativeName" TEXT;
ALTER TABLE "company_settings" ADD COLUMN "authorizedRepresentativePosition" TEXT;
ALTER TABLE "company_settings" ADD COLUMN "authorizedSignatureStorageKey" TEXT;
ALTER TABLE "company_settings" ADD COLUMN "companyAddressLine" TEXT;

ALTER TABLE "employees" ADD COLUMN "addressLine" TEXT;
ALTER TABLE "employees" ADD COLUMN "addressCity" TEXT;
ALTER TABLE "employees" ADD COLUMN "addressCountry" TEXT DEFAULT 'XK';

ALTER TABLE "contract_templates" ADD COLUMN "category" "ContractTemplateCategory" NOT NULL DEFAULT 'AFAT_I_CAKTUAR';
ALTER TABLE "contract_templates" ADD COLUMN "sourceFormat" "ContractTemplateSourceFormat" NOT NULL DEFAULT 'DOCX';
ALTER TABLE "contract_templates" ADD COLUMN "sourceStorageKey" TEXT;
ALTER TABLE "contract_templates" ADD COLUMN "originalFilename" TEXT;
ALTER TABLE "contract_templates" ADD COLUMN "detectedPlaceholders" JSONB;
ALTER TABLE "contract_templates" ADD COLUMN "placeholderSchemaVersion" TEXT NOT NULL DEFAULT 'v1';
ALTER TABLE "contract_templates" ALTER COLUMN "bodyHtml" DROP NOT NULL;

ALTER TABLE "contracts" ADD COLUMN "generatedDocxStorageKey" TEXT;
ALTER TABLE "contracts" ADD COLUMN "generationStatus" "ContractGenerationStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "contracts" ADD COLUMN "generationError" TEXT;

CREATE INDEX "contract_templates_companyId_category_idx" ON "contract_templates"("companyId", "category");

-- Existing HTML-only templates: mark format explicitly (run once per deployment data)
-- UPDATE "contract_templates" SET "sourceFormat" = 'HTML_LEGACY' WHERE "sourceStorageKey" IS NULL AND "bodyHtml" IS NOT NULL;
