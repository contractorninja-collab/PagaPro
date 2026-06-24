-- Payroll settings: working time, holiday overrides, Kosovo-default multipliers on column defaults.

ALTER TABLE "payroll_settings"
  ADD COLUMN IF NOT EXISTS "hoursPerWorkingDay" DECIMAL(6, 2) NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS "overtimeWeeklyThresholdHours" DECIMAL(6, 2) NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS "payrollExtraHolidayDates" JSONB,
  ADD COLUMN IF NOT EXISTS "payrollExcludedHolidayDates" JSONB,
  ADD COLUMN IF NOT EXISTS "nightWorkPeriodDescription" VARCHAR(96) NOT NULL DEFAULT '22:00–06:00';

ALTER TABLE "payroll_settings" ALTER COLUMN "overtimeMultiplier" SET DEFAULT 1.3;
ALTER TABLE "payroll_settings" ALTER COLUMN "weekendMultiplier" SET DEFAULT 1.5;
ALTER TABLE "payroll_settings" ALTER COLUMN "holidayMultiplier" SET DEFAULT 2.0;
ALTER TABLE "payroll_settings" ALTER COLUMN "nightWorkMultiplier" SET DEFAULT 1.3;
