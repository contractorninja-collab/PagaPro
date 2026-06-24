-- Pushimet: operational leave workflow schema evolution (LeaveType remap, balances, documents, payroll metadata).

-- -----------------------------------------------------------------------------
-- 1) leave_requests — rename note → reason, add workflow & payroll fields
-- -----------------------------------------------------------------------------

ALTER TABLE "leave_requests" RENAME COLUMN "note" TO "reason";

ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "totalDays" DECIMAL(8,2);
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "workingDays" DECIMAL(8,2);
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "totalHours" DECIMAL(10,2);
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "isPaid" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "affectsPayroll" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_requests_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "leave_requests"
      ADD CONSTRAINT "leave_requests_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "leave_requests_createdByUserId_idx" ON "leave_requests" ("createdByUserId");

-- -----------------------------------------------------------------------------
-- 2) Remap LeaveType enum (preserve rows)
-- -----------------------------------------------------------------------------

CREATE TYPE "LeaveType_new" AS ENUM (
  'PUSHIM_VJETOR',
  'PUSHIM_MJEKESOR',
  'PUSHIM_PERSONAL',
  'PUSHIM_PA_PAGESE',
  'PUSHIM_LEHONIE',
  'TJETER'
);

ALTER TABLE "leave_requests" ALTER COLUMN "type" DROP DEFAULT;

ALTER TABLE "leave_requests"
  ALTER COLUMN "type" TYPE "LeaveType_new"
  USING (
    CASE "type"::text
      WHEN 'ANNUAL' THEN 'PUSHIM_VJETOR'::"LeaveType_new"
      WHEN 'SICK' THEN 'PUSHIM_MJEKESOR'::"LeaveType_new"
      WHEN 'UNPAID' THEN 'PUSHIM_PA_PAGESE'::"LeaveType_new"
      WHEN 'MATERNITY_PATERNITY' THEN 'PUSHIM_LEHONIE'::"LeaveType_new"
      WHEN 'OTHER' THEN 'TJETER'::"LeaveType_new"
      ELSE 'TJETER'::"LeaveType_new"
    END
  );

DROP TYPE "LeaveType";

ALTER TYPE "LeaveType_new" RENAME TO "LeaveType";

ALTER TABLE "leave_requests" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"LeaveRequestStatus";

UPDATE "leave_requests" SET "isPaid" = false WHERE "type"::text = 'PUSHIM_PA_PAGESE';

UPDATE "leave_requests"
SET "affectsPayroll" = CASE
  WHEN "status"::text IN ('CANCELLED', 'REJECTED', 'DRAFT', 'PENDING') THEN false
  WHEN "status"::text = 'APPROVED' THEN true
  ELSE false
END;

-- -----------------------------------------------------------------------------
-- 3) leave_balances
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "leave_balances" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "leaveType" "LeaveType" NOT NULL,
  "year" INTEGER NOT NULL,
  "yearlyQuota" DECIMAL(8,2) NOT NULL,
  "usedDays" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "remainingDays" DECIMAL(8,2) NOT NULL,
  "carryOverDays" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "leave_balances_companyId_employeeId_leaveType_year_key"
  ON "leave_balances" ("companyId", "employeeId", "leaveType", "year");

CREATE INDEX IF NOT EXISTS "leave_balances_companyId_employeeId_idx" ON "leave_balances" ("companyId", "employeeId");
CREATE INDEX IF NOT EXISTS "leave_balances_companyId_year_idx" ON "leave_balances" ("companyId", "year");
CREATE INDEX IF NOT EXISTS "leave_balances_employeeId_year_idx" ON "leave_balances" ("employeeId", "year");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_balances_companyId_fkey') THEN
    ALTER TABLE "leave_balances"
      ADD CONSTRAINT "leave_balances_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_balances_employeeId_fkey') THEN
    ALTER TABLE "leave_balances"
      ADD CONSTRAINT "leave_balances_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4) leave_documents
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "leave_documents" (
  "id" TEXT NOT NULL,
  "leaveRequestId" TEXT NOT NULL,
  "generatedDocumentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leave_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "leave_documents_leaveRequestId_generatedDocumentId_key"
  ON "leave_documents" ("leaveRequestId", "generatedDocumentId");

CREATE INDEX IF NOT EXISTS "leave_documents_generatedDocumentId_idx" ON "leave_documents" ("generatedDocumentId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_documents_leaveRequestId_fkey') THEN
    ALTER TABLE "leave_documents"
      ADD CONSTRAINT "leave_documents_leaveRequestId_fkey"
      FOREIGN KEY ("leaveRequestId") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_documents_generatedDocumentId_fkey') THEN
    ALTER TABLE "leave_documents"
      ADD CONSTRAINT "leave_documents_generatedDocumentId_fkey"
      FOREIGN KEY ("generatedDocumentId") REFERENCES "document_generation_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5) Supplementary indexes on leave_requests (operational dashboards / filters)
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "leave_requests_companyId_type_idx" ON "leave_requests" ("companyId", "type");
CREATE INDEX IF NOT EXISTS "leave_requests_startDate_idx" ON "leave_requests" ("startDate");
CREATE INDEX IF NOT EXISTS "leave_requests_endDate_idx" ON "leave_requests" ("endDate");
CREATE INDEX IF NOT EXISTS "leave_requests_employeeId_startDate_idx" ON "leave_requests" ("employeeId", "startDate");
