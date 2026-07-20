ALTER TABLE "companies"
  ADD COLUMN "slug" VARCHAR(80),
  ADD COLUMN "customDomain" VARCHAR(255);

CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");
CREATE UNIQUE INDEX "companies_customDomain_key" ON "companies"("customDomain");
