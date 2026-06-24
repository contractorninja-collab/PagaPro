-- AlterEnum / CreateEnum for Kosovo payroll engine additions (Prisma migration baseline fragment).
-- Apply via `prisma migrate dev` after syncing `schema.prisma`, or run manually on existing databases.

CREATE TYPE "EmployerPrimacy" AS ENUM ('PRIMARY', 'SECONDARY');

CREATE TYPE "SecondaryEmployerPitBase" AS ENUM ('TAXABLE_AFTER_PENSION', 'GROSS');

ALTER TABLE "employees" ADD COLUMN "employerPrimacy" "EmployerPrimacy" NOT NULL DEFAULT 'PRIMARY';

ALTER TABLE "employees" ADD COLUMN "hourlyRate" DECIMAL(14, 4);

ALTER TABLE "employees" ADD COLUMN "standardMonthlyHours" DECIMAL(8, 2);

ALTER TABLE "payroll_parameter_sets" ADD COLUMN "premiumRules" JSONB;

ALTER TABLE "payroll_parameter_sets" ADD COLUMN "secondaryEmployerFlatRate" DECIMAL(8, 6);

ALTER TABLE "payroll_parameter_sets" ADD COLUMN "secondaryEmployerPitBase" "SecondaryEmployerPitBase";

ALTER TABLE "payroll_entries" ADD COLUMN "employerPrimacySnapshot" "EmployerPrimacy" NOT NULL DEFAULT 'PRIMARY';
