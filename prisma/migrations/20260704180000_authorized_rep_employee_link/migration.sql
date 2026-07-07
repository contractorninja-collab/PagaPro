-- Link authorized representatives to an employee; job title is sourced from the employee record.
ALTER TABLE "authorized_representatives" ADD COLUMN "employeeId" TEXT;

CREATE INDEX "authorized_representatives_employeeId_idx" ON "authorized_representatives"("employeeId");

ALTER TABLE "authorized_representatives"
  ADD CONSTRAINT "authorized_representatives_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
