-- Operational dashboard: faster ACTIVE contract expiry scans (company + status + endDate range).
CREATE INDEX IF NOT EXISTS "contracts_companyId_status_endDate_idx" ON "contracts" ("companyId", "status", "endDate");
