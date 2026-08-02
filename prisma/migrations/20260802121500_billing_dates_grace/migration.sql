-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "billingStartDate" TIMESTAMP(3),
ADD COLUMN     "billingEndDate" TIMESTAMP(3),
ADD COLUMN     "billingGraceDays" INTEGER NOT NULL DEFAULT 7;
