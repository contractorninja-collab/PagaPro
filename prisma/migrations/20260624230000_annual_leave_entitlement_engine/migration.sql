-- Annual leave engine v2: company workweek settings and pending balance column.

CREATE TYPE "AnnualLeaveAccrualMode" AS ENUM ('UPFRONT', 'MONTHLY', 'STATUTORY_FIRST_YEAR');
CREATE TYPE "AnnualLeaveRoundingMode" AS ENUM ('NONE', 'HALF_DAY', 'FULL_DAY');

ALTER TABLE "company_configurations"
ADD COLUMN IF NOT EXISTS "workingDaysPerWeek" DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS "annualLeaveAccrualMode" "AnnualLeaveAccrualMode" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN IF NOT EXISTS "annualLeaveRoundingMode" "AnnualLeaveRoundingMode" NOT NULL DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS "allowNegativeAnnualLeaveBalance" BOOLEAN NOT NULL DEFAULT false;

UPDATE "company_configurations"
SET "workingDaysPerWeek" = 5
WHERE "workingDaysPerWeek" IS NULL;

ALTER TABLE "leave_balances"
ADD COLUMN IF NOT EXISTS "pendingDays" DECIMAL(8,2) NOT NULL DEFAULT 0;
