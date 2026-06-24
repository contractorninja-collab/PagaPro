-- PagaPRO enterprise extensions: RBAC roles, company profile, HR tables,
-- timeline, notifications outbox, domain activity, payroll guards.

-- =============================================================================
-- 1) CompanyMembershipRole enum remap (preserve row data)
-- =============================================================================

CREATE TYPE "CompanyMembershipRole_new" AS ENUM ('OWNER', 'ADMIN', 'HR_MANAGER', 'ACCOUNTANT', 'READ_ONLY');

ALTER TABLE "user_company_memberships" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "user_company_memberships"
  ALTER COLUMN "role" TYPE "CompanyMembershipRole_new"
  USING (
    CASE "role"::text
      WHEN 'COMPANY_ADMIN' THEN 'ADMIN'::"CompanyMembershipRole_new"
      WHEN 'HR' THEN 'HR_MANAGER'::"CompanyMembershipRole_new"
      WHEN 'CLIENT_VIEWER' THEN 'READ_ONLY'::"CompanyMembershipRole_new"
      WHEN 'ACCOUNTANT' THEN 'ACCOUNTANT'::"CompanyMembershipRole_new"
      ELSE 'READ_ONLY'::"CompanyMembershipRole_new"
    END
  );

DROP TYPE "CompanyMembershipRole";

ALTER TYPE "CompanyMembershipRole_new" RENAME TO "CompanyMembershipRole";

-- Promote earliest ADMIN membership per company to OWNER (deterministic)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "user_company_memberships"
  WHERE "role"::text = 'ADMIN'
)
UPDATE "user_company_memberships" m
SET role = 'OWNER'::"CompanyMembershipRole"
FROM ranked r
WHERE m.id = r.id AND r.rn = 1;

-- Companies with no OWNER yet: promote earliest membership row to OWNER
WITH missing_owner AS (
  SELECT c.id AS cid
  FROM "companies" c
  WHERE NOT EXISTS (
      SELECT 1
      FROM "user_company_memberships" u
      WHERE u."companyId" = c.id AND u.role::text = 'OWNER'
    )
),
pick AS (
  SELECT DISTINCT ON (u."companyId") u.id AS mid
  FROM "user_company_memberships" u
  INNER JOIN missing_owner mo ON mo.cid = u."companyId"
  ORDER BY u."companyId", u."createdAt" ASC, u.id ASC
)
UPDATE "user_company_memberships" m
SET role = 'OWNER'::"CompanyMembershipRole"
FROM pick
WHERE m.id = pick.mid;

CREATE UNIQUE INDEX "user_company_memberships_one_owner_per_company"
  ON "user_company_memberships" ("companyId")
  WHERE role = 'OWNER'::"CompanyMembershipRole";

-- =============================================================================
-- 2) Company profile & settings
-- =============================================================================

ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "website" TEXT,
  ADD COLUMN IF NOT EXISTS "addressLine" TEXT,
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "postalCode" TEXT,
  ADD COLUMN IF NOT EXISTS "country" TEXT DEFAULT 'XK';

ALTER TABLE "company_settings"
  ADD COLUMN IF NOT EXISTS "authorizedStampStorageKey" TEXT;

-- =============================================================================
-- 3) New enums + Employee work arrangement
-- =============================================================================

CREATE TYPE "WorkArrangement" AS ENUM ('ON_SITE', 'REMOTE', 'HYBRID');
CREATE TYPE "EmploymentPeriodReason" AS ENUM ('HIRE', 'REHIRE', 'TERMINATION', 'CORRECTION');
CREATE TYPE "TimelineEventSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN_APP', 'SMS');
CREATE TYPE "NotificationTopic" AS ENUM ('CONTRACT_EXPIRING', 'PAYROLL_REMINDER', 'LEAVE_PENDING', 'SYSTEM_ALERT');
CREATE TYPE "DomainActivityVerb" AS ENUM ('CREATED', 'UPDATED', 'APPROVED', 'REJECTED', 'LOCKED', 'UNLOCKED', 'ARCHIVED', 'VOIDED');

