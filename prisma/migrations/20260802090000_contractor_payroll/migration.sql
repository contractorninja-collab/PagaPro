-- CreateEnum
CREATE TYPE "ContractorPayrollStatus" AS ENUM ('DRAFT', 'LOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContractorHoursSource" AS ENUM ('MANUAL', 'TIMECLOCK');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "contractorPayrollEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "payroll_settings" ADD COLUMN     "nightEndHour" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "nightStartHour" INTEGER NOT NULL DEFAULT 22;

-- CreateTable
CREATE TABLE "contractor_payroll_periods" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "ContractorPayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contractor_payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contractor_payroll_entries" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "hourlyRateSnapshot" DECIMAL(14,4) NOT NULL,
    "regularHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "overtimeHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "weekendHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "holidayHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "nightHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "hoursSource" "ContractorHoursSource" NOT NULL DEFAULT 'MANUAL',
    "grossPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "calculationBreakdown" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contractor_payroll_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contractor_payroll_periods_companyId_status_idx" ON "contractor_payroll_periods"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contractor_payroll_periods_companyId_year_month_key" ON "contractor_payroll_periods"("companyId", "year", "month");

-- CreateIndex
CREATE INDEX "contractor_payroll_entries_employeeId_idx" ON "contractor_payroll_entries"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "contractor_payroll_entries_periodId_employeeId_key" ON "contractor_payroll_entries"("periodId", "employeeId");

-- AddForeignKey
ALTER TABLE "contractor_payroll_periods" ADD CONSTRAINT "contractor_payroll_periods_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_payroll_periods" ADD CONSTRAINT "contractor_payroll_periods_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_payroll_periods" ADD CONSTRAINT "contractor_payroll_periods_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_payroll_entries" ADD CONSTRAINT "contractor_payroll_entries_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "contractor_payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_payroll_entries" ADD CONSTRAINT "contractor_payroll_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
