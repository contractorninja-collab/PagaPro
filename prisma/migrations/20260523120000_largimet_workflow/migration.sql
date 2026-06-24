-- Largimet workflow: enum remap + termination expansion + checklist + template key

CREATE TYPE "TerminationType_new" AS ENUM ('LARGIM_VULLNETAR', 'PA_PARALAJMERIM', 'MARREVESHJE_E_DYANSHME', 'NGA_PUNEDHENESI', 'MANUAL');
CREATE TYPE "TerminationStatus_new" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'COMPLETED', 'CANCELLED');

ALTER TABLE "terminations" ADD COLUMN "type_new" "TerminationType_new";
ALTER TABLE "terminations" ADD COLUMN "status_new" "TerminationStatus_new";

UPDATE "terminations" SET "type_new" = CASE "type"::text
  WHEN 'RESIGNATION' THEN 'LARGIM_VULLNETAR'::"TerminationType_new"
  WHEN 'DISMISSAL' THEN 'NGA_PUNEDHENESI'::"TerminationType_new"
  WHEN 'MUTUAL_AGREEMENT' THEN 'MARREVESHJE_E_DYANSHME'::"TerminationType_new"
  ELSE 'MANUAL'::"TerminationType_new"
END;

UPDATE "terminations" SET "status_new" = CASE "status"::text
  WHEN 'INITIATED' THEN 'DRAFT'::"TerminationStatus_new"
  WHEN 'IN_PROGRESS' THEN 'PENDING_REVIEW'::"TerminationStatus_new"
  WHEN 'COMPLETED' THEN 'COMPLETED'::"TerminationStatus_new"
  WHEN 'VOID' THEN 'CANCELLED'::"TerminationStatus_new"
  ELSE 'DRAFT'::"TerminationStatus_new"
END;

ALTER TABLE "terminations" DROP COLUMN "type";
ALTER TABLE "terminations" DROP COLUMN "status";
DROP TYPE "TerminationType";
DROP TYPE "TerminationStatus";

ALTER TYPE "TerminationType_new" RENAME TO "TerminationType";
ALTER TYPE "TerminationStatus_new" RENAME TO "TerminationStatus";

ALTER TABLE "terminations" RENAME COLUMN "type_new" TO "type";
ALTER TABLE "terminations" RENAME COLUMN "status_new" TO "status";

ALTER TABLE "terminations" ALTER COLUMN "type" SET NOT NULL;
ALTER TABLE "terminations" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "terminations" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"TerminationStatus";

ALTER TABLE "terminations" ADD COLUMN "terminationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "terminations" ADD COLUMN "noticeDate" TIMESTAMP(3);
ALTER TABLE "terminations" ADD COLUMN "details" TEXT;
ALTER TABLE "terminations" ADD COLUMN "finalPayrollRequired" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "terminations" ADD COLUMN "finalPayrollId" TEXT;
ALTER TABLE "terminations" ADD COLUMN "generatedDocumentId" TEXT;
ALTER TABLE "terminations" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "terminations" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "terminations" ADD COLUMN "createdById" TEXT;

UPDATE "terminations" SET "terminationDate" = "lastWorkingDay";

ALTER TABLE "terminations" ALTER COLUMN "terminationDate" DROP DEFAULT;

ALTER TABLE "terminations" ADD CONSTRAINT "terminations_finalPayrollId_fkey" FOREIGN KEY ("finalPayrollId") REFERENCES "payrolls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "terminations" ADD CONSTRAINT "terminations_generatedDocumentId_fkey" FOREIGN KEY ("generatedDocumentId") REFERENCES "document_generation_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "terminations" ADD CONSTRAINT "terminations_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "terminations" ADD CONSTRAINT "terminations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "terminations_companyId_status_idx" ON "terminations"("companyId", "status");
CREATE INDEX "terminations_companyId_type_idx" ON "terminations"("companyId", "type");
CREATE INDEX "terminations_companyId_terminationDate_idx" ON "terminations"("companyId", "terminationDate");

CREATE TABLE "termination_checklists" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "terminationId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "termination_checklists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "termination_checklists_terminationId_itemKey_key" ON "termination_checklists"("terminationId", "itemKey");
CREATE INDEX "termination_checklists_companyId_idx" ON "termination_checklists"("companyId");
CREATE INDEX "termination_checklists_terminationId_idx" ON "termination_checklists"("terminationId");

ALTER TABLE "termination_checklists" ADD CONSTRAINT "termination_checklists_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "termination_checklists" ADD CONSTRAINT "termination_checklists_terminationId_fkey" FOREIGN KEY ("terminationId") REFERENCES "terminations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "termination_checklists" ADD CONSTRAINT "termination_checklists_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "document_templates" ADD COLUMN "terminationWorkflowKey" TEXT;

CREATE UNIQUE INDEX "document_templates_companyId_terminationWorkflowKey_key" ON "document_templates"("companyId", "terminationWorkflowKey");