ALTER TABLE "employees"
  ADD COLUMN "workArrangement" "WorkArrangement" NOT NULL DEFAULT 'ON_SITE';

CREATE INDEX IF NOT EXISTS "employees_companyId_lastName_firstName_idx"
  ON "employees" ("companyId", "lastName", "firstName");

-- =============================================================================
-- 4) Employment history & employee satellite tables
-- =============================================================================

CREATE TABLE "employment_periods" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "reason" "EmploymentPeriodReason" NOT NULL,
    "terminationId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employment_periods_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employment_periods_companyId_employeeId_startedAt_idx"
  ON "employment_periods" ("companyId", "employeeId", "startedAt");

ALTER TABLE "employment_periods"
  ADD CONSTRAINT "employment_periods_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employment_periods"
  ADD CONSTRAINT "employment_periods_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employment_periods"
  ADD CONSTRAINT "employment_periods_terminationId_fkey"
  FOREIGN KEY ("terminationId") REFERENCES "terminations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "employee_bank_accounts" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "bankName" TEXT,
    "accountHolderName" TEXT,
    "bicSwift" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_bank_accounts_employeeId_idx" ON "employee_bank_accounts"("employeeId");

ALTER TABLE "employee_bank_accounts"
  ADD CONSTRAINT "employee_bank_accounts_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "employee_bank_accounts_one_primary_per_employee"
  ON "employee_bank_accounts" ("employeeId")
  WHERE "isPrimary" = true;

CREATE TABLE "employee_emergency_contacts" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_emergency_contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_emergency_contacts_employeeId_idx" ON "employee_emergency_contacts"("employeeId");

ALTER TABLE "employee_emergency_contacts"
  ADD CONSTRAINT "employee_emergency_contacts_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "employee_bank_accounts" ("id", "employeeId", "iban", "isPrimary", "validFrom", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || e.id)::text,
  e.id,
  trim(e."bankAccountIban"),
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "employees" e
WHERE e."bankAccountIban" IS NOT NULL
  AND length(trim(e."bankAccountIban")) > 0
  AND NOT EXISTS (SELECT 1 FROM "employee_bank_accounts" b WHERE b."employeeId" = e.id);

-- =============================================================================
-- 5) Leave approver FK
-- =============================================================================

ALTER TABLE "leave_requests"
  ADD CONSTRAINT "leave_requests_decidedByMembershipId_fkey"
  FOREIGN KEY ("decidedByMembershipId") REFERENCES "user_company_memberships"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- 6) Timeline, notifications, domain activity
-- =============================================================================

CREATE TABLE "employee_timeline_events" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" TEXT NOT NULL,
    "severity" "TimelineEventSeverity",
    "subjectKind" TEXT,
    "subjectId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "metadata" JSONB,
    "actorUserId" TEXT,
    "actorMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_timeline_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_timeline_events_companyId_employeeId_occurredAt_idx"
  ON "employee_timeline_events" ("companyId", "employeeId", "occurredAt" DESC);

CREATE INDEX "employee_timeline_events_companyId_eventType_occurredAt_idx"
  ON "employee_timeline_events" ("companyId", "eventType", "occurredAt");

ALTER TABLE "employee_timeline_events"
  ADD CONSTRAINT "employee_timeline_events_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_timeline_events"
  ADD CONSTRAINT "employee_timeline_events_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_timeline_events"
  ADD CONSTRAINT "employee_timeline_events_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employee_timeline_events"
  ADD CONSTRAINT "employee_timeline_events_actorMembershipId_fkey"
  FOREIGN KEY ("actorMembershipId") REFERENCES "user_company_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "notification_outbox" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "topic" "NotificationTopic" NOT NULL,
    "payload" JSONB NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_outbox_companyId_topic_scheduledFor_idx"
  ON "notification_outbox" ("companyId", "topic", "scheduledFor");

CREATE INDEX "notification_outbox_pending_worker_idx"
  ON "notification_outbox" ("scheduledFor")
  WHERE "processedAt" IS NULL;

