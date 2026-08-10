-- Kosovo no longer asks for the business registration number (NRB), so the app
-- has stopped collecting, printing and storing it.
--
-- This destroys whatever NRB values are on file. That is the intent — the field
-- is no longer requested anywhere and leaving the column behind would leave an
-- orphan nothing reads, which is how the last audit found `hourlyRate`.
--
-- The UNIQUE index (companies_businessRegistrationNumber_key) drops with the
-- column; it does not need its own statement.

ALTER TABLE "companies" DROP COLUMN IF EXISTS "businessRegistrationNumber";
