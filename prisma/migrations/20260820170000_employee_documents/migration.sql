-- Employee documents: the uploaded half of the personnel file.
-- Hand-authored from `prisma migrate diff` output; pre-existing drift the
-- diff also surfaced (unrelated DROP DEFAULTs / index renames) is deliberately
-- NOT included here.

-- CreateEnum
CREATE TYPE "EmployeeDocumentCategory" AS ENUM ('IDENTIFIKIM', 'KONTRATA_TE_NENSHKRUARA', 'KUALIFIKIME', 'MJEKESORE', 'DISIPLINORE', 'DEKLARATA_PELQIME', 'TJERA');

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "category" "EmployeeDocumentCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "displayFilename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "supersedesId" TEXT,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_documents_storageKey_key" ON "employee_documents"("storageKey");

-- CreateIndex
CREATE INDEX "employee_documents_companyId_employeeId_isArchived_category_idx" ON "employee_documents"("companyId", "employeeId", "isArchived", "category");

-- CreateIndex
CREATE INDEX "employee_documents_companyId_expiresAt_idx" ON "employee_documents"("companyId", "expiresAt");

-- CreateIndex
CREATE INDEX "employee_documents_companyId_createdAt_idx" ON "employee_documents"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "employee_documents_supersedesId_idx" ON "employee_documents"("supersedesId");

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "employee_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
