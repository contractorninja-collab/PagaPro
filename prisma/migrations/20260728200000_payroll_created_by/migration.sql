-- Who prepared a payroll, so the sign-off sheet can print a real name under
-- PËRGATITI instead of a blank rule.
ALTER TABLE "payrolls" ADD COLUMN "createdById" TEXT;

ALTER TABLE "payrolls"
  ADD CONSTRAINT "payrolls_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
