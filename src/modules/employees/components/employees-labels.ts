import type { EmploymentStatus, EmploymentType, Gender, WorkArrangement } from "@prisma/client";

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  EMPLOYEE: "Punonjës",
  CONTRACTOR: "Kontraktor",
};

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  ACTIVE: "Aktiv",
  INACTIVE: "Jo aktiv",
  ON_LEAVE: "Në pushim",
  SUSPENDED: "Pezulluar",
  TERMINATED: "I larguar",
};

export const WORK_ARRANGEMENT_LABELS: Record<WorkArrangement, string> = {
  ON_SITE: "Fizik",
  REMOTE: "Remote",
  HYBRID: "Hybrid",
};

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: "Mashkull",
  FEMALE: "Femër",
  OTHER: "Tjetër",
  UNSPECIFIED: "Pa specifikuar",
};

export function formatEur(amount: string | number): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("sq-XK", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatSqDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("sq-AL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function isoDateInput(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
