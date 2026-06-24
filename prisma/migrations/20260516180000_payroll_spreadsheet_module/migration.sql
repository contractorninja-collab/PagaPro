-- Spreadsheet payroll: APPROVED status, calendar snapshot, rich entries, corrections, employee compensation.

-- -----------------------------------------------------------------------------
-- 1) PayrollPeriodStatus: CONFIRMED -> APPROVED
-- -----------------------------------------------------------------------------
ALTER TYPE "PayrollPeriodStatus" RENAME VALUE 'CONFIRMED' TO 'APPROVED';

ALTER TABLE "payrolls" DROP CONSTRAINT IF EXISTS "payrolls_confirmedById_fkey";
ALTER TABLE "payrolls" RENAME COLUMN "confirmedAt" TO "approvedAt";
ALTER TABLE "payrolls" RENAME COLUMN "confirmedById" TO "approvedById";
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 2) Payroll header — calendar / validation
-- -----------------------------------------------------------------------------
ALTER TABLE "payrolls"
  ADD COLUMN IF NOT EXISTS "expectedWorkingDays" INTEGER,
  ADD COLUMN IF NOT EXISTS "expectedRegularHours" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "validatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "validationWarnings" JSONB;

-- -----------------------------------------------------------------------------
-- 3) Employee compensation basis
-- -----------------------------------------------------------------------------
CREATE TYPE "CompensationBasis" AS ENUM ('GROSS_MONTHLY', 'TARGET_NET_MONTHLY');

ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "compensationBasis" "CompensationBasis" NOT NULL DEFAULT 'GROSS_MONTHLY',
  ADD COLUMN IF NOT EXISTS "targetNetMonthly" DECIMAL(14, 2);

-- -----------------------------------------------------------------------------
-- 4) Payroll settings — night / leave policy knobs
-- -----------------------------------------------------------------------------
ALTER TABLE "payroll_settings"
  ADD COLUMN IF NOT EXISTS "nightWorkMultiplier" DECIMAL(8, 4) NOT NULL DEFAULT 1.25,
  ADD COLUMN IF NOT EXISTS "sickLeavePayPercent" DECIMAL(8, 6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "overtimeWeeklyCapHours" DECIMAL(8, 2) NOT NULL DEFAULT 8;

-- -----------------------------------------------------------------------------
-- 5) Payroll entry — spreadsheet columns
-- -----------------------------------------------------------------------------
ALTER TABLE "payroll_entries"
  ADD COLUMN IF NOT EXISTS "jobTitleSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "compensationBasisSnapshot" "CompensationBasis",
  ADD COLUMN IF NOT EXISTS "contractGrossMonthlySnapshot" DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "contractNetMonthlySnapshot" DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "expectedWorkingDays" INTEGER,
  ADD COLUMN IF NOT EXISTS "expectedRegularHours" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "actualRegularHours" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paidLeaveHours" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sickLeaveHours" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "unpaidLeaveHours" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "nightHours" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "nightAmount" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "hourlyRate" DECIMAL(14, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "regularPay" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paidLeavePay" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sickLeavePay" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "unpaidLeaveDeduction" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "salaryAdvanceDeduction" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "manualGrossOverride" DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "manualNetOverride" DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "manualGrossReason" TEXT,
  ADD COLUMN IF NOT EXISTS "manualNetReason" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "employerTotalCost" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN NOT NULL DEFAULT false;

UPDATE "payroll_entries" pe
SET "isLocked" = true
FROM "payrolls" p
WHERE pe."payrollId" = p.id AND p.status IN ('LOCKED', 'ARCHIVED');

-- -----------------------------------------------------------------------------
-- 6) Inclusion join table + corrections
-- -----------------------------------------------------------------------------
CREATE TYPE "PayrollCorrectionKind" AS ENUM (
  'NET_ADJUSTMENT',
  'GROSS_ADJUSTMENT',
  'TAX_ADJUSTMENT',
  'PENSION_ADJUSTMENT',
  'OTHER'
);

CREATE TABLE "payroll_included_employees" (
  "payrollId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_included_employees_pkey" PRIMARY KEY ("payrollId", "employeeId"),
  CONSTRAINT "payroll_included_employees_payrollId_fkey"
    FOREIGN KEY ("payrollId") REFERENCES "payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payroll_included_employees_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "payroll_included_employees_employeeId_idx"
  ON "payroll_included_employees"("employeeId");

CREATE TABLE "payroll_corrections" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "payrollId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "kind" "PayrollCorrectionKind" NOT NULL,
  "amount" DECIMAL(14, 2) NOT NULL,
  "reason" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_corrections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payroll_corrections_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payroll_corrections_payrollId_fkey"
    FOREIGN KEY ("payrollId") REFERENCES "payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payroll_corrections_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payroll_corrections_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "payroll_corrections_companyId_payrollId_idx"
  ON "payroll_corrections"("companyId", "payrollId");
CREATE INDEX "payroll_corrections_payrollId_employeeId_idx"
  ON "payroll_corrections"("payrollId", "employeeId");
