-- Repair payroll approval columns when environments skipped `20260516180000_payroll_spreadsheet_module`
-- partially or run `db push` drift. Prisma schema expects `approvedAt` / `approvedById`.

-- Drop legacy FK before renaming/dropping legacy columns (idempotent).
ALTER TABLE "payrolls" DROP CONSTRAINT IF EXISTS "payrolls_confirmedById_fkey";

-- Rename legacy columns when `approved*` were never created.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payrolls' AND column_name = 'confirmedAt'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payrolls' AND column_name = 'approvedAt'
  ) THEN
    ALTER TABLE "payrolls" RENAME COLUMN "confirmedAt" TO "approvedAt";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payrolls' AND column_name = 'confirmedById'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payrolls' AND column_name = 'approvedById'
  ) THEN
    ALTER TABLE "payrolls" RENAME COLUMN "confirmedById" TO "approvedById";
  END IF;
END $$;

-- If both legacy and new columns exist (partial migration), merge then drop legacy.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payrolls' AND column_name = 'confirmedAt'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payrolls' AND column_name = 'approvedAt'
  ) THEN
    UPDATE "payrolls" SET "approvedAt" = COALESCE("approvedAt", "confirmedAt");
    ALTER TABLE "payrolls" DROP COLUMN "confirmedAt";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payrolls' AND column_name = 'confirmedById'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payrolls' AND column_name = 'approvedById'
  ) THEN
    UPDATE "payrolls" SET "approvedById" = COALESCE("approvedById", "confirmedById");
    ALTER TABLE "payrolls" DROP COLUMN "confirmedById";
  END IF;
END $$;

ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;

ALTER TABLE "payrolls" DROP CONSTRAINT IF EXISTS "payrolls_approvedById_fkey";
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
