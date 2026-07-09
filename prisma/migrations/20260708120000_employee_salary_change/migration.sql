-- CreateTable
CREATE TABLE "employee_salary_changes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "previousBaseSalary" DECIMAL(14,2),
    "newBaseSalary" DECIMAL(14,2) NOT NULL,
    "compensationBasis" "CompensationBasis" NOT NULL DEFAULT 'GROSS_MONTHLY',
    "targetNetMonthly" DECIMAL(14,2),
    "reason" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_salary_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_salary_changes_companyId_employeeId_effectiveFrom_idx" ON "employee_salary_changes"("companyId", "employeeId", "effectiveFrom" DESC);

-- CreateIndex
CREATE INDEX "employee_salary_changes_companyId_idx" ON "employee_salary_changes"("companyId");

-- AddForeignKey
ALTER TABLE "employee_salary_changes" ADD CONSTRAINT "employee_salary_changes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salary_changes" ADD CONSTRAINT "employee_salary_changes_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salary_changes" ADD CONSTRAINT "employee_salary_changes_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
