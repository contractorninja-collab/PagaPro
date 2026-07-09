# PagaPRO — Universal document generation (architecture)

Operational separation matches enterprise HR reality: **settings → reusable templates → per-subject generation → immutable archive**.

Templates and artifacts are **category-aware** (`CONTRACT`, `LEAVE`, `TERMINATION`, `WARNING`) via Prisma `DocumentCategory`. Employment **`Contract`** rows remain the business entity for contracts; other subjects use existing tables (`LeaveRequest`, `Termination`) or **`DisciplinaryWarning`**.

## INITIAL SETUP (once per company)

| Step | Data | Stored as |
|------|------|-----------|
| Company profile | Legal/trade name, NRB/NUI | `Company` |
| Company settings | Payroll toggles, **registered address** | `CompanySetting` |
| Authorized representative | Name, title; future signature asset key | `CompanySetting` (`authorizedRepresentative*`, `authorizedSignatureStorageKey`) |
| Templates | Logical grouping + **`documentCategory`** (+ optional contract subtype / kind when category is CONTRACT) | `DocumentTemplate` |
| Template uploads | Each DOCX = immutable **`DocumentTemplateVersion`** (`versionNumber`, `sourceStorageKey`, `detectedPlaceholders`, `locale`, `isPublished`) | |

**Versioning**: Uploading a new file creates **`DocumentTemplateVersion` (+1)**. Only **one published version** per logical template should be active (`isPublished`); switching publish is a transactional operation in the app layer.

## DAILY FLOW

1. **Select subject** — load `Employee` plus the domain row (`Contract`, `LeaveRequest`, `Termination`, or `DisciplinaryWarning`).
2. **Select template** — resolve **`DocumentTemplate`** with matching **`documentCategory`** + published **`DocumentTemplateVersion`** (`loadPublishedDocumentTemplateVersion`).
3. **Auto-fill** — `buildCoreOrganizationalContext` (+ category adapter: contract dates, leave dates, termination fields, warning fields) → optional `mergeDocumentMetadata` / manual overrides.
4. **Compose registry** — `composePlaceholderRegistry([category])` merges core keys with category extensions; **`validatePlaceholdersForRender(..., registry, ...)`** runs before render.
5. **Preview** — `generateDocumentFromTemplate` → persist **`DocumentGenerationArtifact`** with `kind = PREVIEW` (append-only history).
6. **PDF** — convert DOCX→PDF (worker / queue — outside core engine); store **`generatedPdfStorageKey`** on artifact when implemented.
7. **Archive** — insert **`DocumentGenerationArtifact`** with `kind = ARCHIVED_FINAL`, **`mergedPayload` frozen**, hashes optional. **Multiple `ARCHIVED_FINAL` rows per subject are allowed** — regeneration inserts a new row linked via **`supersedesArtifactId`** (the earlier one-final-per-subject partial unique index was dropped in migration `20260518120000_dokumentet_module_evolution`).

> **Contract entity is decoupled from generation.** Contracts generate employee-driven (`subjectKind = Employee`); the engine does **not** write `Contract` rows, so `Contract.storedPdfUrl` / `generationStatus` are not populated by the current pipeline.

## IMMUTABILITY

- **`document_generation_artifacts`**: the **content snapshot** (`mergedPayload`, `detectedPlaceholderKeys`, `docxSha256`) is frozen at insert. Rows are otherwise **mutable for derived data**: the lazy PDF backfill patches `generatedPdfStorageKey`/`pdfSha256`, and archiving flips `isArchived`.
- **`ARCHIVED_FINAL`**: legally frozen snapshot of placeholders + blob pointers + hashes.

## Storage keys

Neutral prefixes (see `src/modules/documents/engine/storage/path-keys.ts`):

- `documents/templates/{companyId}/{templateId}/v{n}/source.docx`
- `documents/artifacts/{companyId}/{subjectKind}/{subjectId}/{artifactId}/...`

## Implementation modules

- Engine (pure): `src/modules/documents/engine/` — detect / validate / render / `generateDocumentFromTemplate`.
- Context adapters: `src/modules/documents/context/` — core org slice + per-category `Record<string, string>` builders.
- Orchestration: `src/modules/documents/services/document-generation-service.ts` — load published version, storage get/put, insert artifact.
- PDF resolution/backfill: `src/modules/documents/services/artifact-pdf-service.ts` (`ensureArtifactPdf`) — shared by the single-artifact and bulk-zip download routes.
