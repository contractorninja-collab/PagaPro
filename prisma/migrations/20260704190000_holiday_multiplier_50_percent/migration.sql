-- Festë (holiday) premium: +50% same as weekend (1.5×), not double pay (2.0×).
ALTER TABLE "payroll_settings" ALTER COLUMN "holidayMultiplier" SET DEFAULT 1.5;
UPDATE "payroll_settings" SET "holidayMultiplier" = 1.5 WHERE "holidayMultiplier" = 2.0;
