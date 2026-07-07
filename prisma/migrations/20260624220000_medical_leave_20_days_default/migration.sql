-- Kosovo-compliant regular medical leave quota (20 working days / calendar year).
-- Occupational injury / professional illness is a separate LeaveSubtype, not counted against this quota.

ALTER TYPE "LeaveSubtype" ADD VALUE 'LENDIM_PUNE_OSE_SEMUNDJE_PROFESIONALE';

ALTER TABLE "company_configurations"
ADD COLUMN IF NOT EXISTS "medicalLeaveDaysDefault" DECIMAL(6,2);

UPDATE "leave_balances" AS lb
SET
  "yearlyQuota" = COALESCE(
    (SELECT c."medicalLeaveDaysDefault" FROM "company_configurations" c WHERE c."companyId" = lb."companyId"),
    20
  ),
  "remainingDays" =
    COALESCE(
      (SELECT c."medicalLeaveDaysDefault" FROM "company_configurations" c WHERE c."companyId" = lb."companyId"),
      20
    ) + lb."carryOverDays" - lb."usedDays",
  "updatedAt" = CURRENT_TIMESTAMP
WHERE lb."leaveType" = 'PUSHIM_MJEKESOR';
