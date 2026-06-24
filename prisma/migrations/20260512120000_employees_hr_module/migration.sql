-- Employees HR module: personal/payroll flags, required personalId per company, employment history stream.

CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED');

CREATE TYPE "EmployeeHistoryEventKind" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'ARCHIVED', 'TERMINATED');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'EmploymentStatus' AND e.enumlabel = 'INACTIVE'
  ) THEN
    ALTER TYPE "EmploymentStatus" ADD VALUE 'INACTIVE';
  END IF;
END $$;

UPDATE "employees"
SET "personalId" = CONCAT('MIG-', id)
WHERE "personalId" IS NULL OR TRIM(BOTH FROM "personalId") = '';

ALTER TABLE "employees" ALTER COLUMN "personalId" SET NOT NULL;

ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "gender" "Gender",
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "weeklyHours" DECIMAL(6, 2) NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS "applyTrust" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "applyTax" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "bankName" TEXT,
  ADD COLUMN IF NOT EXISTS "internalNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "documentsMissing" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "terminationReason" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "employees_companyId_personalId_key"
  ON "employees" ("companyId", "personalId");

CREATE INDEX IF NOT EXISTS "employees_companyId_employmentType_idx"
  ON "employees" ("companyId", "employmentType");

CREATE INDEX IF NOT EXISTS "employees_companyId_email_idx"
  ON "employees" ("companyId", "email");

CREATE INDEX IF NOT EXISTS "employees_email_idx"
  ON "employees" ("email");

CREATE TABLE "employee_employment_history" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "EmployeeHistoryEventKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT,
    "jobTitle" TEXT,
    "employmentType" "EmploymentType",
    "status" "EmploymentStatus",
    "metadata" JSONB,
    CONSTRAINT "employee_employment_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_employment_history_companyId_employeeId_occurredAt_idx"
  ON "employee_employment_history" ("companyId", "employeeId", "occurredAt" DESC);

CREATE INDEX "employee_employment_history_companyId_idx"
  ON "employee_employment_history" ("companyId");

ALTER TABLE "employee_employment_history"
  ADD CONSTRAINT "employee_employment_history_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_employment_history"
  ADD CONSTRAINT "employee_employment_history_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_employment_history"
  ADD CONSTRAINT "employee_employment_history_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
