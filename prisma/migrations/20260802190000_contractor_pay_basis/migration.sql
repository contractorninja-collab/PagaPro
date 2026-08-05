-- Contractors can be paid a fixed monthly fee instead of hours × rate.
-- Both bases are net: a contractor carries no PIT and no pension, so the
-- figure agreed is the figure paid.

-- CreateEnum
CREATE TYPE "ContractorPayBasis" AS ENUM ('HOURLY', 'MONTHLY_FLAT');

-- AlterTable
ALTER TABLE "contractor_payroll_entries" ADD COLUMN     "monthlyFlatAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "payBasis" "ContractorPayBasis" NOT NULL DEFAULT 'HOURLY';

-- Every contractor that exists today was created through a form that offered
-- only an hourly rate, while storing compensationBasis = 'GROSS_MONTHLY'
-- (the enum default). From here on that value means "fixed monthly fee" for a
-- contractor, so without this backfill each of them would silently flip to a
-- flat fee of whatever baseSalaryMonthly happens to hold — usually 0.
UPDATE "employees"
SET "compensationBasis" = 'HOURLY_GROSS'
WHERE "employmentType" = 'CONTRACTOR'
  AND "compensationBasis" = 'GROSS_MONTHLY';
