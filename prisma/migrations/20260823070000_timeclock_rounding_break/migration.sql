-- Punch rounding (symmetric-nearest; a one-sided rule systematically underpays)
-- and automatic unpaid-break deduction (single-interval days only). Both off by
-- default so existing companies are unchanged.
ALTER TABLE "payroll_settings" ADD COLUMN "punchRoundingMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payroll_settings" ADD COLUMN "breakDeductMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payroll_settings" ADD COLUMN "breakDeductAfterMinutes" INTEGER NOT NULL DEFAULT 360;
