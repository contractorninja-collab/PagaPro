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
    'placeholder_workplace',
    'workplace',
    'Vendi i punës',
    'employee',
    false,
    'employee.workplace',
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
