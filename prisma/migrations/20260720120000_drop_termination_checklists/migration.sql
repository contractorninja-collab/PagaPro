-- DropTable
-- The Largimet offboarding checklist was removed: the register now generates and
-- downloads the termination document instead of tracking six manual steps.
-- Foreign keys and indexes are dropped along with the table.
DROP TABLE IF EXISTS "termination_checklists";
