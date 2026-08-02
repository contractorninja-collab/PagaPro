-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "billingNotes" TEXT,
ADD COLUMN     "billingPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billingPaidUntil" TIMESTAMP(3),
ADD COLUMN     "billingPlanId" TEXT,
ADD COLUMN     "billingPriceOverrideEur" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "company_brand_groups" ADD COLUMN     "discountAmountEur" DECIMAL(10,2),
ADD COLUMN     "discountPercent" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "billing_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyPriceEur" DECIMAL(10,2) NOT NULL,
    "annualPriceEur" DECIMAL(10,2) NOT NULL,
    "maxActiveEmployees" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_plans_name_key" ON "billing_plans"("name");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_billingPlanId_fkey" FOREIGN KEY ("billingPlanId") REFERENCES "billing_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
