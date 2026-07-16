-- Preserve all existing leave requests under the historical holiday-aware rule.
ALTER TABLE "leave_requests"
ADD COLUMN "metricsRuleVersion" VARCHAR(64) NOT NULL DEFAULT 'kosovo-leave-engine.v1';

-- New requests use fixed 8-hour Monday-Friday metrics, including weekday holidays.
ALTER TABLE "leave_requests"
ALTER COLUMN "metricsRuleVersion" SET DEFAULT 'kosovo-leave-engine.v2';
