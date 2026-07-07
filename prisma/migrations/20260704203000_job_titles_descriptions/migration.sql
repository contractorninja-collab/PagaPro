-- Standardized HR job titles with reusable job descriptions.

CREATE TYPE "JobTitleStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "job_titles" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "department" TEXT,
  "level" TEXT,
  "description" TEXT NOT NULL,
  "responsibilities" TEXT,
  "requirements" TEXT,
  "status" "JobTitleStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "job_titles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_titles_companyId_title_key" ON "job_titles"("companyId", "title");
CREATE INDEX "job_titles_companyId_status_title_idx" ON "job_titles"("companyId", "status", "title");

ALTER TABLE "job_titles"
  ADD CONSTRAINT "job_titles_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employees" ADD COLUMN "jobTitleId" TEXT;
CREATE INDEX "employees_jobTitleId_idx" ON "employees"("jobTitleId");

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_jobTitleId_fkey"
  FOREIGN KEY ("jobTitleId") REFERENCES "job_titles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contracts"
  ADD COLUMN "jobTitleSnapshot" TEXT,
  ADD COLUMN "jobDepartmentSnapshot" TEXT,
  ADD COLUMN "jobLevelSnapshot" TEXT,
  ADD COLUMN "jobDescriptionSnapshot" TEXT,
  ADD COLUMN "jobResponsibilitiesSnapshot" TEXT,
  ADD COLUMN "jobRequirementsSnapshot" TEXT,
  ADD COLUMN "jobSnapshotGeneratedAt" TIMESTAMP(3);
