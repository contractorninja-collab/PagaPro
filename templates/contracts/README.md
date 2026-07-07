# Contract templates (Kontratat)

Place your Word `.docx` files here. Each blank line in the document must use **at least four underscores** (`____________`) — the app replaces them **in order** with employee/company data.

## Files

| File | Type |
|------|------|
| `kontrate-me-afat-te-caktuar.docx` | Fixed-term — needs start **and** end date |
| `kontrate-me-afat-te-pacaktuar.docx` | Indefinite — start date only |

Field order is defined in `manifest.json`. The **1st** underline in the Word file maps to the **1st** field in the manifest, and so on.

## Validate before seeding

```bash
npm run contracts:validate-templates
```

Fix any count mismatch by reordering blanks in Word or editing `manifest.json`.

## Load into the app

```bash
npm run db:seed
```

Templates are registered per company, published as v1, and editable via **Dokumentet → Shabllonet**.

## Available field keys

| Key | Data |
|-----|------|
| `company_name` | Trade or legal name |
| `company_nui` | Fiscal number (NUI) |
| `company_nrb` | Business registration (NRB) |
| `company_address` | Company address from settings |
| `employee_name` | Full name |
| `employee_personal_number` | Personal ID |
| `employee_position` | Job title |
| `employee_job_description` | Job description from the employee profile/job title |
| `employee_department` | Department name |
| `employee_address` | Employee address |
| `contract_start_date` | User-selected start date |
| `contract_end_date` | User-selected end date (fixed-term only) |
| `probation_period` | Employee profile probation months as text, for example `1 Muaj` |
| `probation_months` | Employee profile probation months as a number |
| `salary_gross` | Monthly gross salary |
| `authorized_person_name` | Authorized signatory |
| `authorized_person_position` | Signatory position |
| `document_date` | Signing date |
