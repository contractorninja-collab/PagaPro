-- Company holiday calendar (yearly rows, HR-editable). Drives payroll expected working-day counts.

CREATE TYPE "CompanyHolidayCategory" AS ENUM ('KOSOVO_OFFICIAL_FIXED', 'KOSOVO_OFFICIAL_MOVABLE', 'COMPANY_CUSTOM');

CREATE TABLE "company_holidays" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "calendarYear" INTEGER NOT NULL,
    "observedOn" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "category" "CompanyHolidayCategory" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceCode" VARCHAR(64),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_holidays_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_holidays_companyId_calendarYear_observedOn_key"
  ON "company_holidays"("companyId", "calendarYear", "observedOn");

CREATE INDEX "company_holidays_companyId_calendarYear_idx"
  ON "company_holidays"("companyId", "calendarYear");

ALTER TABLE "company_holidays"
  ADD CONSTRAINT "company_holidays_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- Backfill: Kosovo official FIXED dates per company × year (preserves pre–UI behaviour).
-- Movable holidays remain HR-managed via Konfigurimet → Festat.
-- -----------------------------------------------------------------------------
INSERT INTO "company_holidays" ("id", "companyId", "calendarYear", "observedOn", "name", "category", "isActive", "sourceCode", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || c.id),
  c.id,
  y.yr,
  make_date(y.yr, h.mm, h.dd),
  h.nm,
  'KOSOVO_OFFICIAL_FIXED'::"CompanyHolidayCategory",
  true,
  h.code,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "companies" AS c
CROSS JOIN (VALUES (2024), (2025), (2026), (2027), (2028), (2029), (2030)) AS y(yr)
CROSS JOIN (VALUES
  ('XK_NEW_YEAR', 1, 1, 'Viti i Ri'),
  ('XK_ORTHODOX_CHRISTMAS', 1, 7, 'Krishtlindjet ortodokse'),
  ('XK_INDEPENDENCE_DAY', 2, 17, 'Dita e Pavarësisë'),
  ('XK_LABOUR_DAY', 5, 1, 'Dita Ndërkombëtare e Punës'),
  ('XK_CATHOLIC_CHRISTMAS', 12, 25, 'Krishtlindjet katolike')
) AS h(code, mm, dd, nm)
ON CONFLICT ("companyId", "calendarYear", "observedOn") DO NOTHING;
