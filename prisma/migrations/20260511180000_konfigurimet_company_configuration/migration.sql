-- Konfigurimet module: tenant-isolated operational defaults + authorized representatives

CREATE TABLE "company_configurations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "minimumSalaryCurrent" DECIMAL(14,2),
    "minimumSalaryFromJuly1" DECIMAL(14,2),
    "trustContributionPercent" DECIMAL(8,4),
    "standardWeeklyHours" DECIMAL(6,2),
    "contractReferencePrefix" VARCHAR(48),
    "payrollPdfPrefix" VARCHAR(48),
    "generalDocumentPrefix" VARCHAR(48),
    "annualLeaveDaysDefault" DECIMAL(6,2),
    "personalLeaveDaysDefault" DECIMAL(6,2),
    "medicalLeavePolicyNote" TEXT,
    "notifyContractExpiring" BOOLEAN NOT NULL DEFAULT true,
    "notifyPayrollReminders" BOOLEAN NOT NULL DEFAULT true,
    "notifyLeaveApprovals" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmployeeWarnings" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_configurations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_configurations_companyId_key" ON "company_configurations"("companyId");

ALTER TABLE "company_configurations" ADD CONSTRAINT "company_configurations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "authorized_representatives" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "fullName" TEXT NOT NULL,
    "position" TEXT,
    "signatureStorageKey" TEXT,
    "stampStorageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authorized_representatives_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "authorized_representatives_companyId_sortOrder_idx" ON "authorized_representatives"("companyId", "sortOrder");

ALTER TABLE "authorized_representatives" ADD CONSTRAINT "authorized_representatives_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
