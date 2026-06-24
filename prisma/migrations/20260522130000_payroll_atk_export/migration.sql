-- ATK payroll Excel export artifacts (official template-filled workbooks).

CREATE TABLE "payroll_atk_exports" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "payrollId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "generated_file_url" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "metadataJson" JSONB,
    "generatedByUserId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_atk_exports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_atk_exports_companyId_payrollId_idx" ON "payroll_atk_exports"("companyId", "payrollId");
CREATE INDEX "payroll_atk_exports_payrollId_isArchived_idx" ON "payroll_atk_exports"("payrollId", "isArchived");

ALTER TABLE "payroll_atk_exports"
    ADD CONSTRAINT "payroll_atk_exports_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_atk_exports"
    ADD CONSTRAINT "payroll_atk_exports_payrollId_fkey"
    FOREIGN KEY ("payrollId") REFERENCES "payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_atk_exports"
    ADD CONSTRAINT "payroll_atk_exports_generatedByUserId_fkey"
    FOREIGN KEY ("generatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
