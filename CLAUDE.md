# PagaPRO — agent guide

Kosovo HR & payroll app. Albanian UI, ATK = the Kosovo tax administration.

**Stack:** Next.js 15 (App Router, RSC + server actions) · Prisma 7 with `@prisma/adapter-pg` · PostgreSQL · decimal.js · Zod · Radix UI · Tailwind · Vitest.

**Commands:** `npm run dev` · `npm run typecheck` (`tsc --noEmit`) · `npm test` (vitest) · `npm run db:migrate` · `npm run db:seed`.

## Authentication & tenancy (read first)

Every server action and API route **must** gate on `getCompanyContext()` from `@/server/company-context`. Do **not** trust `resolveActiveCompanyId()` alone — the tenant cookie is client-controlled input.

```ts
const ctx = await getCompanyContext();      // validates DB session + company membership + ACTIVE status
if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) }; // server action
// API route: if (!ctx.ok) return companyContextHttpError(ctx.reason);
const { user, companyId, role } = ctx.context;
```

- RSC pages: `const { companyId } = await requireCompanyContextPage();` (redirects on failure).
- Thread `user.id` as the actor into every audit/service/timeline write (many columns exist for this — never pass `null`).
- Exemptions: `src/app/api/dev/*` (NODE_ENV-gated) and the bearer-token branch of `api/leaves/monthly-accrual` (external scheduler).
- Middleware (`src/middleware.ts`) is a fast presence-only redirect for pages; it does **not** authorize — `getCompanyContext` is the authoritative gate.

Company is the tenant root. Scope every query: `findFirst({ where: { id, companyId } })`, `updateMany/deleteMany({ where: { id, companyId } })`.

## Module structure

`src/modules/<domain>/` with `actions/` (`"use server"`), `services/` (plain data access, `companyId` passed in), `validations|validators/` (Zod), `components/`, `types/`, `index.ts` barrel.

- **Actions** are thin: resolve context → Zod-validate → call a service → `revalidatePath`. Return a discriminated union `{ ok: true; data? } | { ok: false; error; fieldErrors? }`.
- **Services** return `{ ok: true } | { ok: false; code }`; actions translate codes to Albanian messages.
- Mutations are server actions. API routes exist only for binary/file downloads and the accrual job.

## Money

All payroll/money math uses **decimal.js** (`D()` from `calculation/money/decimal.ts`) and `roundMoneyEUR` (half-up, 2dp). **Never** use JS floats for money. The pure calculation engine lives in `src/modules/payroll/calculation/` (no DB/IO); DB orchestration is in `services/`. `Employee.applyTrust`/`applyTax` gate pension/PIT in `calculateEmployeeLine`.

## Prisma migrations

The dev DB user **cannot create a shadow database**, so `prisma migrate dev` fails with **P3014**. To add a migration:

1. `npx prisma migrate diff --config prisma.config.ts --from-config-datasource --to-schema prisma/schema.prisma --script` — this diffs the live DB against the schema. It may surface **unrelated pre-existing drift**; copy **only** the DDL for your change into the migration file.
2. Create `prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql` (timestamp must sort after the latest existing migration).
3. `npx prisma migrate deploy` (applies without a shadow DB) then `npx prisma generate`.
4. **Restart the dev server** — it caches the Prisma client in memory; new models won't load until restart.

## Storage

`getCompanyAssetStorage()` (local FS under `.local-storage/company-assets`, S3-swap intended). Interface `DocumentStorage` = `put/get/exists/delete`. Use `safeDeleteAsset(key)` for best-effort reclaim and `assertCompanyScopedStorageKey(companyId, key)` before serving. Report blobs are reclaimed on archive/regenerate; document-artifact blobs (contracts, terminations) are kept as compliance records.

## Conventions

- **Naming:** English identifiers in code; Albanian only in route slugs (`hyrje`, `pagat`, `pushimet`, `dokumentet`, `konfigurime`, `largimet`, `raportet`, `punonjesit`) and user-facing strings. Some legacy inconsistency exists (the `konfigurime` module, Albanian enum values) — don't propagate it.
- **Verification:** pure engine functions are unit-tested (vitest) — assert exact euro values. Services are DB-bound; verify by driving the real app. Run `npm run typecheck` and `npm test` before considering a change done.
- **Docs:** `docs/{architecture,payroll,documents,branding}`.
