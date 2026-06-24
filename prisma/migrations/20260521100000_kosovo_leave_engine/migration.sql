-- Kosovo leave engine: LeaveSubtype, policy parameters, accrual ledger, employee flags, balance enrichment, interruption fields.

CREATE TYPE "LeaveSubtype" AS ENUM (
  'NONE',
  'MARTESE',
  'VDEKJE_FAMILJARE',
  'LINDJE_FEMIJE',
  'DHURIM_GJAKU',
  'ATERSI_PAGUAR_2_DITE',
  'ATERSI_PA_PAGESE_JAVE_2',
  'LEHONI_FAZA_PUNEDHENESI_70',
  'LEHONI_FAZA_QEVERIA_50',
  'LEHONI_FAZA_FUNDIT_PA_PAGESE'
);

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "isHazardousPosition" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "isSingleParent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "hasDisability" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "hasChildUnderThree" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "leaveTenureAnchorDate" TIMESTAMP(3);

CREATE TABLE "leave_policy_parameter_sets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "minimumAnnualWorkingDays" DECIMAL(6,2) NOT NULL DEFAULT 20,
    "hazardousMinimumWorkingDays" DECIMAL(6,2) NOT NULL DEFAULT 30,
    "monthlyAccrualDays" DECIMAL(14,9) NOT NULL DEFAULT 1.666666666666667,
    "tenureBonusEveryYears" INTEGER NOT NULL DEFAULT 5,
    "tenureBonusDaysPerBlock" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "specialCategoryExtraDays" DECIMAL(4,2) NOT NULL DEFAULT 2,
    "firstYearGateMonths" INTEGER NOT NULL DEFAULT 6,
    "carryOverExpiryMonth" INTEGER NOT NULL DEFAULT 6,
    "carryOverExpiryDay" INTEGER NOT NULL DEFAULT 30,
    "splitLeaveMinWorkingDays" INTEGER NOT NULL DEFAULT 10,
    "enforceSplitLeaveRule" BOOLEAN NOT NULL DEFAULT false,
    "blockNegativeBalance" BOOLEAN NOT NULL DEFAULT true,
    "warnInsufficientBalance" BOOLEAN NOT NULL DEFAULT true,
    "warnSplitLeaveViolation" BOOLEAN NOT NULL DEFAULT true,
    "warnCarryOverExpiry" BOOLEAN NOT NULL DEFAULT true,
    "enableTenureBonus" BOOLEAN NOT NULL DEFAULT true,
    "enableSpecialCategoryExtra" BOOLEAN NOT NULL DEFAULT true,
    "collectiveAgreementJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_policy_parameter_sets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "leave_policy_parameter_sets_companyId_effectiveFrom_idx" ON "leave_policy_parameter_sets"("companyId", "effectiveFrom");

ALTER TABLE "leave_policy_parameter_sets" ADD CONSTRAINT "leave_policy_parameter_sets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "leave_accrual_ledger" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "accruedDays" DECIMAL(10,4) NOT NULL,
    "basisJson" JSONB NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_accrual_ledger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "leave_accrual_ledger_company_employee_period_idx" ON "leave_accrual_ledger"("companyId", "employeeId", "periodYear", "periodMonth");

ALTER TABLE "leave_accrual_ledger" ADD CONSTRAINT "leave_accrual_ledger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leave_accrual_ledger" ADD CONSTRAINT "leave_accrual_ledger_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leave_balances" ADD COLUMN IF NOT EXISTS "accruedYtd" DECIMAL(8,2) NOT NULL DEFAULT 0;
ALTER TABLE "leave_balances" ADD COLUMN IF NOT EXISTS "entitlementFullYear" DECIMAL(8,2);
ALTER TABLE "leave_balances" ADD COLUMN IF NOT EXISTS "carryIn" DECIMAL(8,2) NOT NULL DEFAULT 0;
ALTER TABLE "leave_balances" ADD COLUMN IF NOT EXISTS "carryExpiresAt" TIMESTAMP(3);
ALTER TABLE "leave_balances" ADD COLUMN IF NOT EXISTS "computedFromRuleVersion" TEXT;
ALTER TABLE "leave_balances" ADD COLUMN IF NOT EXISTS "breakdown" JSONB;

ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "subtype" "LeaveSubtype" NOT NULL DEFAULT 'NONE';
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "interruptedByLeaveRequestId" TEXT;
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "supersedesWorkingDaysSnapshot" JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_requests_interruptedByLeaveRequestId_fkey'
  ) THEN
    ALTER TABLE "leave_requests"
      ADD CONSTRAINT "leave_requests_interruptedByLeaveRequestId_fkey"
      FOREIGN KEY ("interruptedByLeaveRequestId") REFERENCES "leave_requests"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "leave_policy_parameter_sets" (
  "id",
  "companyId",
  "effectiveFrom",
  "minimumAnnualWorkingDays",
  "hazardousMinimumWorkingDays",
  "monthlyAccrualDays",
  "tenureBonusEveryYears",
  "tenureBonusDaysPerBlock",
  "specialCategoryExtraDays",
  "firstYearGateMonths",
  "carryOverExpiryMonth",
  "carryOverExpiryDay",
  "splitLeaveMinWorkingDays",
  "enforceSplitLeaveRule",
  "blockNegativeBalance",
  "warnInsufficientBalance",
  "warnSplitLeaveViolation",
  "warnCarryOverExpiry",
  "enableTenureBonus",
  "enableSpecialCategoryExtra",
  "updatedAt"
)
SELECT
  ('lpps_' || substr(md5(random()::text || c.id || clock_timestamp()::text), 1, 22)),
  c.id,
  TIMESTAMP '2000-01-01',
  20,
  30,
  1.666666666666667,
  5,
  1,
  2,
  6,
  6,
  30,
  10,
  false,
  true,
  true,
  true,
  true,
  true,
  true,
  CURRENT_TIMESTAMP
FROM "companies" c
WHERE NOT EXISTS (
  SELECT 1 FROM "leave_policy_parameter_sets" p WHERE p."companyId" = c.id
);
