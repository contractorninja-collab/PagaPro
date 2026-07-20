import { parse } from "csv-parse/sync";
import { DomainActivityVerb, EmployeeHistoryEventKind, Prisma, TimelineEventSeverity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  EmployeeImportCommitResult,
  EmployeeImportPreview,
  EmployeeImportRow,
} from "@/modules/employees/types/employee-import";

export const EMPLOYEE_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const EMPLOYEE_IMPORT_MAX_ROWS = 2_000;
export const EMPLOYEE_IMPORT_HEADERS = [
  "Emri",
  "Mbiemri",
  "Nr personal",
  "Data e lindjes",
  "Data e punësimit",
  "Paga bruto",
  "Banka",
  "Numri i llogarisë",
] as const;

type ImportField =
  | "firstName"
  | "lastName"
  | "personalId"
  | "dateOfBirth"
  | "hireDate"
  | "baseSalaryMonthly"
  | "bankName"
  | "iban";

const HEADER_FIELDS: Record<string, ImportField> = {
  emri: "firstName",
  mbiemri: "lastName",
  "nr personal": "personalId",
  "data e lindjes": "dateOfBirth",
  "data e punesimit": "hireDate",
  "paga bruto": "baseSalaryMonthly",
  banka: "bankName",
  "numri i llogarise": "iban",
  "nr i llogarise": "iban",
  "nr llogarise": "iban",
  iban: "iban",
};

const REQUIRED_FIELDS = new Set<ImportField>(["firstName", "lastName", "personalId", "hireDate"]);

export class EmployeeImportError extends Error {}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("sq-AL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function parseDate(value: string): { iso: string | null; error: string | null } {
  const trimmed = value.trim();
  if (!trimmed) return { iso: null, error: null };

  let year: number;
  let month: number;
  let day: number;
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(trimmed);
    if (!match) return { iso: null, error: "Përdorni formatin YYYY-MM-DD ose DD.MM.YYYY." };
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  }

  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { iso: null, error: "Data nuk është valide." };
  }
  return { iso: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, error: null };
}

function parseSalary(value: string): { amount: string; provided: boolean; error: string | null } {
  const compact = value.trim().replace(/\s+/g, "").replace(/€/g, "");
  if (!compact) return { amount: "0.00", provided: false, error: null };

  let normalized = compact;
  const comma = compact.lastIndexOf(",");
  const dot = compact.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : ".";
    const thousands = decimal === "," ? /\./g : /,/g;
    normalized = compact.replace(thousands, "").replace(decimal, ".");
  } else if (comma >= 0) {
    normalized = compact.replace(",", ".");
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return { amount: "0.00", provided: true, error: "Paga bruto duhet të jetë numër me deri në dy decimale." };
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0 || amount > 999_999_999_999.99) {
    return { amount: "0.00", provided: true, error: "Paga bruto është jashtë kufijve të lejuar." };
  }
  return { amount: amount.toFixed(2), provided: true, error: null };
}

function normalizeBankAccountNumber(value: string): { accountNumber: string | null; error: string | null } {
  const accountNumber = value.replace(/\s+/g, "").toUpperCase();
  if (!accountNumber) return { accountNumber: null, error: null };
  if (!/^[A-Z0-9][A-Z0-9./-]{2,63}$/.test(accountNumber)) {
    return { accountNumber, error: "Numri i llogarisë nuk ka format valid." };
  }
  return { accountNumber, error: null };
}

export function employeeImportTemplateBuffer(): Buffer {
  return Buffer.from(`\uFEFF${EMPLOYEE_IMPORT_HEADERS.join(",")}\r\n`, "utf8");
}

export function validateEmployeeImportFile(file: { name: string; size: number }): void {
  if (!file.name.toLowerCase().endsWith(".csv")) throw new EmployeeImportError("Ngarkoni një skedar .csv.");
  if (file.size <= 0) throw new EmployeeImportError("Skedari CSV është bosh.");
  if (file.size > EMPLOYEE_IMPORT_MAX_BYTES) throw new EmployeeImportError("Skedari CSV nuk mund të jetë më i madh se 2 MB.");
}

