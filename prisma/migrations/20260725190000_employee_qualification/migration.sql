-- Kualifikimi: schooling / professional qualification (Ligji Nr. 03/L-212, Neni 11.1.3).
ALTER TABLE "employees" ADD COLUMN "qualification" TEXT;

INSERT INTO "placeholder_registry" (
    "id",
    "placeholderKey",
    "label",
    "category",
    "isRequired",
    "sourcePath",
    "isActive",
    "createdAt",
    "updatedAt"
)
VALUES (
    'placeholder_employee_qualification',
    'employee_qualification',
    'Kualifikimi',
    'employee',
    false,
    'employee.qualification',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("placeholderKey") DO UPDATE SET
    "label" = EXCLUDED."label",
    "category" = EXCLUDED."category",
    "isRequired" = EXCLUDED."isRequired",
    "sourcePath" = EXCLUDED."sourcePath",
    "isActive" = EXCLUDED."isActive",
    "updatedAt" = CURRENT_TIMESTAMP;
