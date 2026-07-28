-- Time clock (Prezenca): badge kiosk → derived hours → payroll.
-- Only this feature's DDL is included; the schema diff also surfaces unrelated
-- pre-existing drift, which is deliberately left alone.

-- CreateEnum
CREATE TYPE "TimeClockDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "TimeClockPunchSource" AS ENUM ('KIOSK', 'MANUAL');

-- CreateEnum
CREATE TYPE "TimeClockDayStatus" AS ENUM ('OK', 'NEEDS_REVIEW');

-- AlterTable: per-company entitlement, switched from the admin console.
ALTER TABLE "companies" ADD COLUMN     "timeClockEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: badge/chip scanned at the kiosk.
ALTER TABLE "employees" ADD COLUMN     "badgeCode" VARCHAR(64);

-- AlterTable: night hours whose base pay sits in another bucket — uplift only.
ALTER TABLE "payroll_entries" ADD COLUMN     "nightStackHours" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "time_clock_devices" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "location" VARCHAR(160),
    "tokenHash" TEXT NOT NULL,
    "pairingCode" VARCHAR(32),
    "pairingCodeExpires" TIMESTAMP(3),
    "pairedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_clock_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_clock_punches" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "deviceId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "deviceReportedAt" TIMESTAMP(3),
    "direction" "TimeClockDirection" NOT NULL,
    "source" "TimeClockPunchSource" NOT NULL DEFAULT 'KIOSK',
    "badgeCodeUsed" VARCHAR(64),
    "note" TEXT,
    "createdById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_clock_punches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_clock_days" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "status" "TimeClockDayStatus" NOT NULL DEFAULT 'OK',
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "regularMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "weekendMinutes" INTEGER NOT NULL DEFAULT 0,
    "holidayMinutes" INTEGER NOT NULL DEFAULT 0,
    "nightMinutes" INTEGER NOT NULL DEFAULT 0,
    "nightStackMinutes" INTEGER NOT NULL DEFAULT 0,
    "firstInAt" TIMESTAMP(3),
    "lastOutAt" TIMESTAMP(3),
    "reviewReason" TEXT,
    "ruleSnapshot" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_clock_days_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "time_clock_devices_tokenHash_key" ON "time_clock_devices"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "time_clock_devices_pairingCode_key" ON "time_clock_devices"("pairingCode");

-- CreateIndex
CREATE INDEX "time_clock_devices_companyId_idx" ON "time_clock_devices"("companyId");

-- CreateIndex
CREATE INDEX "time_clock_devices_companyId_isActive_idx" ON "time_clock_devices"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "time_clock_punches_companyId_occurredAt_idx" ON "time_clock_punches"("companyId", "occurredAt");

-- CreateIndex
CREATE INDEX "time_clock_punches_employeeId_occurredAt_idx" ON "time_clock_punches"("employeeId", "occurredAt");

-- CreateIndex
CREATE INDEX "time_clock_punches_companyId_employeeId_occurredAt_idx" ON "time_clock_punches"("companyId", "employeeId", "occurredAt");

-- CreateIndex
CREATE INDEX "time_clock_days_companyId_workDate_idx" ON "time_clock_days"("companyId", "workDate");

-- CreateIndex
CREATE INDEX "time_clock_days_companyId_status_idx" ON "time_clock_days"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "time_clock_days_employeeId_workDate_key" ON "time_clock_days"("employeeId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "employees_companyId_badgeCode_key" ON "employees"("companyId", "badgeCode");

-- AddForeignKey
ALTER TABLE "time_clock_devices" ADD CONSTRAINT "time_clock_devices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_clock_devices" ADD CONSTRAINT "time_clock_devices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_clock_punches" ADD CONSTRAINT "time_clock_punches_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_clock_punches" ADD CONSTRAINT "time_clock_punches_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_clock_punches" ADD CONSTRAINT "time_clock_punches_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "time_clock_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_clock_punches" ADD CONSTRAINT "time_clock_punches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_clock_punches" ADD CONSTRAINT "time_clock_punches_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_clock_days" ADD CONSTRAINT "time_clock_days_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_clock_days" ADD CONSTRAINT "time_clock_days_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