export function parseEmployeeImportCsv(source: Buffer): EmployeeImportRow[] {
  let records: string[][];
  try {
    records = parse(source, {
      bom: true,
      columns: false,
      relax_column_count: false,
      skip_empty_lines: true,
    }) as string[][];
  } catch {
    throw new EmployeeImportError("CSV-ja nuk mund të lexohet. Kontrolloni presjet, thonjëzat dhe rreshtat.");
  }
  if (records.length === 0) throw new EmployeeImportError("CSV-ja nuk përmban tituj kolonash.");

  const rawHeaders = records[0] ?? [];
  const fields = rawHeaders.map((header) => HEADER_FIELDS[normalizeHeader(String(header))]);
  const unknown = rawHeaders.filter((header, index) => !fields[index]);
  if (unknown.length > 0) throw new EmployeeImportError(`Kolona të panjohura: ${unknown.join(", ")}.`);
  const duplicateFields = fields.filter((field, index) => fields.indexOf(field) !== index);
  if (duplicateFields.length > 0) throw new EmployeeImportError("CSV-ja përmban kolona të përsëritura.");
  const missing = [...REQUIRED_FIELDS].filter((field) => !fields.includes(field));
  if (missing.length > 0) {
    const labels: Record<ImportField, string> = {
      firstName: "Emri",
      lastName: "Mbiemri",
      personalId: "Nr personal",
      dateOfBirth: "Data e lindjes",
      hireDate: "Data e punësimit",
      baseSalaryMonthly: "Paga bruto",
      bankName: "Banka",
      iban: "Numri i llogarisë",
    };
    throw new EmployeeImportError(`Mungojnë kolonat e detyrueshme: ${missing.map((field) => labels[field]).join(", ")}.`);
  }

  const dataRecords = records.slice(1).filter((record) => record.some((value) => String(value).trim() !== ""));
  if (dataRecords.length === 0) throw new EmployeeImportError("CSV-ja nuk përmban punonjës për import.");
  if (dataRecords.length > EMPLOYEE_IMPORT_MAX_ROWS) throw new EmployeeImportError("CSV-ja nuk mund të ketë më shumë se 2,000 punonjës.");

  const rows = dataRecords.map((record, index): EmployeeImportRow => {
    const values = Object.fromEntries(fields.map((field, column) => [field, String(record[column] ?? "").trim()])) as Record<ImportField, string>;
    const errors: string[] = [];
    if (!values.firstName) errors.push("Emri është i detyrueshëm.");
    if (!values.lastName) errors.push("Mbiemri është i detyrueshëm.");
    if (!values.personalId) errors.push("Numri personal është i detyrueshëm.");

    const birthDate = parseDate(values.dateOfBirth ?? "");
    if (birthDate.error) errors.push(`Data e lindjes: ${birthDate.error}`);
    if (birthDate.iso && new Date(`${birthDate.iso}T12:00:00.000Z`).getTime() > Date.now()) errors.push("Data e lindjes nuk mund të jetë në të ardhmen.");

    const hireDate = parseDate(values.hireDate ?? "");
    if (!values.hireDate) errors.push("Data e punësimit është e detyrueshme.");
    else if (hireDate.error) errors.push(`Data e punësimit: ${hireDate.error}`);

    const salary = parseSalary(values.baseSalaryMonthly ?? "");
    if (salary.error) errors.push(salary.error);
    const normalizedAccountNumber = normalizeBankAccountNumber(values.iban ?? "");
    if (normalizedAccountNumber.error) errors.push(normalizedAccountNumber.error);

    return {
      rowNumber: index + 2,
      firstName: values.firstName ?? "",
      lastName: values.lastName ?? "",
      personalId: values.personalId ?? "",
      dateOfBirthIso: birthDate.iso,
      hireDateIso: hireDate.iso ?? "",
      baseSalaryMonthly: salary.amount,
      bankName: values.bankName || null,
      iban: normalizedAccountNumber.accountNumber,
      intendedStatus: salary.provided && !salary.error && Number(salary.amount) > 0 ? "ACTIVE" : "INACTIVE",
      errors,
    };
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.personalId) counts.set(row.personalId, (counts.get(row.personalId) ?? 0) + 1);
  }
  for (const row of rows) {
    if (row.personalId && (counts.get(row.personalId) ?? 0) > 1) row.errors.push("Numri personal përsëritet brenda CSV-së.");
  }
  return rows;
}

export async function previewEmployeeImport(companyId: string, source: Buffer): Promise<EmployeeImportPreview> {
  const rows = parseEmployeeImportCsv(source);
  const personalIds = [...new Set(rows.map((row) => row.personalId).filter(Boolean))];
  const existing = await prisma.employee.findMany({
    where: { companyId, personalId: { in: personalIds } },
    select: { personalId: true },
  });
  const existingIds = new Set(existing.map((employee) => employee.personalId));
  for (const row of rows) {
    if (existingIds.has(row.personalId)) row.errors.push("Numri personal ekziston tashmë në këtë kompani.");
  }
  const valid = rows.filter((row) => row.errors.length === 0).length;
  return { rows, totals: { total: rows.length, valid, invalid: rows.length - valid } };
}

