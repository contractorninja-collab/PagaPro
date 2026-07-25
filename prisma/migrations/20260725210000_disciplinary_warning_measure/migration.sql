-- Masa e shqiptuar (Ligji Nr. 03/L-212, neni 85.1) dhe afati për përmirësim (neni 70.2).
ALTER TABLE "disciplinary_warnings" ADD COLUMN "measure" TEXT;
ALTER TABLE "disciplinary_warnings" ADD COLUMN "improvementDeadline" TIMESTAMP(3);

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
VALUES
    (
        'placeholder_warning_measure',
        'warning_measure',
        'Masa e shqiptuar',
        'warning',
        false,
        'warning.measure',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'placeholder_warning_improvement_deadline',
        'warning_improvement_deadline',
        'Afati për përmirësim',
        'warning',
        false,
        'warning.improvementDeadline',
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
