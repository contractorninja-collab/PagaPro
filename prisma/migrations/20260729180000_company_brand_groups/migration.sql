-- Brand grouping for customers who run several legal entities (one Company per NUI/NRB)
-- under a single commercial brand.
--
-- Additive and optional: `brandGroupId` is nullable, so every existing company stays
-- ungrouped and behaves exactly as before. ON DELETE SET NULL means deleting a brand group
-- ungroups its companies rather than cascading into tenant data.

-- CreateTable
CREATE TABLE "company_brand_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_brand_groups_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "companies" ADD COLUMN "brandGroupId" TEXT;

-- CreateIndex
CREATE INDEX "companies_brandGroupId_idx" ON "companies"("brandGroupId");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_brandGroupId_fkey" FOREIGN KEY ("brandGroupId") REFERENCES "company_brand_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
