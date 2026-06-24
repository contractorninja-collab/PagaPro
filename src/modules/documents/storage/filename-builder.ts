import type { DocumentCategory } from "@prisma/client";

const SQ_MONTHS = [
  "Janar",
  "Shkurt",
  "Mars",
  "Prill",
  "Maj",
  "Qershor",
  "Korrik",
  "Gusht",
  "Shtator",
  "Tetor",
  "Nentor",
  "Dhjetor",
] as const;

function slugAscii(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

/** ISO date yyyy-mm-dd from Date (UTC or local — use local for filenames) */
export function formatIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function payrollMonthLabel(month: number): string {
  if (month < 1 || month > 12) return String(month);
  const label = SQ_MONTHS[month - 1];
  return label ?? String(month);
}

export interface GeneratedFilenameParts {
  category: DocumentCategory;
  employeeFirstName?: string | null;
  employeeLastName?: string | null;
  payrollYear?: number | null;
  payrollMonth?: number | null;
  documentDate?: Date;
}

/**
 * Human-facing filenames, e.g. Kontrate_Arines_Ajeti_2026-06-01.pdf
 */
export function buildGeneratedDocumentBasename(parts: GeneratedFilenameParts): string {
  const ext = "pdf";
  const dateStr = formatIsoDateLocal(parts.documentDate ?? new Date());

  if (parts.category === "PAYROLL" && parts.payrollYear != null && parts.payrollMonth != null) {
    const m = payrollMonthLabel(parts.payrollMonth);
    const y = parts.payrollYear;
    return slugAscii(`Payroll_${m}_${y}`) || `Payroll_${y}_${parts.payrollMonth}`;
  }

  const fn = parts.employeeFirstName?.trim() ?? "";
  const ln = parts.employeeLastName?.trim() ?? "";
  const namePart = [fn, ln].filter(Boolean).join("_");

  const prefixes: Partial<Record<DocumentCategory, string>> = {
    CONTRACT: "Kontrate",
    LEAVE: "Pushim",
    TERMINATION: "Ndërprerje",
    WARNING: "Verejtje",
    PAYROLL: "Payroll",
    OTHER: "Dokument",
  };

  const pfx = prefixes[parts.category] ?? "Dokument";
  const core = namePart ? `${pfx}_${namePart}_${dateStr}` : `${pfx}_${dateStr}`;
  const slug = slugAscii(core);
  return slug ? `${slug}.${ext}` : `${pfx}_${dateStr}.${ext}`;
}