async function importOneEmployee(
  companyId: string,
  actorUserId: string,
  row: EmployeeImportRow,
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const hireDate = new Date(`${row.hireDateIso}T12:00:00.000Z`);
    const salary = new Prisma.Decimal(row.baseSalaryMonthly);
    const employee = await tx.employee.create({
      data: {
        companyId,
        employmentType: "EMPLOYEE",
        status: row.intendedStatus,
        workArrangement: "ON_SITE",
        firstName: row.firstName,
        lastName: row.lastName,
        personalId: row.personalId,
        dateOfBirth: row.dateOfBirthIso ? new Date(`${row.dateOfBirthIso}T12:00:00.000Z`) : undefined,
        hireDate,
        weeklyHours: new Prisma.Decimal(40),
        baseSalaryMonthly: salary,
        applyTrust: true,
        applyTax: true,
        bankName: row.bankName ?? undefined,
        bankAccountIban: row.iban ?? undefined,
        addressCountry: "XK",
        documentsMissing: true,
      },
    });

    await tx.employmentPeriod.create({ data: { companyId, employeeId: employee.id, startedAt: hireDate, reason: "HIRE" } });
    await tx.employeeSalaryChange.create({
      data: {
        companyId,
        employeeId: employee.id,
        effectiveFrom: hireDate,
        newBaseSalary: salary,
        compensationBasis: "GROSS_MONTHLY",
        reason: "Rekord fillestar (import CSV)",
        changedById: actorUserId,
      },
    });
    if (row.iban) {
      await tx.employeeBankAccount.create({
        data: { employeeId: employee.id, iban: row.iban, bankName: row.bankName ?? undefined, isPrimary: true, validFrom: hireDate },
      });
    }

    const metadata = { source: "CSV_IMPORT", rowNumber: row.rowNumber, status: row.intendedStatus };
    await tx.employeeEmploymentHistory.create({
      data: {
        companyId,
        employeeId: employee.id,
        kind: EmployeeHistoryEventKind.CREATED,
        title: "Punonjësi u importua",
        description: "Regjistrim fillestar nga importi CSV.",
        employmentType: "EMPLOYEE",
        status: row.intendedStatus,
        metadata,
      },
    });
    await tx.employeeTimelineEvent.create({
      data: {
        companyId,
        employeeId: employee.id,
        eventType: "EMPLOYEE_CREATED",
        severity: TimelineEventSeverity.INFO,
        title: "Punonjësi u importua",
        body: "Profili fillestar u krijua nga importi CSV.",
        actorUserId,
        metadata,
      },
    });
    await tx.domainActivity.create({
      data: {
        companyId,
        entityType: "Employee",
        entityId: employee.id,
        verb: DomainActivityVerb.CREATED,
        summary: "Punonjësi u importua nga CSV",
        actorUserId,
        payload: metadata,
      },
    });
    await tx.auditLog.create({
      data: {
        companyId,
        entityType: "Employee",
        entityId: employee.id,
        action: "EMPLOYEE_CREATE_CSV",
        actorUserId,
        diff: metadata,
      },
    });
    return employee.id;
  });
}

export async function commitEmployeeImport(
  companyId: string,
  actorUserId: string,
  source: Buffer,
): Promise<EmployeeImportCommitResult> {
  const preview = await previewEmployeeImport(companyId, source);
  const results: EmployeeImportCommitResult["rows"] = preview.rows
    .filter((row) => row.errors.length > 0)
    .map((row) => ({ rowNumber: row.rowNumber, personalId: row.personalId, employeeId: null, imported: false, errors: row.errors }));
  const validRows = preview.rows.filter((row) => row.errors.length === 0);

  for (let offset = 0; offset < validRows.length; offset += 10) {
    const batch = validRows.slice(offset, offset + 10);
    const settled = await Promise.all(
      batch.map(async (row) => {
        try {
          const employeeId = await importOneEmployee(companyId, actorUserId, row);
          return { rowNumber: row.rowNumber, personalId: row.personalId, employeeId, imported: true, errors: [] };
        } catch (error) {
          const duplicate = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
          return {
            rowNumber: row.rowNumber,
            personalId: row.personalId,
            employeeId: null,
            imported: false,
            errors: [duplicate ? "Numri personal u regjistrua ndërkohë dhe u anashkalua." : "Importi i këtij rreshti dështoi."],
          };
        }
      }),
    );
    results.push(...settled);
  }

  results.sort((a, b) => a.rowNumber - b.rowNumber);
  const imported = results.filter((row) => row.imported).length;
  return { imported, skipped: results.length - imported, rows: results };
}
