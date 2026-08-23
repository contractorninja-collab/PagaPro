-- Department at calculation time. The employee's current department rewrites
-- history when someone transfers; per-department cost must read the snapshot.
ALTER TABLE "payroll_entries" ADD COLUMN "departmentIdSnapshot" TEXT;
ALTER TABLE "payroll_entries" ADD COLUMN "departmentNameSnapshot" TEXT;
