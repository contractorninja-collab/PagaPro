-- Marks contractor-period flat amounts that HR edited by hand, so refresh and
-- profile-salary sync can overwrite stale snapshots without undoing pro-ratas.
ALTER TABLE "contractor_payroll_entries" ADD COLUMN "flatAmountManuallySet" BOOLEAN NOT NULL DEFAULT false;
