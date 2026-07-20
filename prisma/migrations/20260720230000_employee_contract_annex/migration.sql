-- Aneks Kontratë (contract amendment) feature.
-- Adds contract-term fields to employees and a table of issued annexes.
-- Additive and non-destructive.

-- CreateEnum
CREATE TYPE "ContractTermType" AS ENUM ('INDEFINITE', 'FIXED_TERM', 'SPECIFIC_TASK');

-- AlterTable: contract term (Ligji Nr. 03/L-212, Neni 10-11)
ALTER TABLE "employees" ADD COLUMN     "contractEndDate" TIMESTAMP(3),
ADD COLUMN     "contractStartDate" TIMESTAMP(3),
ADD COLUMN     "contractType" "ContractTermType" NOT NULL DEFAULT 'INDEFINITE',
ADD COLUMN     "workplace" TEXT;

-- Backfill: existing employees' contract starts at their hire date.
UPDATE "employees" SET "contractStartDate" = "hireDate" WHERE "contractStartDate" IS NULL;

-- CreateTable
CREATE TABLE "employee_contract_annexes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "annexNumber" INTEGER NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "changeCategories" TEXT[],
    "changesJson" JSONB NOT NULL,
    "snapshotJobTitle" TEXT,
    "snapshotJobDescription" TEXT,
    "snapshotDepartment" TEXT,
    "snapshotWorkplace" TEXT,
    "snapshotWeeklyHours" DECIMAL(6,2),
    "snapshotBaseSalary" DECIMAL(14,2),
    "snapshotContractStart" TIMESTAMP(3),
    "snapshotContractEnd" TIMESTAMP(3),
    "snapshotContractType" "ContractTermType",
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_contract_annexes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_contract_annexes_companyId_employeeId_idx" ON "employee_contract_annexes"("companyId", "employeeId");

-- CreateIndex
CREATE INDEX "employee_contract_annexes_companyId_idx" ON "employee_contract_annexes"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_contract_annexes_employeeId_annexNumber_key" ON "employee_contract_annexes"("employeeId", "annexNumber");

-- AddForeignKey
ALTER TABLE "employee_contract_annexes" ADD CONSTRAINT "employee_contract_annexes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_contract_annexes" ADD CONSTRAINT "employee_contract_annexes_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_contract_annexes" ADD CONSTRAINT "employee_contract_annexes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
