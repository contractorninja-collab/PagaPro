-- Payroll operations module: status workflow, settings, adjustments, snapshots, documents, entry premiums/bonus.

-- -----------------------------------------------------------------------------
-- 1) Payroll period status enum migration (OPEN/CALCULATED -> REVIEWED/CONFIRMED)
-- -----------------------------------------------------------------------------
CREATE TYPE "PayrollPeriodStatus_new" AS ENUM ('DRAFT', 'REVIEWED', 'CONFIRMED', 'LOCKED', 'ARCHIVED');

ALTER TABLE "payrolls" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "payrolls"
  ALTER COLUMN "status" TYPE "PayrollPeriodStatus_new"
  USING (
    CASE "status"::text
      WHEN 'OPEN' THEN 'REVIEWED'::"PayrollPeriodStatus_new"
      WHEN 'CALCULATED' THEN 'CONFIRMED'::"PayrollPeriodStatus_new"
      WHEN 'DRAFT' THEN 'DRAFT'::"PayrollPeriodStatus_new"
      WHEN 'LOCKED' THEN 'LOCKED'::"PayrollPeriodStatus_new"
      WHEN 'ARCHIVED' THEN 'ARCHIVED'::"PayrollPeriodStatus_new"
      ELSE 'DRAFT'::"PayrollPeriodStatus_new"
    END
  );

DROP TYPE "PayrollPeriodStatus";
ALTER TYPE "PayrollPeriodStatus_new" RENAME TO "PayrollPeriodStatus";
ALTER TABLE "payrolls" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"PayrollPeriodStatus";

-- -----------------------------------------------------------------------------
-- 2) Payroll header workflow timestamps
-- -----------------------------------------------------------------------------
ALTER TABLE "payrolls"
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedById" TEXT,
  ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "confirmedById" TEXT,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedById" TEXT;

ALTER TABLE "payrolls"
  ADD CONSTRAINT "payrolls_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payrolls"
  ADD CONSTRAINT "payrolls_confirmedById_fkey"
    FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payrolls"
  ADD CONSTRAINT "payrolls_archivedById_fkey"
    FOREIGN KEY ("archivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "payrolls_status_idx" ON "payrolls"("status");

-- -----------------------------------------------------------------------------
-- 3) Payroll entry premium & bonus columns
-- -----------------------------------------------------------------------------
ALTER TABLE "payroll_entries"
  ADD COLUMN IF NOT EXISTS "overtimeHours" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "overtimeAmount" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "holidayHours" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "holidayAmount" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "weekendHours" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "weekendAmount" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "bonuses" DECIMAL(14, 2) NOT NULL DEFAULT 0;

