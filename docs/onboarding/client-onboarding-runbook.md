# Client onboarding runbook (internal)

Operator-side, step-by-step workflow for bringing a new client company onto PagaPRO.
The client-facing companion document is `Udhezues-PagaPRO-per-Klientin.docx` in this
folder (regenerate with `node scripts/build-client-guide.cjs` after editing the builder).

Target time: ~1 hour of operator work + one 45-minute assisted-setup call with the client.

---

## Phase 0 — Prerequisites (once, not per client)

- Production is healthy: `pagapro.vercel.app` loads, latest deploy on `main` is Ready.
- You have a platform-admin login (`isPlatformAdmin`, password already rotated).
- The admin console lives at the secret path (`NEXT_PUBLIC_PAGAPRO_ADMIN_PATH`); the
  literal `/admin` intentionally 404s.

## Phase 1 — Create the company (admin console)

1. Open `{admin path}/bizneset` → **Shto Biznes**.
2. Fill the form. Only `legalName` is technically required — **but as policy, always fill**:
   - **Emri ligjor** (legalName) — as registered at ARBK
   - **NUI** (fiscalNumber) and **NRB** (businessRegistrationNumber) — these print on
     every legal document (contracts, annexes, terminations). Leaving them empty
     produces legally incomplete documents; nothing else enforces this.
   - **Adresa + qyteti** — used for the document letterhead and `document_place`.
   - **Slug** — auto-generated from the name if left empty; only override if the
     client wants a specific subdomain later.
3. Click save and **read the toast**:
   - Expected: *"Biznesi u krijua. U instaluan 14 shabllone dokumentesh."*
   - Provisioning automatically creates: current-year Kosovo official holidays,
     the baseline Kosovo payroll parameter set (min wage 350 €, pension 5%/5%),
     the default leave policy, and all 14 document templates (2 contracts,
     7 leave, 5 termination).
   - **Any orange warning toast = something failed to provision.** Fix before
     continuing (see Troubleshooting).

## Phase 2 — Create the client's first user

1. Open the company (`{admin path}/bizneset/{id}`) → **Shto Përdorues**.
2. Email = the client admin's real email. Role = **OWNER** (one per company;
   HR staff added later get `HR_MANAGER` or `ACCOUNTANT`).
3. A **temporary password is shown exactly once** — copy it immediately.
4. Deliver credentials over **two separate channels** (e.g., email the address,
   send the password via WhatsApp/Viber/SMS). Never both in one message.
5. First login forces a password change (`mustChangePassword`); tell the client
   to expect that screen.

Password reset later: same page → reset issues a new temp password and kills all
of the user's sessions.

## Phase 3 — Access URL

- Today all clients log in at **https://pagapro.vercel.app** — membership scopes
  what they see; there is no cross-tenant leakage from a shared host.
- Per-client subdomains (`{slug}.rootdomain`) activate only after
  `PAGAPRO_ROOT_DOMAINS` + wildcard DNS are configured; `Company.customDomain`
  is available per client. Neither is required for onboarding.

## Phase 4 — Assisted setup call (~45 min, share screen with the client)

Work top-down; the order matters because documents pull from this data.

1. **Konfigurime** (client logged in):
   - Company data: verify NUI/NRB/address flowed in correctly.
   - **Përfaqësuesi i autorizuar**: name + position — these print as the signer
     on every contract/annex/termination.
   - Upload **signature** and **stamp** images (PNG, transparent background best).
   - Letterhead address line if different from the registered address.
   - Note: the settings row is created on first save — saving once here is mandatory,
     otherwise documents render with blank representative fields.
2. **Departamentet & Pozitat**: create departments, then job titles *with
   descriptions* — the description becomes `përshkrimi i detyrave` in contracts
   (Neni 11 requires it).
3. **Punonjësit**: CSV import for bulk (limits: 2 MB / 2000 rows; required
   columns: Emri, Mbiemri, Nr personal, Data e punësimit; dates `YYYY-MM-DD` or
   `DD.MM.YYYY`), or manual entry. After import, spot-check 2–3 profiles:
   salary, weekly hours, IBAN, contract term (Kontratat tab → afati).
4. **Verify document generation** (the acid test): pick one real employee →
   Dokumentet → Gjenero dokumente → contract → download the DOCX and open it.
   Every field must be filled — a blank spot means missing company/employee data.

## Phase 5 — First payroll (do it together)

1. Pagat → create the current month's payroll → confirm every active employee
   is included.
2. Walk the flow: Draft → Shqyrtim → Miratim. **Before Miratim**, have the client
   compare 2–3 net salaries against their previous payroll provider.
3. Download a payslip; generate the ATK export and have their accountant verify
   it against the ATK portal's expectations **before** the first real submission.

## Phase 6 — Handoff

- Send `Udhezues-PagaPRO-per-Klientin.docx` (this folder).
- Agree the support channel and hours.
- Go-live checklist — all must be true:

| # | Check |
|---|---|
| 1 | Toast showed 14 templates at creation, no warnings |
| 2 | NUI + NRB filled and printing on a generated test document |
| 3 | Authorized representative + signature + stamp set in Konfigurime |
| 4 | Employees imported; spot-checked salary/hours/IBAN/contract term |
| 5 | Test contract generated and opened — no blank fields |
| 6 | Payroll dry-run compared against previous provider |
| 7 | ATK export reviewed by the client's accountant |
| 8 | OWNER password rotated (forced at first login) |

## Troubleshooting

- **Warning toast at company creation** ("Shabllonet e … nuk u krijuan"):
  run `npm run templates:seed` locally against production env, or redeploy —
  the build re-seeds every company idempotently. Root cause is usually storage
  credentials; check Vercel logs for `[provisionCompany]` lines.
- **Documents render with blank fields**: missing NUI/NRB (admin console →
  company) or missing authorized representative (client's Konfigurime, must be
  saved at least once).
- **Client can't log in**: check membership `isActive` and company status
  `ACTIVE` in the admin console; reset the password if the temp one expired in
  transit.
- **New year, holidays missing**: holiday seeding at provisioning covers the
  current year only; subsequent years seed lazily on first payroll use of that
  year.
