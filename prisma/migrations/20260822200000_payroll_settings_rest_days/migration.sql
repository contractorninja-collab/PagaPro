-- Which weekdays pay the weekend premium in the time clock (0=Sunday..6=Saturday).
-- Hardcoded Saturday+Sunday paid every Saturday hour at the weekend multiplier
-- in companies whose working week includes Saturday.
ALTER TABLE "payroll_settings" ADD COLUMN "restDays" INTEGER[] NOT NULL DEFAULT ARRAY[0,6]::INTEGER[];
