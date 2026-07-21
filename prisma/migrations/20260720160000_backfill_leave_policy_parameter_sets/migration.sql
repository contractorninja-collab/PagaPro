-- Existing tenants created after the leave-engine migration need the Kosovo baseline policy.
INSERT INTO "leave_policy_parameter_sets" (
  "id",
  "companyId",
  "effectiveFrom",
  "updatedAt"
)
SELECT
  ('lpps_' || substr(md5(random()::text || c.id || clock_timestamp()::text), 1, 22)),
  c.id,
  TIMESTAMP '2000-01-01',
  CURRENT_TIMESTAMP
FROM "companies" c
WHERE NOT EXISTS (
  SELECT 1
  FROM "leave_policy_parameter_sets" p
  WHERE p."companyId" = c.id
);
