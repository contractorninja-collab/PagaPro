import type { Metadata } from "next";
import { LargimetDashboardClient } from "@/modules/terminations/components/largimet-dashboard-client";
import {
  listEmployeesForTerminationPicker,
  listTerminationsForCompany,
} from "@/modules/terminations/services/termination-queries";
import { requireCompanyContextPage } from "@/server/company-context";

export const metadata: Metadata = {
  title: "Largimet",
};

function first(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  if (Array.isArray(v)) return v[0] ?? "";
  return typeof v === "string" ? v : "";
}

export default async function LargimetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { companyId } = await requireCompanyContextPage();

  const sp = await searchParams;
  const yearParam = first(sp, "year");
  const monthParam = first(sp, "month");
  const yearRaw = Number(yearParam);
  const monthRaw = Number(monthParam);

  const filters = {
    status: first(sp, "status") || undefined,
    type: first(sp, "type") || undefined,
    employeeId: first(sp, "employeeId") || undefined,
    year: yearParam && Number.isFinite(yearRaw) ? yearRaw : undefined,
    month:
      monthParam && Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12
        ? monthRaw
        : undefined,
  };

  let rows;
  let employees;
  try {
    rows = await listTerminationsForCompany(companyId, filters);
    employees = await listEmployeesForTerminationPicker(companyId);
  } catch (err) {
    console.error("[pagapro] LargimetPage load failed", err);
    return (
      <div className="mx-auto max-w-xl py-12">
        <p className="text-sm text-destructive">Nuk mund të ngarkohen largimet.</p>
      </div>
    );
  }

  const serializedRows = JSON.parse(JSON.stringify(rows)) as unknown;
  const serializedEmployees = JSON.parse(JSON.stringify(employees)) as unknown;

  return (
    <LargimetDashboardClient
      rows={serializedRows as never}
      employees={serializedEmployees as never}
      filters={filters}
    />
  );
}