-- -----------------------------------------------------------------------------
-- 4) New enums + tables
-- -----------------------------------------------------------------------------
CREATE TYPE "PayrollAdjustmentKind" AS ENUM ('BONUS', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION');
CREATE TYPE "PayrollDocumentKind" AS ENUM ('REGISTER_WITH_TOTALS', 'REGISTER_SIGNATURE_LIST', 'EMPLOYEE_PAYSLIP');

CREATE TABLE "payroll_settings" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "minimumSalaryMonthly" DECIMAL(14, 2) NOT NULL,
  "minimumSalaryScheduledAmount" DECIMAL(14, 2),
  "minimumSalaryScheduledEffectiveFrom" TIMESTAMP(3),
  "pensionEmployeePercent" DECIMAL(8, 6) NOT NULL,
  "pensionEmployerPercent" DECIMAL(8, 6) NOT NULL,
  "overtimeMultiplier" DECIMAL(8, 4) NOT NULL,
  "weekendMultiplier" DECIMAL(8, 4) NOT NULL,
  "holidayMultiplier" DECIMAL(8, 4) NOT NULL,
  "standardWeeklyHours" DECIMAL(6, 2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payroll_settings_companyId_key" ON "payroll_settings"("companyId");
ALTER TABLE "payroll_settings"
  ADD CONSTRAINT "payroll_settings_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payroll_adjustments" (
  "id" TEXT NOT NULL,
  "payrollEntryId" TEXT NOT NULL,
  "kind" "PayrollAdjustmentKind" NOT NULL,
  "label" TEXT NOT NULL,
  "amount" DECIMAL(14, 2) NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_adjustments_payrollEntryId_idx" ON "payroll_adjustments"("payrollEntryId");
ALTER TABLE "payroll_adjustments"
  ADD CONSTRAINT "payroll_adjustments_payrollEntryId_fkey"
    FOREIGN KEY ("payrollEntryId") REFERENCES "payroll_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payroll_snapshots" (
  "id" TEXT NOT NULL,
  "payrollId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "capturedByUserId" TEXT,
  "payload" JSONB NOT NULL,
  "checksum" TEXT,
  CONSTRAINT "payroll_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payroll_snapshots_payrollId_key" ON "payroll_snapshots"("payrollId");
CREATE INDEX "payroll_snapshots_companyId_idx" ON "payroll_snapshots"("companyId");
ALTER TABLE "payroll_snapshots"
  ADD CONSTRAINT "payroll_snapshots_payrollId_fkey"
    FOREIGN KEY ("payrollId") REFERENCES "payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_snapshots"
  ADD CONSTRAINT "payroll_snapshots_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_snapshots"
  ADD CONSTRAINT "payroll_snapshots_capturedByUserId_fkey"
    FOREIGN KEY ("capturedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "payroll_generated_documents" (
  "id" TEXT NOT NULL,
  "payrollId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "kind" "PayrollDocumentKind" NOT NULL,
  "employeeId" TEXT,
  "storageKey" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "generatedByUserId" TEXT,
  CONSTRAINT "payroll_generated_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_generated_documents_companyId_payrollId_idx"
  ON "payroll_generated_documents"("companyId", "payrollId");
CREATE INDEX "payroll_generated_documents_payrollId_kind_idx"
  ON "payroll_generated_documents"("payrollId", "kind");
ALTER TABLE "payroll_generated_documents"
  ADD CONSTRAINT "payroll_generated_documents_payrollId_fkey"
    FOREIGN KEY ("payrollId") REFERENCES "payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_generated_documents"
  ADD CONSTRAINT "payroll_generated_documents_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_generated_documents"
  ADD CONSTRAINT "payroll_generated_documents_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_generated_documents"
  ADD CONSTRAINT "payroll_generated_documents_generatedByUserId_fkey"
    FOREIGN KEY ("generatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 5) Entry immutability trigger — LOCKED + ARCHIVED; include new columns
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION payroll_entries_locked_guard()
RETURNS TRIGGER AS $$
DECLARE
  pr_status text;
BEGIN
  SELECT p.status::text INTO pr_status FROM payrolls p WHERE p.id = NEW."payrollId";
  IF TG_OP = 'UPDATE' AND pr_status IN ('LOCKED', 'ARCHIVED') THEN
    IF (
      OLD."employeeId" IS DISTINCT FROM NEW."employeeId" OR
      OLD."status" IS DISTINCT FROM NEW."status" OR
      OLD."employmentTypeSnapshot" IS DISTINCT FROM NEW."employmentTypeSnapshot" OR
      OLD."employerPrimacySnapshot" IS DISTINCT FROM NEW."employerPrimacySnapshot" OR
      OLD."calendarDaysInMonth" IS DISTINCT FROM NEW."calendarDaysInMonth" OR
      OLD."paidDays" IS DISTINCT FROM NEW."paidDays" OR
      OLD."grossSalary" IS DISTINCT FROM NEW."grossSalary" OR
      OLD."taxableIncome" IS DISTINCT FROM NEW."taxableIncome" OR
      OLD."pitWithheld" IS DISTINCT FROM NEW."pitWithheld" OR
      OLD."pensionEmployee" IS DISTINCT FROM NEW."pensionEmployee" OR
      OLD."pensionEmployer" IS DISTINCT FROM NEW."pensionEmployer" OR
      OLD."otherDeductions" IS DISTINCT FROM NEW."otherDeductions" OR
      OLD."otherEmployerCosts" IS DISTINCT FROM NEW."otherEmployerCosts" OR
      OLD."netPay" IS DISTINCT FROM NEW."netPay" OR
      OLD."overtimeHours" IS DISTINCT FROM NEW."overtimeHours" OR
      OLD."overtimeAmount" IS DISTINCT FROM NEW."overtimeAmount" OR
      OLD."holidayHours" IS DISTINCT FROM NEW."holidayHours" OR
      OLD."holidayAmount" IS DISTINCT FROM NEW."holidayAmount" OR
      OLD."weekendHours" IS DISTINCT FROM NEW."weekendHours" OR
      OLD."weekendAmount" IS DISTINCT FROM NEW."weekendAmount" OR
      OLD."bonuses" IS DISTINCT FROM NEW."bonuses" OR
      OLD."calculationBreakdown" IS DISTINCT FROM NEW."calculationBreakdown" OR
      OLD."createdAt" IS DISTINCT FROM NEW."createdAt"
    ) THEN
      RAISE EXCEPTION 'payroll_entries immutable when payroll period is LOCKED or ARCHIVED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
