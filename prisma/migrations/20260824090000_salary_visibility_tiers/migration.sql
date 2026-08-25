-- Salary visibility tiers (Universum HR/Finance split).
-- FULL is the default everywhere, so existing tenants are bit-for-bit unchanged.
CREATE TYPE "SalaryAccess" AS ENUM ('FULL', 'STANDARD', 'NONE');

ALTER TABLE "user_company_memberships"
  ADD COLUMN "salaryAccess" "SalaryAccess" NOT NULL DEFAULT 'FULL';

-- "High-level personnel" marker: STANDARD-tier viewers see everyone except these.
ALTER TABLE "employees" ADD COLUMN "salaryConfidential" BOOLEAN NOT NULL DEFAULT false;

-- Profile created without compensation; excluded from payroll until Finance
-- saves a salary, which clears the flag.
ALTER TABLE "employees" ADD COLUMN "salaryPending" BOOLEAN NOT NULL DEFAULT false;
