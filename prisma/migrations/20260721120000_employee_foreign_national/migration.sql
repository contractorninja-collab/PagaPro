-- Shtetas i Huaj: foreign nationals with temporary residence are exempt from
-- mandatory Trust contributions (Law 04/L-101); income tax still applies.
-- Additive and non-destructive.

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "isForeignNational" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "residencePermitExpiryDate" TIMESTAMP(3);
