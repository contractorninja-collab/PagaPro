-- Overtime hours worked on a weekend or holiday: the base is already paid by the
-- higher bucket, so these carry the overtime uplift only.
ALTER TABLE "payroll_entries" ADD COLUMN     "overtimeStackHours" DECIMAL(10,2) NOT NULL DEFAULT 0;