ALTER TABLE "notification_outbox"
  ADD CONSTRAINT "notification_outbox_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_outbox"
  ADD CONSTRAINT "notification_outbox_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "channels" JSONB,
    "mutedTopics" JSONB,
    "digestFrequency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_preferences_userId_companyId_key"
  ON "notification_preferences"("userId", "companyId");

CREATE INDEX "notification_preferences_companyId_idx" ON "notification_preferences"("companyId");

ALTER TABLE "notification_preferences"
  ADD CONSTRAINT "notification_preferences_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_preferences"
  ADD CONSTRAINT "notification_preferences_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "domain_activities" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "verb" "DomainActivityVerb" NOT NULL,
    "actorUserId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT NOT NULL,
    "payload" JSONB,
    CONSTRAINT "domain_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "domain_activities_companyId_occurredAt_idx"
  ON "domain_activities" ("companyId", "occurredAt");

CREATE INDEX "domain_activities_entityType_entityId_idx"
  ON "domain_activities" ("entityType", "entityId");

ALTER TABLE "domain_activities"
  ADD CONSTRAINT "domain_activities_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "domain_activities"
  ADD CONSTRAINT "domain_activities_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- 7) Payroll integrity constraints & LOCK guard on entries
-- =============================================================================

ALTER TABLE "payrolls"
  ADD CONSTRAINT "payrolls_month_range_chk"
  CHECK ("month" >= 1 AND "month" <= 12);

ALTER TABLE "payrolls"
  ADD CONSTRAINT "payrolls_year_range_chk"
  CHECK ("year" >= 1990 AND "year" <= 2100);

CREATE OR REPLACE FUNCTION payroll_entries_locked_guard()
RETURNS TRIGGER AS $$
DECLARE
  pr_status text;
BEGIN
  SELECT p.status::text INTO pr_status FROM payrolls p WHERE p.id = NEW."payrollId";
  IF TG_OP = 'UPDATE' AND pr_status = 'LOCKED' THEN
    IF NOT (
      OLD.id IS NOT DISTINCT FROM NEW.id AND
      OLD."payrollId" IS NOT DISTINCT FROM NEW."payrollId" AND
      OLD."employeeId" IS NOT DISTINCT FROM NEW."employeeId" AND
      OLD.status IS NOT DISTINCT FROM NEW.status AND
      OLD."employmentTypeSnapshot" IS NOT DISTINCT FROM NEW."employmentTypeSnapshot" AND
      OLD."employerPrimacySnapshot" IS NOT DISTINCT FROM NEW."employerPrimacySnapshot" AND
      OLD."calendarDaysInMonth" IS NOT DISTINCT FROM NEW."calendarDaysInMonth" AND
      OLD."paidDays" IS NOT DISTINCT FROM NEW."paidDays" AND
      OLD."grossSalary" IS NOT DISTINCT FROM NEW."grossSalary" AND
      OLD."taxableIncome" IS NOT DISTINCT FROM NEW."taxableIncome" AND
      OLD."pitWithheld" IS NOT DISTINCT FROM NEW."pitWithheld" AND
      OLD."pensionEmployee" IS NOT DISTINCT FROM NEW."pensionEmployee" AND
      OLD."pensionEmployer" IS NOT DISTINCT FROM NEW."pensionEmployer" AND
      OLD."otherDeductions" IS NOT DISTINCT FROM NEW."otherDeductions" AND
      OLD."otherEmployerCosts" IS NOT DISTINCT FROM NEW."otherEmployerCosts" AND
      OLD."netPay" IS NOT DISTINCT FROM NEW."netPay" AND
      OLD."calculationBreakdown" IS NOT DISTINCT FROM NEW."calculationBreakdown" AND
      OLD."createdAt" IS NOT DISTINCT FROM NEW."createdAt"
    ) THEN
      RAISE EXCEPTION 'payroll_entries immutable when payroll period is LOCKED (allowed: payslipDeliveryStatus, updatedAt)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payroll_entries_locked_guard_trg ON payroll_entries;

CREATE TRIGGER payroll_entries_locked_guard_trg
  BEFORE UPDATE ON payroll_entries
  FOR EACH ROW
  EXECUTE FUNCTION payroll_entries_locked_guard();
